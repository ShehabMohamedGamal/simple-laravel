#!/usr/bin/env bash
# Install this repo's beads convention into another repository and set it up
# for team use: the tracker doc, the triage label vocabulary, the beads skill,
# and the custom ticket types; the sync remote; the per-machine gitignore
# rule; a first hydration; and opt-in auto-sync git hooks so bd dolt push
# runs on git push and bd dolt pull runs on git pull. Run from inside
# simple-template against a target repo path.
#
# Prompts fall back to their defaults on Enter (or EOF), so piping answers in
# works for scripted runs; --origin and --types skip their prompts entirely.
#
# Usage: init-beads-convention.sh <target-repo> [--force] [--memory-gate]
#                                  [--origin URL] [--types "a,b,c"]
set -euo pipefail

usage() {
  echo "usage: $0 <target-repo> [--force] [--memory-gate] [--origin URL] [--types \"a,b,c\"]" >&2
  exit 2
}

die() { echo "error: $*" >&2; exit 1; }
ok() { echo "ok: $*"; }
warn() { echo "warn: $*" >&2; }

# ask VAR "prompt": read one line into VAR (empty on EOF); caller defaults.
ask() {
  local __var="$1" __prompt="$2" __reply=""
  printf '%s' "$__prompt"
  read -r __reply || true
  printf -v "$__var" '%s' "$__reply"
}

# confirm "question": y/N gate; success on yes, EOF counts as no.
confirm() {
  local __reply=""
  printf '? %s [y/N] ' "$1"
  read -r __reply || true
  case "$__reply" in
    [Yy]*) return 0 ;;
    *) return 1 ;;
  esac
}

# validate_types "a,b,c": custom type tokens are letters, digits, dot,
# underscore, and dash, comma-separated, no spaces.
validate_types() {
  printf '%s' "$1" | grep -qE '^[A-Za-z0-9._-]+(,[A-Za-z0-9._-]+)*$'
}

STAGE_TOTAL=7
STAGE_N=0
stage() {
  STAGE_N=$((STAGE_N + 1))
  printf '\n== stage %s/%s: %s ==\n' "$STAGE_N" "$STAGE_TOTAL" "$1"
}

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET=""
FORCE=0
MEMORY_GATE=0
ORIGIN=""
TYPES=""

while [ $# -gt 0 ]; do
  case "$1" in
    --force) FORCE=1 ;;
    --memory-gate) MEMORY_GATE=1 ;;
    --origin)
      [ $# -ge 2 ] || die "--origin needs a URL argument"
      [ -z "$ORIGIN" ] || die "--origin given more than once"
      ORIGIN="$2"
      shift
      ;;
    --types)
      [ $# -ge 2 ] || die "--types needs a comma-separated list argument"
      [ -z "$TYPES" ] || die "--types given more than once"
      TYPES="$2"
      shift
      ;;
    -h|--help) usage ;;
    -*) die "unknown option: $1" ;;
    *)
      [ -z "$TARGET" ] || die "exactly one target repo expected"
      TARGET="$1"
      ;;
  esac
  shift
done
[ -n "$TARGET" ] || usage

command -v bd >/dev/null || die "bd is not on PATH"
[ -d "$SRC/docs/agents" ] || die "source repo layout not found under $SRC"
[ -d "$TARGET" ] || die "target directory does not exist: $TARGET"
TARGET="$(cd "$TARGET" && pwd)"
[ -d "$TARGET/.git" ] || warn "target is not a git repo; bd dolt sync needs one later"

# bd init seeds its own AGENTS.md boilerplate (which recommends bd remember,
# banned by this convention), so track whether we let it create the file.
AGENTS_EXISTED=1
[ -f "$TARGET/AGENTS.md" ] || AGENTS_EXISTED=0

# ── stage 1: beads store ─────────────────────────────────────────────────
stage "beads store"
if [ -f "$TARGET/.beads/metadata.json" ]; then
  ok "bd store already initialized"
else
  PREFIX_CHOICE=""
  ask PREFIX_CHOICE "Issue prefix [Enter = auto-detect from the directory name]: "
  INIT_ARGS=(--non-interactive --init-if-missing)
  if [ -n "$PREFIX_CHOICE" ]; then
    INIT_ARGS+=(-p "$PREFIX_CHOICE")
  fi
  (cd "$TARGET" && bd init "${INIT_ARGS[@]}" >/dev/null)
  ok "bd init"
fi

# bd's hook shims (installed by bd init under its own hooksPath) chain to
# .git/hooks, and plain git runs .git/hooks when no other hooksPath is set.
# Either way the auto-sync hooks written in stage 7 fire; nothing to wire here.

