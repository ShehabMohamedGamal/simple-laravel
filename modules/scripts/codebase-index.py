import argparse
from contextlib import contextmanager, redirect_stdout
from dataclasses import asdict
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import time
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener


RETRIEVAL = ("symbol", "search", "refs", "explain", "describe", "path")
OLLAMA_ENDPOINT = "http://localhost:11434/v1/embeddings"
OLLAMA_MODEL = "unclemusclez/jina-embeddings-v2-base-code:latest"
PROBE = "def add(a, b): return a + b"


def root_for(value):
    start = Path(value or Path.cwd()).resolve()
    for candidate in (start, *start.parents):
        if (candidate / ".git").exists():
            return candidate
    raise ValueError("Run inside a Git checkout or pass --root with a checkout path.")


def cache_for(root):
    return root / ".claude/cache/codebase-index"


def read_config(root):
    path = cache_for(root) / "config.json"
    value = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    if not isinstance(value, dict):
        raise ValueError("config.json must contain a JSON object.")
    return value


def write_text(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=".cbx-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            stream.write(value)
        os.replace(temporary, path)
    finally:
        Path(temporary).unlink(missing_ok=True)


def write_json(path, value):
    write_text(path, json.dumps(value, indent=2) + "\n")


def emit(value):
    print(json.dumps(value, indent=2))


@contextmanager
def maintenance_lock(root):
    path = cache_for(root) / "maintenance.lock"
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a+b") as stream:
        if os.name == "nt":
            import msvcrt
            if stream.tell() == 0:
                stream.write(b"0")
                stream.flush()
            stream.seek(0)
            deadline = time.monotonic() + 120
            while True:
                try:
                    msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
                    break
                except OSError:
                    if time.monotonic() >= deadline:
                        raise ValueError("Index maintenance is busy. Try again later.")
                    time.sleep(0.1)
            try:
                yield
            finally:
                stream.seek(0)
                msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)
        else:
            import fcntl
            deadline = time.monotonic() + 120
            while True:
                try:
                    fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    break
                except BlockingIOError:
                    if time.monotonic() >= deadline:
                        raise ValueError("Index maintenance is busy. Try again later.")
                    time.sleep(0.1)
            try:
                yield
            finally:
                fcntl.flock(stream, fcntl.LOCK_UN)


def configure(root, args):
    config_path = cache_for(root) / "config.json"
    previous = config_path.read_text(encoding="utf-8") if config_path.exists() else None
    candidate_key = None
    if args.credential_stdin:
        if args.embeddings != "external":
            raise ValueError("Candidate credentials require --embeddings external.")
        candidate_key = sys.stdin.readline().strip()
        if not candidate_key:
            raise ValueError("The candidate credential cannot be empty.")
        os.environ["CBX_EMBEDDINGS_API_KEY"] = candidate_key
    config = read_config(root)
    embeddings = config.setdefault("embeddings", {})
    integration = config.setdefault("integration", {})
    if args.auto is not None:
        integration["auto_index"] = args.auto == "on"
    if args.embeddings == "off":
        embeddings.update(enabled=False, backend="noop", allow_external=False)
    elif args.embeddings:
        provider = args.embeddings
        model = args.model or embeddings.get("model")
        if provider == "ollama":
            model = args.model or OLLAMA_MODEL
        if not model:
            raise ValueError("Select a model with --model.")
        embeddings.update(
            enabled=True, backend="local" if provider == "local" else "external",
            model=model, allow_external=provider != "local",
        )
        integration["provider"] = provider
        if provider != "local":
            embeddings["endpoint"] = args.endpoint or (
                OLLAMA_ENDPOINT if provider == "ollama" else embeddings.get("endpoint")
            )
            validate_endpoint(embeddings.get("endpoint"), provider)
        dimension = test_provider(root, config)
        integration["dimension"] = dimension
    elif args.model or args.endpoint:
        raise ValueError("Use --embeddings local, ollama, or external when changing a model or endpoint.")
    write_json(config_path, config)
    if candidate_key is not None:
        try:
            write_text(cache_for(root) / "credentials.env", "CBX_EMBEDDINGS_API_KEY=" + candidate_key + "\n")
        except OSError:
            if previous is None:
                config_path.unlink(missing_ok=True)
            else:
                write_text(config_path, previous)
            raise
    emit({"saved": True, "config": config, "refresh": "automatic when enabled"})


