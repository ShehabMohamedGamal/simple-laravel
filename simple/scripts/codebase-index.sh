#!/usr/bin/env bash
set -euo pipefail

script_dir=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
root=$(git -C "$script_dir" rev-parse --show-toplevel)
if [[ -n "${CBX_PYTHON:-}" ]]; then
    python_bin=$CBX_PYTHON
elif command -v python3 >/dev/null 2>&1; then
    python_bin=python3
else
    python_bin=python
fi
export CBX_NO_SKILL_AUTO_UPDATE=1
exec "$python_bin" "$script_dir/codebase-index.py" --root "$root" "$@"