PREFIX="$(cd "$TARGET" && bd config get issue_prefix)"
[ -n "$PREFIX" ] || die "could not read issue prefix from target store"
case "$PREFIX" in
  *[!A-Za-z0-9._-]*) die "unexpected issue prefix: $PREFIX" ;;
esac

# ── stage 2: custom ticket types ─────────────────────────────────────────
stage "custom ticket types"
DEFAULT_TYPES="wayfinder,spec,implementation,review"
if [ -n "$TYPES" ]; then
  ok "using --types: $TYPES"
else
  TYPES_INPUT=""
  ask TYPES_INPUT "Custom ticket types [Enter = $DEFAULT_TYPES]: "
  TYPES="${TYPES_INPUT:-$DEFAULT_TYPES}"
fi
validate_types "$TYPES" || die "invalid types list: '$TYPES' (comma-separated tokens of letters, digits, dot, underscore, dash)"
(cd "$TARGET" && bd config set types.custom "$TYPES" >/dev/null 2>&1)
STORED_TYPES="$(cd "$TARGET" && bd config get types.custom)"
FIRST_TYPE="${TYPES%%,*}"
case "$STORED_TYPES" in
  *"$FIRST_TYPE"*) ok "custom types set: $STORED_TYPES" ;;
  *) die "types.custom did not stick; bd config get returns '$STORED_TYPES'" ;;
esac

# ── stage 3: sync remote ─────────────────────────────────────────────────
stage "sync remote"
if [ -n "$ORIGIN" ]; then
  ok "using --origin: $ORIGIN"
else
  ORIGIN_INPUT=""
  ask ORIGIN_INPUT "Remote origin for beads sync, e.g. git+https://github.com/org/repo.git [Enter = skip]: "
  ORIGIN="$ORIGIN_INPUT"
fi
SYNC_SET=0
if [ -n "$ORIGIN" ]; then
  case "$ORIGIN" in
    git+https://*|git+ssh://*|https://doltremoteapi.dolthub.com/*|az://*) ;;
    *) warn "unusual origin format; bd dolt push/pull accept git+https://, git+ssh://, DoltHub, or az:// remotes" ;;
  esac
  (cd "$TARGET" && bd config set sync.remote "$ORIGIN" >/dev/null)
  SET_REMOTE="$(cd "$TARGET" && bd config get sync.remote)"
  [ "$SET_REMOTE" = "$ORIGIN" ] || die "sync.remote did not stick; bd config get returns '$SET_REMOTE'"
  ok "sync.remote set: $ORIGIN"
  SYNC_SET=1
else
  warn "no origin given; skipping sync.remote (bd dolt push/pull will not work until it is set)"
fi

# ── stage 4: gitignore and the committed mirror ──────────────────────────
stage "gitignore and committed mirror"
GITIGNORE="$TARGET/.gitignore"
touch "$GITIGNORE"
if grep -qxF ".beads/config.yaml" "$GITIGNORE"; then
  ok ".beads/config.yaml already ignored"
else
  {
    echo ""
    echo "# Beads per-machine config (managed by init-beads-convention.sh)"
    echo ".beads/config.yaml"
  } >>"$GITIGNORE"
  ok "ignored .beads/config.yaml in .gitignore (per-machine config stays local)"
fi
if git -C "$TARGET" check-ignore -q ".beads/issues.jsonl"; then
  warn ".beads/issues.jsonl is ignored; the committed ticket mirror will not be shared"
else
  ok ".beads/issues.jsonl stays tracked (the committed ticket mirror)"
fi
(cd "$TARGET" && bd config set export.auto true >/dev/null 2>&1)
EXPORT_AUTO="$(cd "$TARGET" && bd config get export.auto)"
if [ "$EXPORT_AUTO" = "true" ]; then
  ok "export.auto enabled (.beads/issues.jsonl refreshes after writes)"
else
  warn "export.auto did not stick; the mirror will not refresh automatically"
fi

# ── stage 5: hydration ───────────────────────────────────────────────────
stage "hydration"
HYDRATION="skipped"
store_has_issues() {
  local out
  out="$(cd "$TARGET" && bd list --json 2>/dev/null || true)"
  case "$out" in
    *'"id"'*) return 0 ;;
    *) return 1 ;;
  esac
}
if store_has_issues; then
  HYDRATION="store already had issues"
  ok "$HYDRATION; nothing to hydrate"
elif [ "$SYNC_SET" -ne 1 ]; then
  warn "no sync remote; cannot pull tickets from the team remote"
  HYDRATION="no sync remote"