def status(root):
    config = read_config(root)
    db_path = cache_for(root) / "index.sqlite"
    meta = {}
    if db_path.exists():
        with sqlite3.connect(db_path.as_uri() + "?mode=ro", uri=True) as conn:
            meta = dict(conn.execute("SELECT key, value FROM meta"))
    emit({
        "root": str(root), "config": config,
        "auto_index": config.get("integration", {}).get("auto_index", True),
        "index": {"exists": bool(meta.get("built_at")), **meta},
    })


def validate_endpoint(endpoint, provider):
    if not endpoint:
        raise ValueError("An embeddings endpoint is required.")
    parsed = urlsplit(endpoint)
    if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Use an HTTP(S) embeddings URL without embedded credentials.")
    if parsed.query or parsed.fragment:
        raise ValueError("Keep credentials out of endpoint URLs; query strings and fragments are not supported.")
    loopback = parsed.hostname in ("localhost", "127.0.0.1", "::1")
    if provider == "ollama" and not loopback:
        raise ValueError("The Ollama preset is loopback-only. Use external for a remote server.")
    if parsed.scheme == "http" and not loopback:
        raise ValueError("Remote embedding endpoints require HTTPS.")


def api_key(root, provider):
    if provider == "ollama":
        return "ollama"
    value = os.environ.get("CBX_EMBEDDINGS_API_KEY")
    path = cache_for(root) / "credentials.env"
    if not value and path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.startswith("CBX_EMBEDDINGS_API_KEY="):
                value = line.split("=", 1)[1]
    if not value:
        raise ValueError("Set CBX_EMBEDDINGS_API_KEY or use credential with hidden stdin input.")
    return value


def checked_vectors(vectors, count, dimension=None):
    if not isinstance(vectors, list) or len(vectors) != count:
        raise ValueError("The provider returned the wrong number of embeddings.")
    result = []
    for vector in vectors:
        if not isinstance(vector, list) or not vector:
            raise ValueError("The provider returned an empty embedding.")
        if dimension is None:
            dimension = len(vector)
        if len(vector) != dimension:
            raise ValueError("Embedding dimensions changed. Reconfigure the provider before refreshing.")
        if any(isinstance(x, bool) or not isinstance(x, (int, float)) or not math.isfinite(x) for x in vector):
            raise ValueError("The provider returned non-numeric or non-finite embedding values.")
        result.append([float(x) for x in vector])
    return result


def external_vectors(root, config, texts):
    embeddings = config["embeddings"]
    if not embeddings.get("enabled") or not embeddings.get("allow_external"):
        raise ValueError("External embeddings require enabled=true and allow_external=true.")
    provider = config.get("integration", {}).get("provider", "external")
    endpoint = embeddings.get("endpoint")
    validate_endpoint(endpoint, provider)
    body = json.dumps({"model": embeddings["model"], "input": texts}).encode()
    request = Request(endpoint, data=body, headers={
        "Authorization": "Bearer " + api_key(root, provider),
        "Content-Type": "application/json",
    }, method="POST")
    class NoRedirect(HTTPRedirectHandler):
        def redirect_request(self, request, file, code, message, headers, new_url):
            raise ValueError("Embedding endpoints must not redirect. Configure the final endpoint URL.")

    try:
        with build_opener(NoRedirect).open(request, timeout=60) as response:
            data = json.load(response)["data"]
        if not isinstance(data, list) or sorted(item["index"] for item in data) != list(range(len(texts))):
            raise ValueError("The provider returned invalid embedding indexes.")
        vectors = [item["embedding"] for item in sorted(data, key=lambda item: item["index"])]
        return checked_vectors(vectors, len(texts))
    except (KeyError, TypeError) as error:
        raise ValueError("Expected an OpenAI-compatible embeddings response with data[].embedding.") from error


def ensure_runtime():
    if importlib.util.find_spec("codebase_index"):
        return
    candidates = [os.environ.get("CBX_PYTHON")]
    executable = shutil.which("codebase-index")
    if executable:
        path = Path(executable).resolve()
        candidates.extend([str(path.parent / "python"), str(path.parent / "python.exe")])
        try:
            first = path.read_text(encoding="utf-8").splitlines()[0]
            if first.startswith("#!/"):
                candidates.append(first[2:])
        except (UnicodeError, OSError):
            pass
    for candidate in candidates:
        if not candidate or not Path(candidate).is_file():
            continue
        result = subprocess.run(
            [candidate, "-c", "import codebase_index"], capture_output=True, check=False,
        )
        if result.returncode == 0:
            os.execv(candidate, [candidate, str(Path(__file__).resolve()), *sys.argv[1:]])
    raise ValueError("codebase-index is unavailable. Install it or set CBX_PYTHON to its Python interpreter.")


