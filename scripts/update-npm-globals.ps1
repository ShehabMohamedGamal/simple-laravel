<#
Update every globally installed npm package to its latest version.
One npm outdated -g call finds the stale set; each stale package is then
reinstalled with npm install -g <name>@latest. -Check prints the stale
set and exits without updating.

Usage: update-npm-globals.ps1 [-Check]
#>
[CmdletBinding()]
param([switch]$Check)

$ErrorActionPreference = "Stop"

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw "npm is not on PATH." }

# npm outdated exits 0 when everything is current, 1 when the stale set is
# printed, and anything else only on a real failure. It chatters on stderr,
# so relax the error preference and recombine the streams as text.
$previous = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$raw = (& npm outdated -g --json 2>&1 | ForEach-Object { "$_" }) -join "`n"
$code = $LASTEXITCODE
$ErrorActionPreference = $previous

if (($code -gt 1) -or (($code -ne 0) -and -not $raw)) {
    throw "npm outdated failed (exit ${code}): $raw"
}

$stale = @()
if ($raw) {
    try { $stale = @(($raw | ConvertFrom-Json).PSObject.Properties) }
    catch { throw "could not parse npm outdated output as JSON: $raw" }
}

if ($stale.Count -eq 0) {
    Write-Host "ok: all global npm packages are up to date"
    exit 0
}

Write-Host "outdated global npm packages:"
foreach ($pkg in $stale) {
    Write-Host ("  {0}: {1} -> {2}" -f $pkg.Name, $pkg.Value.current, $pkg.Value.latest)
}

if ($Check) {
    Write-Host "check only; rerun without -Check to update"
    exit 0
}

$updated = 0
$failed = 0
foreach ($pkg in $stale) {
    $name = $pkg.Name
    Write-Host "== npm install -g ${name}@latest =="
    & npm install -g "${name}@latest"
    if ($LASTEXITCODE -eq 0) { $updated++ }
    else {
        Write-Warning "npm install -g ${name}@latest failed"
        $failed++
    }
}

Write-Host ""
Write-Host "summary: $updated updated, $failed failed"
if ($failed -gt 0) { exit 1 }