else
  if confirm "Pull tickets from the remote now (bd dolt pull)?"; then
    if (cd "$TARGET" && bd dolt pull); then
      HYDRATION="pulled from remote"
      ok "$HYDRATION"
    else
      warn "bd dolt pull failed (no refs on the remote yet?)"
      HYDRATION="pull failed"
    fi
  else
    HYDRATION="pull declined"
  fi
fi
if ! store_has_issues && [ -f "$TARGET/.beads/issues.jsonl" ]; then
  if confirm "Import the committed .beads/issues.jsonl mirror into the store (bd import)?"; then
    if (cd "$TARGET" && bd import -i .beads/issues.jsonl); then
      HYDRATION="imported from issues.jsonl mirror"
      ok "$HYDRATION"
    else
      warn "bd import failed; hydrate later with: bd import -i .beads/issues.jsonl"
      HYDRATION="import failed"
    fi
  fi
fi

# ── stage 6: convention files ────────────────────────────────────────────
stage "convention files"

install_doc() {
  local src="$1" dst="$2"
  if [ -e "$dst" ] && [ "$FORCE" -ne 1 ]; then
    warn "exists, skipping (use --force to overwrite): $dst"
    return
  fi
  mkdir -p "$(dirname "$dst")"
  if [ "$MEMORY_GATE" -eq 1 ]; then
    sed -E -e "s|simple-template-xxx|${PREFIX}-xxx|g" "$src" >"$dst"
  else
    # Drop the gate path reference when the gate itself is not installed.
    sed -E -e "s|simple-template-xxx|${PREFIX}-xxx|g" \
      -e 's| \(`\.opencode/gates/no-memory\.sh`\)||' "$src" >"$dst"
  fi
  ok "wrote $dst"
}

install_doc "$SRC/docs/agents/issue-tracker.md" "$TARGET/docs/agents/issue-tracker.md"
install_doc "$SRC/docs/agents/triage-labels.md" "$TARGET/docs/agents/triage-labels.md"

install_skill_file() {
  local src="$1" dst="$2"
  if [ -e "$dst" ] && [ "$FORCE" -ne 1 ]; then
    warn "exists, skipping (use --force to overwrite): $dst"
    return
  fi
  mkdir -p "$(dirname "$dst")"
  cp "$src" "$dst"
  ok "wrote $dst"
}

# bd init seeds its own generic beads skill; ours defers to the tracker doc.
# Overwrite any skill that lacks our marker; leave ours alone unless --force.
SKILL_DST="$TARGET/.agents/skills/beads/SKILL.md"
if [ -f "$SKILL_DST" ] && grep -qF "It is the single source; follow it" "$SKILL_DST" && [ "$FORCE" -ne 1 ]; then
  warn "convention skill already installed, skipping (use --force to overwrite): $SKILL_DST"
else
  mkdir -p "$(dirname "$SKILL_DST")"
  cp "$SRC/.agents/skills/beads/SKILL.md" "$SKILL_DST"
  cp "$SRC/.agents/skills/beads/agents/openai.yaml" "$TARGET/.agents/skills/beads/agents/openai.yaml"
  ok "wrote $SKILL_DST and agents/openai.yaml"
fi

