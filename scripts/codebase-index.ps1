param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Arguments
)

$ErrorActionPreference = "Stop"
$root = & git -C $PSScriptRoot rev-parse --show-toplevel
if ($LASTEXITCODE -ne 0) { throw "Cannot locate the Git checkout." }
$env:CBX_NO_SKILL_AUTO_UPDATE = "1"
$python = $env:CBX_PYTHON
if (-not $python) {
    $candidate = Get-Command python3, python -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $candidate) { throw "Install Python or set CBX_PYTHON to its executable." }
    $python = $candidate.Source
}
& $python (Join-Path $PSScriptRoot "codebase-index.py") --root $root @Arguments
exit $LASTEXITCODE
