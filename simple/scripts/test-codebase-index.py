import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import threading
import unittest


CONTROL = Path(__file__).with_name("codebase-index.py")


class IndexControlTests(unittest.TestCase):
    def setUp(self):
        directory = "/tmp/opencode" if Path("/tmp/opencode").is_dir() else None
        self.temp = tempfile.TemporaryDirectory(prefix="cbx-test-", dir=directory)
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / ".git").mkdir()
        self.cache = self.root / ".claude/cache/codebase-index"

    def run_control(self, *args, success=True, env=None):
        result = subprocess.run(
            [sys.executable, str(CONTROL), "--root", str(self.root), *args],
            capture_output=True, text=True, env={**os.environ, **(env or {})},
        )
        if success:
            self.assertEqual(result.returncode, 0, result.stderr)
        else:
            self.assertNotEqual(result.returncode, 0, result.stdout)
        return result

    def test_disabling_embeddings_preserves_unrelated_settings(self):
        self.cache.mkdir(parents=True)
        (self.cache / "config.json").write_text(json.dumps({
            "chunk": {"window_lines": 42},
            "embeddings": {"enabled": True, "backend": "local", "model": "custom-model"},
        }))
        self.run_control("configure", "--embeddings", "off", "--auto", "off")
        settings = json.loads(self.run_control("status").stdout)
        self.assertEqual(settings["config"]["chunk"], {"window_lines": 42})
        self.assertEqual(settings["config"]["embeddings"]["model"], "custom-model")
        self.assertFalse(settings["config"]["embeddings"]["enabled"])
        self.assertFalse(settings["config"]["integration"]["auto_index"])

    def test_refresh_builds_and_updates_without_implicit_query_builds(self):
        self.run_control("query", "search", "calculator", "--json", success=False)
        self.assertFalse((self.cache / "index.sqlite").exists())
        source = self.root / "calculator.py"
        source.write_text("def add(a, b):\n    return a + b\n")
        self.run_control("refresh", "--automatic")
        first = json.loads(self.run_control("query", "symbol", "add", "--json").stdout)
        self.assertTrue(first["index"]["exists"])
        source.write_text("def subtract(a, b):\n    return a - b\n")
        self.run_control("refresh", "--automatic")
        second = self.run_control("query", "symbol", "subtract", "--json")
        self.assertIn("subtract", second.stdout)
        self.assertFalse(json.loads(second.stdout)["index"]["stale"])
        for command in ("impact", "diff-impact", "architecture", "graph", "index", "update"):
            self.run_control("query", command, success=False)

    def provider(self, responder):
        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                payload = responder(body)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(payload).encode())

            def log_message(self, *args):
                pass

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        return f"http://127.0.0.1:{server.server_port}/v1/embeddings"

    def test_external_provider_indexes_and_replaces_different_dimension_vectors(self):
        def respond(body):
            dimension = 3 if body["model"] == "small" else 5
            return {"data": [
                {"index": index, "embedding": [0.5] * dimension}
                for index in reversed(range(len(body["input"])))
            ]}

        endpoint = self.provider(respond)
        (self.root / "calculator.py").write_text("def add(a, b):\n    return a + b\n")
        for model, dimension in (("small", 3), ("large", 5)):
            self.run_control("configure", "--embeddings", "ollama", "--model", model, "--endpoint", endpoint)
            self.run_control("refresh")
            result = self.run_control("query", "search", "addition", "--mode", "vector", "--json")
            self.assertIn("calculator.py", result.stdout)
            settings = json.loads(self.run_control("status").stdout)
            self.assertEqual(settings["config"]["integration"]["dimension"], dimension)

    def test_invalid_provider_does_not_replace_working_configuration(self):
        self.run_control("configure", "--embeddings", "off")
        endpoint = self.provider(lambda body: {"data": [{"index": 0, "embedding": []}]})
        self.run_control("configure", "--embeddings", "ollama", "--endpoint", endpoint, success=False)
        config = json.loads(self.run_control("status").stdout)["config"]
        self.assertFalse(config["embeddings"]["enabled"])

    def test_disabled_auto_indexing_leaves_missing_index_untouched(self):
        self.run_control("configure", "--auto", "off")
        self.run_control("refresh", "--automatic")
        self.assertFalse((self.cache / "index.sqlite").exists())

    def test_provider_failure_preserves_text_retrieval_and_recovers(self):
        available = [True]

        def respond(body):
            if not available[0]:
                return {"data": []}
            return {"data": [{"index": index, "embedding": [0.2, 0.5, 0.9]}
                             for index in range(len(body["input"]))]}

        endpoint = self.provider(respond)
        (self.root / "calculator.py").write_text("def add(a, b):\n    return a + b\n")
        self.run_control("configure", "--embeddings", "ollama", "--endpoint", endpoint)
        self.run_control("refresh")
        available[0] = False
        (self.root / "calculator.py").write_text("def subtract(a, b):\n    return a - b\n")
        self.run_control("refresh", success=False)
        self.assertIn("subtract", self.run_control("query", "symbol", "subtract", "--json").stdout)
        self.run_control("query", "search", "subtract", "--mode", "vector", "--json", success=False)
        available[0] = True
        self.run_control("refresh")
        self.assertIn("calculator.py", self.run_control("query", "search", "subtract", "--mode", "vector", "--json").stdout)

    def test_remote_endpoints_require_https_and_keys_never_appear_in_status(self):
        self.run_control("configure", "--embeddings", "external", "--endpoint", "http://example.com/v1/embeddings",
                         "--model", "code-model", success=False)
        saved = subprocess.run([sys.executable, str(CONTROL), "--root", str(self.root), "credential"],
                               input="private-test-key\n", text=True, capture_output=True)
        self.assertEqual(saved.returncode, 0, saved.stderr)
        self.assertNotIn("private-test-key", self.run_control("status").stdout)
        if os.name != "nt":
            self.assertEqual((self.cache / "credentials.env").stat().st_mode & 0o777, 0o600)

    def test_bash_wrapper_resolves_checkout_when_launched_from_nested_directory(self):
        if not shutil.which("bash"):
            self.skipTest("Bash unavailable")
        subprocess.run(["git", "init", "--quiet", str(self.root)], check=True)
        scripts = self.root / "scripts"
        scripts.mkdir()
        for name in ("codebase-index.sh", "codebase-index.py"):
            shutil.copy(CONTROL.with_name(name), scripts / name)
        nested = self.root / "app/nested"
        nested.mkdir(parents=True)
        result = subprocess.run(["bash", str(scripts / "codebase-index.sh"), "status"],
                                cwd=nested, text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)["root"], str(self.root))

    def test_retrieval_commands_and_parallel_refreshes_share_one_checkout(self):
        (self.root / "calculator.py").write_text("def add(a, b):\n    return a + b\n\ndef total(a, b):\n    return add(a, b)\n")
        command = [sys.executable, str(CONTROL), "--root", str(self.root), "refresh"]
        processes = [subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True) for _ in range(2)]
        for process in processes:
            stdout, stderr = process.communicate(timeout=30)
            self.assertEqual(process.returncode, 0, stderr)
        for operation, arguments in (("search", ["addition"]), ("symbol", ["add"]), ("refs", ["add"]),
                                     ("explain", ["addition"]), ("describe", ["calculator.py"]),
                                     ("path", ["total", "add"])):
            self.assertIsInstance(json.loads(self.run_control("query", operation, *arguments, "--json").stdout), dict)
        (self.root / "calculator.py").unlink()
        self.run_control("refresh")
        self.assertNotIn('"name": "add"', self.run_control("query", "symbol", "add", "--json").stdout)

    def test_local_model_indexes_with_dimension_known_before_vector_table_creation(self):
        model = self.root / ".model-fixture"
        model.mkdir()
        (model / "sentence_transformers.py").write_text(
            "class SentenceTransformer:\n"
            "    def __init__(self, name): pass\n"
            "    def get_sentence_embedding_dimension(self): return 3\n"
            "    def encode(self, texts, **kwargs): return [[0.2, 0.5, 0.9] for text in texts]\n"
        )
        env = {"PYTHONPATH": str(model)}
        (self.root / "calculator.py").write_text("def add(a, b):\n    return a + b\n")
        self.run_control("configure", "--embeddings", "local", "--model", "fixture-model", env=env)
        self.run_control("refresh", env=env)
        result = self.run_control("query", "search", "addition", "--mode", "vector", "--json", env=env)
        self.assertIn("calculator.py", result.stdout)

    def test_candidate_credential_is_saved_only_after_successful_validation(self):
        command = [sys.executable, str(CONTROL), "--root", str(self.root)]
        subprocess.run([*command, "credential"], input="old-key\n", text=True, check=True, capture_output=True)
        good = [False]
        endpoint = self.provider(lambda body: {"data": [
            {"index": index, "embedding": [0.2, 0.5, 0.9] if good[0] else []}
            for index in range(len(body["input"]))
        ]})
        for available in (False, True):
            good[0] = available
            result = subprocess.run([*command, "configure", "--embeddings", "external", "--model", "fixture-model",
                                     "--endpoint", endpoint, "--credential-stdin"],
                                    input="new-key\n", text=True, capture_output=True)
            self.assertEqual(result.returncode == 0, available, result.stderr)
            self.assertEqual((self.cache / "credentials.env").read_text(),
                             "CBX_EMBEDDINGS_API_KEY=" + ("new-key" if available else "old-key") + "\n")

    def test_declining_bash_wizard_keeps_active_credential(self):
        if not shutil.which("bash"):
            self.skipTest("Bash unavailable")
        subprocess.run(["git", "init", "--quiet", str(self.root)], check=True)
        scripts = self.root / "scripts"
        scripts.mkdir()
        for name in ("codebase-index.py", "codebase-index.sh", "setup-codebase-index.sh"):
            shutil.copy(CONTROL.with_name(name), scripts / name)
        self.cache.mkdir(parents=True)
        (self.cache / "credentials.env").write_text("CBX_EMBEDDINGS_API_KEY=old-key\n")
        answers = "\n\non\nexternal\nhttps://example.com/v1/embeddings\nfixture-model\nnew-key\nn\n"
        result = subprocess.run(["bash", str(scripts / "setup-codebase-index.sh")],
                                input=answers, text=True, capture_output=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.cache / "credentials.env").read_text(), "CBX_EMBEDDINGS_API_KEY=old-key\n")

    @unittest.skipUnless(os.environ.get("CBX_TEST_OLLAMA") == "1", "Set CBX_TEST_OLLAMA=1 for the installed Jina model")
    def test_installed_ollama_model_supports_real_vector_retrieval(self):
        (self.root / "calculator.py").write_text("def add(a, b):\n    return a + b\n")
        self.run_control("configure", "--embeddings", "ollama")
        self.run_control("refresh")
        result = self.run_control("query", "search", "add two numbers", "--mode", "vector", "--json")
        self.assertIn("calculator.py", result.stdout)
        settings = json.loads(self.run_control("status").stdout)
        self.assertEqual(settings["config"]["integration"]["dimension"], 768)


if __name__ == "__main__":
    unittest.main()