MARKER='### Beads (`bd`) issue tracker'
write_stanzas() {
  cat <<'EOF'
### Beads (`bd`) issue tracker: `docs/agents/issue-tracker.md`

Issues live in beads, a local store under `.beads/`, operated via the `bd` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage roles are native beads labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`); set with `bd create -l` / `bd label add`, filter with `bd list -l <role>`. See `docs/agents/triage-labels.md`.
EOF
}
if [ "$AGENTS_EXISTED" -eq 0 ]; then
  # bd init just created this file and its boilerplate recommends bd remember,
  # which this convention bans; replace it outright.
  write_stanzas >"$TARGET/AGENTS.md"
  ok "replaced bd-generated AGENTS.md with the convention stanzas"
else
  # Strip bd's managed blocks from a pre-existing AGENTS.md; they recommend
  # bd remember, banned by this convention. User content is preserved.
  TMP_AGENTS="$(mktemp)"
  awk '
    /<!-- BEGIN BEADS/ {skip=1; next}
    /<!-- END BEADS/ {skip=0; next}
    !skip
  ' "$TARGET/AGENTS.md" | cat -s >"$TMP_AGENTS"
  if ! cmp -s "$TMP_AGENTS" "$TARGET/AGENTS.md"; then
    mv "$TMP_AGENTS" "$TARGET/AGENTS.md"
    ok "stripped bd-managed blocks from AGENTS.md"
  else
    rm -f "$TMP_AGENTS"
  fi
  if grep -qF "$MARKER" "$TARGET/AGENTS.md"; then
    ok "AGENTS.md already carries the beads stanzas"
  else
    {
      echo ""
      write_stanzas
    } >>"$TARGET/AGENTS.md"
    ok "appended beads stanzas to AGENTS.md"
  fi
fi

# ── stage 7: auto-sync git hooks ─────────────────────────────────────────
stage "auto-sync git hooks"
HOOK_MARKER="# managed by init-beads-convention.sh"
HOOKS_RESULT="not installed"
HOOKS_DIR=""

install_hook() {
  local name="$1" command="$2" purpose="$3"
  local hook="$HOOKS_DIR/$name"
  if [ -e "$hook" ]; then
    if grep -qF "$HOOK_MARKER" "$hook"; then
      ok "$name already managed; refreshing"
    elif [ "$FORCE" -eq 1 ]; then
      warn "overwriting existing $name hook (--force)"
    else
      warn "existing $name hook is not ours; skipping (use --force to overwrite)"
      return 0
    fi
  fi
  cat >"$hook" <<EOF
#!/bin/sh
$HOOK_MARKER ($purpose)
command -v bd >/dev/null 2>&1 || exit 0
sync_remote="\$(sed -n 's/^sync\.remote: "\(..*\)"\$/\1/p' .beads/config.yaml 2>/dev/null)"
[ -n "\$sync_remote" ] || exit 0
$command >/dev/null 2>&1 || echo "beads: $command failed; run it manually" >&2
exit 0
EOF
  chmod +x "$hook"
  ok "wrote $hook ($command)"
}

patch_sync_doc() {
  local doc="$1" tmp
  if [ ! -f "$doc" ]; then
    warn "tracker doc not found at $doc; skipped the auto-sync note"
    return 0
  fi
  if grep -qF '**Auto-sync**' "$doc"; then
    ok "tracker doc already carries the auto-sync note"
    return 0
  fi
  tmp="$(mktemp)"
  awk '
    /^- \*\*Sync\*\*:/ && !patched {
      print
      print "- **Auto-sync**: this repo opted into auto-sync hooks: `git push` runs `bd dolt push` (pre-push) and pulls run `bd dolt pull` (post-merge, post-rewrite). Ticket data syncs without a manual step."
      patched=1
      next
    }
    { print }
  ' "$doc" >"$tmp"
  mv "$tmp" "$doc"
  ok "documented auto-sync in $doc"
}

if git -C "$TARGET" rev-parse --git-dir >/dev/null 2>&1; then
  GIT_DIR="$(git -C "$TARGET" rev-parse --git-dir)"
  case "$GIT_DIR" in
    /*) ;;
    *) GIT_DIR="$TARGET/$GIT_DIR" ;;
  esac
  HOOKS_DIR="$GIT_DIR/hooks"
else
  warn "target is not a git repo; hooks skipped"
fi
if [ -n "$HOOKS_DIR" ]; then
  if confirm "Install auto-sync git hooks? On git push, pre-push runs bd dolt push (tickets go up before code: a failed code push leaves tickets already pushed). On git pull, post-merge and post-rewrite run bd dolt pull."; then
    mkdir -p "$HOOKS_DIR"
    install_hook pre-push "bd dolt push" "push tickets to the beads remote"
    install_hook post-merge "bd dolt pull" "pull tickets after git pull"
    install_hook post-rewrite "bd dolt pull" "pull tickets after git pull --rebase"
    HOOKS_RESULT="installed in $HOOKS_DIR"
    patch_sync_doc "$TARGET/docs/agents/issue-tracker.md"
  else
    HOOKS_RESULT="declined"
  fi
fi

if [ "$MEMORY_GATE" -eq 1 ]; then
  install_skill_file "$SRC/.opencode/gates/no-memory.sh" "$TARGET/.opencode/gates/no-memory.sh"
  chmod +x "$TARGET/.opencode/gates/no-memory.sh"
  install_skill_file "$SRC/.opencode/plugins/no-memory.ts" "$TARGET/.opencode/plugins/no-memory.ts"
  warn "memory gate copied but not wired: register no-memory.sh as a PreToolUse hook on Bash in .zcode/config.json, and keep .opencode/plugins/no-memory.ts for opencode sessions"
fi

echo
echo "done. verify with: cd $TARGET && bd types"
echo "summary:"
echo "  issue prefix: $PREFIX"
echo "  custom types: $STORED_TYPES"
if [ "$SYNC_SET" -eq 1 ]; then
  echo "  sync remote:  $ORIGIN"
else
  echo "  sync remote:  not set (bd dolt push/pull will not work until it is)"
fi
echo "  gitignore:    .beads/config.yaml ignored; .beads/issues.jsonl mirror tracked (export.auto on)"
echo "  hydration:    $HYDRATION"
echo "  hooks:        $HOOKS_RESULT"