def test_provider(root, config):
    embeddings = config.get("embeddings", {})
    if not embeddings.get("enabled", False):
        return None
    if embeddings.get("backend") == "external":
        return len(external_vectors(root, config, [PROBE])[0])
    ensure_runtime()
    from codebase_index.embeddings.local import LocalBackend
    backend = LocalBackend(model_name=embeddings["model"])
    return len(checked_vectors(backend.embed([PROBE]), 1)[0])


def signature(config):
    fields = {
        "embeddings": config.get("embeddings", {}),
        "provider": config.get("integration", {}).get("provider"),
        "dimension": config.get("integration", {}).get("dimension"),
    }
    return hashlib.sha256(json.dumps(fields, sort_keys=True).encode()).hexdigest()


def install_backend(root, config, disabled=False):
    from codebase_index.embeddings import backend as factory
    from codebase_index.indexer import pipeline
    original = factory.resolve_backend

    def resolve(cfg, warn=lambda message: None):
        if disabled or not cfg.embeddings.enabled:
            from codebase_index.embeddings.noop import NoopBackend
            return NoopBackend()
        if cfg.embeddings.backend == "external":
            provider = config.get("integration", {}).get("provider", "external")
            os.environ["CBX_EMBEDDINGS_API_KEY"] = api_key(root, provider)
        backend = original(cfg, warn=warn)
        if cfg.embeddings.backend == "external":
            dimension = config.get("integration", {}).get("dimension")
            if not dimension:
                dimension = test_provider(root, config)
            backend.dim = dimension
            backend.name += ":" + hashlib.sha256(cfg.embeddings.endpoint.encode()).hexdigest()[:16]

            def transport(endpoint, key, model, texts):
                vectors = []
                for start in range(0, len(texts), 16):
                    batch = texts[start:start + 16]
                    vectors.extend(checked_vectors(external_vectors(root, config, batch), len(batch), dimension))
                return vectors

            backend._transport = transport
        if getattr(backend, "enabled", False):
            if cfg.embeddings.backend == "local":
                dimension = config.get("integration", {}).get("dimension")
                backend.dim = len(checked_vectors(backend.embed([PROBE]), 1, dimension)[0])
            backend.name += f":dim={backend.dim}"
        return backend

    factory.resolve_backend = resolve
    pipeline.resolve_backend = resolve


def refresh(root, args):
    ensure_runtime()
    from codebase_index.config import load
    from codebase_index.indexer.pipeline import build_index, update_index
    from codebase_index.indexer.freshness import compute_freshness
    from codebase_index.storage import repo
    from codebase_index.storage.db import Database

    with maintenance_lock(root):
        config = read_config(root)
        if args.automatic and not config.get("integration", {}).get("auto_index", True):
            emit({"skipped": "automatic indexing disabled"})
            return
        cfg = load(root)
        install_backend(root, config)
        with Database(cache_for(root) / "index.sqlite") as db:
            changed_settings = repo.get_meta(db.conn, "config_hash") != cfg.config_hash()
            changed_vectors = repo.get_meta(db.conn, "integration_signature") != signature(config)
            fresh = compute_freshness(db.conn, root, cfg)
            pending = repo.get_meta(db.conn, "embedding_pending") == "1"
            if fresh.exists and not fresh.stale and not changed_settings and not changed_vectors and not pending and not args.rebuild:
                emit({"fresh": True})
                return
            try:
                if changed_vectors and cfg.embeddings.enabled:
                    tables = {row[0] for row in db.conn.execute("SELECT name FROM sqlite_master")}
                    if "vec_chunks" in tables:
                        db.enable_vectors()
                        db.conn.execute("DROP TABLE vec_chunks")
                    db.conn.execute("DROP TABLE IF EXISTS vec_meta")
                elif cfg.embeddings.enabled:
                    db.enable_vectors()
                    db.conn.execute("DELETE FROM vec_chunks")
                with redirect_stdout(sys.stderr):
                    stats = (
                        build_index(cfg, db, root=root)
                        if args.rebuild or changed_settings or changed_vectors or pending or not fresh.exists
                        else update_index(cfg, db, root=root)
                    )
                repo.set_meta(db.conn, "integration_signature", signature(config))
                repo.set_meta(db.conn, "embedding_pending", "0")
                repo.set_meta(db.conn, "integration_error", "")
                db.conn.commit()
                emit({"refreshed": True, "stats": asdict(stats)})
            except Exception as error:
                db.conn.rollback()
                if not cfg.embeddings.enabled:
                    raise
                print(f"codebase-index: embeddings failed; refreshing text/symbol index: {error}", file=sys.stderr)
                text_cfg = cfg.model_copy(deep=True)
                text_cfg.embeddings.enabled = False
                with redirect_stdout(sys.stderr):
                    build_index(text_cfg, db, root=root)
                repo.set_meta(db.conn, "config_hash", cfg.config_hash())
                repo.set_meta(db.conn, "embedding_pending", "1")
                repo.set_meta(db.conn, "integration_error", str(error))
                db.conn.commit()
                raise ValueError("Text/symbol index refreshed, but embeddings failed. Check the provider and retry.") from error


def query(root, args):
    if args.operation not in RETRIEVAL:
        raise ValueError("Retrieval allows only: " + ", ".join(RETRIEVAL))
    if not (cache_for(root) / "index.sqlite").exists():
        raise ValueError("Index missing. Automatic indexing has not completed; use targeted file lookups.")
    ensure_runtime()
    from codebase_index.cli import app
    from codebase_index.storage import repo
    with maintenance_lock(root):
        config = read_config(root)
        with sqlite3.connect((cache_for(root) / "index.sqlite").as_uri() + "?mode=ro", uri=True) as conn:
            built = repo.get_meta(conn, "built_at")
            current = repo.get_meta(conn, "integration_signature") == signature(config)
            pending = repo.get_meta(conn, "embedding_pending") == "1"
        if not built:
            raise ValueError("Index has no completed build. Use targeted file lookups.")
        disabled = pending or not current or not config.get("embeddings", {}).get("enabled", False)
        if disabled and any(arg == "vector" or arg == "--mode=vector" for arg in args.arguments):
            raise ValueError("Vector retrieval is unavailable until embeddings finish indexing.")
        install_backend(root, config, disabled=disabled)
        os.environ["CBX_NO_SKILL_AUTO_UPDATE"] = "1"
        app(args=["--root", str(root), args.operation, *args.arguments], standalone_mode=False)


def parser():
    result = argparse.ArgumentParser(description="Project-local codebase index controls")
    result.add_argument("--root")
    commands = result.add_subparsers(dest="command", required=True)
    commands.add_parser("status")
    configure_parser = commands.add_parser("configure")
    configure_parser.add_argument("--embeddings", choices=("off", "local", "ollama", "external"))
    configure_parser.add_argument("--model")
    configure_parser.add_argument("--endpoint")
    configure_parser.add_argument("--auto", choices=("on", "off"))
    configure_parser.add_argument("--credential-stdin", action="store_true")
    commands.add_parser("test-provider")
    commands.add_parser("credential")
    refresh_parser = commands.add_parser("refresh")
    refresh_parser.add_argument("--automatic", action="store_true")
    refresh_parser.add_argument("--rebuild", action="store_true")
    query_parser = commands.add_parser("query")
    query_parser.add_argument("operation")
    query_parser.add_argument("arguments", nargs=argparse.REMAINDER)
    return result


def main():
    os.environ.pop("CBX_DB_PATH", None)
    args = parser().parse_args()
    root = root_for(args.root)
    if args.command == "configure":
        with maintenance_lock(root):
            configure(root, args)
    elif args.command == "status":
        status(root)
    elif args.command == "refresh":
        refresh(root, args)
    elif args.command == "query":
        query(root, args)
    elif args.command == "test-provider":
        emit({"dimension": test_provider(root, read_config(root))})
    elif args.command == "credential":
        value = sys.stdin.readline().strip()
        if not value:
            raise ValueError("The credential cannot be empty.")
        write_text(cache_for(root) / "credentials.env", "CBX_EMBEDDINGS_API_KEY=" + value + "\n")
        emit({"credential_saved": True})


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, sqlite3.Error, ImportError, RuntimeError) as error:
        print(f"codebase-index: {error}", file=sys.stderr)
        sys.exit(1)
