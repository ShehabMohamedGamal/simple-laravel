<#
init-beads-convention.ps1 - PowerShell port of scripts/init-beads-convention.sh.

Install this repo's beads convention into another repository and set it up for
team use: the tracker doc, the triage label vocabulary, the beads skill, and
the custom ticket types; the sync remote; the per-machine gitignore rule; a
first hydration; and opt-in auto-sync git hooks so bd dolt push runs on git
push and bd dolt pull runs on git pull. Run from inside a checkout of this
template against a target repo path.

Prompts fall back to their defaults on Enter. Pass -Origin and -Types to skip
those prompts, and -Yes to accept the hydration and hook confirms, so a
scripted run never blocks on input.

Windows PowerShell 5.1 compatible. Run with:
  powershell -ExecutionPolicy Bypass -File scripts\init-beads-convention.ps1 <target-repo> [-Force] [-MemoryGate] [-Origin <url>] [-Types "a,b,c"] [-Yes]
or on pwsh:
  pwsh -File scripts/init-beads-convention.ps1 <target-repo> [-Force] [-MemoryGate] [-Origin <url>] [-Types "a,b,c"] [-Yes]
#>
param(
  [Parameter(Position = 0)]
  [string]$Target,
  [switch]$Force,
  [switch]$MemoryGate,
  [string]$Origin,
  [string]$Types,
  [switch]$Yes
)

$ErrorActionPreference = 'Stop'
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$DefaultTypes = 'wayfinder,spec,implementation,review'
$script:StageN = 0
$StageTotal = 7

function Die([string]$Message) {
  [Console]::Error.WriteLine("error: $Message")
  exit 1
}
function Ok([string]$Message) { Write-Host "ok: $Message" }
function Warn([string]$Message) { Write-Warning $Message }

function Show-Usage {
  Write-Host 'usage: init-beads-convention.ps1 <target-repo> [-Force] [-MemoryGate] [-Origin <url>] [-Types "a,b,c"] [-Yes]'
  exit 2
}

# Ask "prompt": read one line (empty on EOF in most hosts); caller defaults.
function Ask([string]$Prompt) {
  Write-Host -NoNewline $Prompt
  return (Read-Host)
}

# Confirm "question": y/N gate; success on yes, empty counts as no.
function Confirm([string]$Question) {
  $reply = Read-Host "? $Question [y/N]"
  return ($reply -match '^[Yy]')
}

function Stage([string]$Name) {
  $script:StageN++
  Write-Host ("`n== stage {0}/{1}: {2} ==" -f $script:StageN, $StageTotal, $Name)
}

# TrimTrailing: strip trailing CR/LF only, so value comparisons stay verbatim.
function TrimTrailing([string]$Text) {
  return $Text.TrimEnd([char]13, [char]10)
}

function Write-TextNoBom([string]$Path, [string]$Text) {
  [System.IO.File]::WriteAllText($Path, $Text, $Utf8NoBom)
}

function In-Target {
  param([Parameter(Mandatory = $true)][scriptblock]$Body)
  Push-Location -LiteralPath $Target
  try { return & $Body } finally { Pop-Location }
}

function Get-BdConfig([string]$Key) {
  In-Target { TrimTrailing (& bd config get $Key 2>$null | Out-String) }
}

function Set-BdConfig([string]$Key, [string]$Value) {
  In-Target { & bd config set $Key $Value 2>&1 | Out-Null } | Out-Null
  return ($LASTEXITCODE -eq 0)
}

# Test-TypeList: type tokens are letters, digits, dot, underscore, and dash,
# comma-separated, no spaces.
function Test-TypeList([string]$List) {
  return ($List -match '^[A-Za-z0-9._-]+(,[A-Za-z0-9._-]+)*$')
}

function Test-StoreHasIssues {
  $json = In-Target { & bd list --json 2>$null | Out-String }
  return ($json -match '"id"')
}

function Install-Doc([string]$SrcFile, [string]$Dst) {
  if ((Test-Path -LiteralPath $Dst) -and -not $Force) {
    Warn "exists, skipping (use -Force to overwrite): $Dst"
    return
  }
  $dstDir = Split-Path -Parent $Dst
  if (-not (Test-Path -LiteralPath $dstDir)) { New-Item -ItemType Directory -Path $dstDir -Force | Out-Null }
  $text = [System.IO.File]::ReadAllText($SrcFile)
  $text = $text.Replace('simple-template-xxx', "$prefix-xxx")
  if (-not $MemoryGate) {
    # Drop the gate path reference when the gate itself is not installed.
    $text = $text -replace ' \(`\.opencode/gates/no-memory\.sh`\)', ''
  }
  Write-TextNoBom $Dst $text
  Ok "wrote $Dst"
}

function Install-File([string]$SrcFile, [string]$Dst) {
  if ((Test-Path -LiteralPath $Dst) -and -not $Force) {
    Warn "exists, skipping (use -Force to overwrite): $Dst"
    return
  }
  $dstDir = Split-Path -Parent $Dst
  if (-not (Test-Path -LiteralPath $dstDir)) { New-Item -ItemType Directory -Path $dstDir -Force | Out-Null }
  Copy-Item -LiteralPath $SrcFile -Destination $Dst -Force
  Ok "wrote $Dst"
}

function Install-Hook([string]$Name, [string]$BdCommand, [string]$Purpose) {
  $hookPath = Join-Path $hooksDir $Name
  if (Test-Path -LiteralPath $hookPath) {
    $existing = [System.IO.File]::ReadAllText($hookPath)
    if ($existing.Contains($hookMarker)) {
      Ok "$Name already managed; refreshing"
    } elseif ($Force) {
      Warn "overwriting existing $Name hook (-Force)"
    } else {
      Warn "existing $Name hook is not ours; skipping (use -Force to overwrite)"
      return
    }
  }
  $lines = @(
    '#!/bin/sh'
    "$hookMarker ($Purpose)"
    'command -v bd >/dev/null 2>&1 || exit 0'
    'sync_remote="$(sed -n ''s/^sync\.remote: "\(..*\)"$/\1/p'' .beads/config.yaml 2>/dev/null)"'
    '[ -n "$sync_remote" ] || exit 0'
    "$BdCommand >/dev/null 2>&1 || echo `"beads: $BdCommand failed; run it manually`" >&2"
    'exit 0'
  )
  Write-TextNoBom $hookPath (($lines -join "`n") + "`n")
  if (([System.Environment]::OSVersion.Platform.ToString() -notlike 'Win*') -and (Get-Command chmod -ErrorAction SilentlyContinue)) {
    & chmod +x $hookPath 2>$null
  }
  Ok "wrote $hookPath ($BdCommand)"
}

function Patch-SyncDoc([string]$DocPath) {
  if (-not (Test-Path -LiteralPath $DocPath)) {
    Warn "tracker doc not found at $DocPath; skipped the auto-sync note"
    return
  }
  $text = [System.IO.File]::ReadAllText($DocPath)
  if ($text.Contains('**Auto-sync**')) {
    Ok 'tracker doc already carries the auto-sync note'
    return
  }
  $note = '- **Auto-sync**: this repo opted into auto-sync hooks: `git push` runs `bd dolt push` (pre-push) and pulls run `bd dolt pull` (post-merge, post-rewrite). Ticket data syncs without a manual step.'
  $out = New-Object System.Collections.Generic.List[string]
  $patched = $false
  foreach ($line in ($text -split "`r?`n")) {
    $out.Add($line)
    if (-not $patched -and $line -match '^- \*\*Sync\*\*:') {
      $out.Add($note)
      $patched = $true
    }
  }
  Write-TextNoBom $DocPath (($out -join "`n") + "`n")
  Ok "documented auto-sync in $DocPath"
}

if (-not $Target) { Show-Usage }
if (-not (Get-Command bd -ErrorAction SilentlyContinue)) { Die 'bd is not on PATH' }
$Src = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $Src 'docs/agents'))) { Die "source repo layout not found under $Src" }
if (-not (Test-Path -LiteralPath $Target -PathType Container)) { Die "target directory does not exist: $Target" }
$Target = (Resolve-Path -LiteralPath $Target).Path
$HasGit = $null -ne (Get-Command git -ErrorAction SilentlyContinue)
if (-not (Test-Path (Join-Path $Target '.git'))) { Warn 'target is not a git repo; bd dolt sync needs one later' }

# bd init seeds its own AGENTS.md boilerplate (which recommends bd remember,
# banned by this convention), so track whether we let it create the file.
$agentsExisted = (Test-Path -LiteralPath (Join-Path $Target 'AGENTS.md'))

# ---- stage 1: beads store ------------------------------------------------
Stage 'beads store'
$metadataPath = Join-Path $Target '.beads/metadata.json'
if (Test-Path -LiteralPath $metadataPath) {
  Ok 'bd store already initialized'
} else {
  $prefixChoice = Ask 'Issue prefix [Enter = auto-detect from the directory name]: '
  $initArgs = @('init', '--non-interactive', '--init-if-missing')
  if ($prefixChoice) { $initArgs += @('-p', $prefixChoice) }
  In-Target { & bd @initArgs 2>&1 | Out-Null } | Out-Null
  if ($LASTEXITCODE -ne 0) { Die 'bd init failed' }
  Ok 'bd init'
}
# bd's hook shims (installed by bd init under its own hooksPath) chain to
# .git/hooks, and plain git runs .git/hooks when no other hooksPath is set.
# Either way the auto-sync hooks written in stage 7 fire; nothing to wire here.

$prefix = Get-BdConfig 'issue_prefix'
if (-not $prefix) { Die 'could not read issue prefix from target store' }
if ($prefix -match '[^A-Za-z0-9._-]') { Die "unexpected issue prefix: $prefix" }

# ---- stage 2: custom ticket types ---------------------------------------
Stage 'custom ticket types'
if ($Types) {
  Ok "using -Types: $Types"
} else {
  $typesInput = Ask "Custom ticket types [Enter = $DefaultTypes]: "
  if ($typesInput) { $Types = $typesInput } else { $Types = $DefaultTypes }
}
if (-not (Test-TypeList $Types)) { Die "invalid types list: '$Types' (comma-separated tokens of letters, digits, dot, underscore, dash)" }
Set-BdConfig 'types.custom' $Types | Out-Null
$storedTypes = Get-BdConfig 'types.custom'
$firstType = ($Types -split ',')[0]
if ($storedTypes -notlike "*$firstType*") { Die "types.custom did not stick; bd config get returns '$storedTypes'" }
Ok "custom types set: $storedTypes"

# ---- stage 3: sync remote ------------------------------------------------
Stage 'sync remote'
if (-not $Origin) {
  $originInput = Ask 'Remote origin for beads sync, e.g. git+https://github.com/org/repo.git [Enter = skip]: '
  if ($originInput) { $Origin = $originInput }
}
$SyncSet = $false
if ($Origin) {
  if ($Origin -notmatch '^git\+https://|^git\+ssh://|^https://doltremoteapi\.dolthub\.com/|^az://') {
    Warn 'unusual origin format; bd dolt push/pull accept git+https://, git+ssh://, DoltHub, or az:// remotes'
  }
  Set-BdConfig 'sync.remote' $Origin | Out-Null
  $setRemote = Get-BdConfig 'sync.remote'
  if ($setRemote -cne $Origin) { Die "sync.remote did not stick; bd config get returns '$setRemote'" }
  Ok "sync.remote set: $Origin"
  $SyncSet = $true
} else {
  Warn 'no origin given; skipping sync.remote (bd dolt push/pull will not work until it is set)'
}

# ---- stage 4: gitignore and the committed mirror --------------------------
Stage 'gitignore and committed mirror'
$gitignorePath = Join-Path $Target '.gitignore'
if (-not (Test-Path -LiteralPath $gitignorePath)) { Write-TextNoBom $gitignorePath '' }
$giLines = [System.IO.File]::ReadAllLines($gitignorePath)
if ($giLines -ccontains '.beads/config.yaml') {
  Ok '.beads/config.yaml already ignored'
} else {
  $giText = [System.IO.File]::ReadAllText($gitignorePath)
  $block = "`n# Beads per-machine config (managed by init-beads-convention.sh)`n.beads/config.yaml`n"
  Write-TextNoBom $gitignorePath ((TrimTrailing $giText) + $block)
  Ok 'ignored .beads/config.yaml in .gitignore (per-machine config stays local)'
}
$mirrorIgnored = $false
if ($HasGit) {
  In-Target { & git check-ignore -q '.beads/issues.jsonl' } | Out-Null
  $mirrorIgnored = ($LASTEXITCODE -eq 0)
}
if ($mirrorIgnored) {
  Warn '.beads/issues.jsonl is ignored; the committed ticket mirror will not be shared'
} else {
  Ok '.beads/issues.jsonl stays tracked (the committed ticket mirror)'
}
Set-BdConfig 'export.auto' 'true' | Out-Null
if ((Get-BdConfig 'export.auto') -ceq 'true') {
  Ok 'export.auto enabled (.beads/issues.jsonl refreshes after writes)'
} else {
  Warn 'export.auto did not stick; the mirror will not refresh automatically'
}

# ---- stage 5: hydration --------------------------------------------------
Stage 'hydration'
$hydration = 'skipped'
if (Test-StoreHasIssues) {
  $hydration = 'store already had issues'
  Ok "$hydration; nothing to hydrate"
} elseif (-not $SyncSet) {
  Warn 'no sync remote; cannot pull tickets from the team remote'
  $hydration = 'no sync remote'
} else {
  if ($Yes -or (Confirm 'Pull tickets from the remote now (bd dolt pull)?')) {
    In-Target { & bd dolt pull }
    if ($LASTEXITCODE -eq 0) {
      $hydration = 'pulled from remote'
      Ok $hydration
    } else {
      Warn 'bd dolt pull failed (no refs on the remote yet?)'
      $hydration = 'pull failed'
    }
  } else {
    $hydration = 'pull declined'
  }
}
$mirrorPath = Join-Path $Target '.beads/issues.jsonl'
if ((-not (Test-StoreHasIssues)) -and (Test-Path -LiteralPath $mirrorPath)) {
  if ($Yes -or (Confirm 'Import the committed .beads/issues.jsonl mirror into the store (bd import)?')) {
    In-Target { & bd import -i '.beads/issues.jsonl' }
    if ($LASTEXITCODE -eq 0) {
      $hydration = 'imported from issues.jsonl mirror'
      Ok $hydration
    } else {
      Warn 'bd import failed; hydrate later with: bd import -i .beads/issues.jsonl'
      $hydration = 'import failed'
    }
  }
}

# ---- stage 6: convention files -------------------------------------------
Stage 'convention files'
Install-Doc (Join-Path $Src 'docs/agents/issue-tracker.md') (Join-Path $Target 'docs/agents/issue-tracker.md')
Install-Doc (Join-Path $Src 'docs/agents/triage-labels.md') (Join-Path $Target 'docs/agents/triage-labels.md')

$skillDst = Join-Path $Target '.agents/skills/beads/SKILL.md'
$skillIsOurs = $false
if (Test-Path -LiteralPath $skillDst) {
  $skillIsOurs = ([System.IO.File]::ReadAllText($skillDst)).Contains('It is the single source; follow it')
}
if ($skillIsOurs -and -not $Force) {
  Warn "convention skill already installed, skipping (use -Force to overwrite): $skillDst"
} else {
  New-Item -ItemType Directory -Path (Split-Path -Parent $skillDst) -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $Src '.agents/skills/beads/SKILL.md') -Destination $skillDst -Force
  Copy-Item -LiteralPath (Join-Path $Src '.agents/skills/beads/agents/openai.yaml') -Destination (Join-Path $Target '.agents/skills/beads/agents/openai.yaml') -Force
  Ok "wrote $skillDst and agents/openai.yaml"
}

$agentsPath = Join-Path $Target 'AGENTS.md'
$marker = '### Beads (`bd`) issue tracker'
$stanzas = @'
### Beads (`bd`) issue tracker: `docs/agents/issue-tracker.md`

Issues live in beads, a local store under `.beads/`, operated via the `bd` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage roles are native beads labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`); set with `bd create -l` / `bd label add`, filter with `bd list -l <role>`. See `docs/agents/triage-labels.md`.
'@
if (-not $agentsExisted) {
  # bd init just created this file and its boilerplate recommends bd remember,
  # which this convention bans; replace it outright.
  Write-TextNoBom $agentsPath ($stanzas + "`n")
  Ok 'replaced bd-generated AGENTS.md with the convention stanzas'
} else {
  # Strip bd's managed blocks from a pre-existing AGENTS.md; they recommend
  # bd remember, banned by this convention. User content is preserved.
  $kept = New-Object System.Collections.Generic.List[string]
  $skip = $false
  foreach ($line in [System.IO.File]::ReadAllLines($agentsPath)) {
    if ($line -match '^<!-- BEGIN BEADS') { $skip = $true; continue }
    if ($line -match '^<!-- END BEADS') { $skip = $false; continue }
    if (-not $skip) { $kept.Add($line) }
  }
  # cat -s: squeeze runs of blank lines down to one.
  $squeezed = New-Object System.Collections.Generic.List[string]
  $prevBlank = $false
  foreach ($line in $kept) {
    $blank = ($line.Trim().Length -eq 0)
    if ($blank -and $prevBlank) { continue }
    $squeezed.Add($line)
    $prevBlank = $blank
  }
  $newText = (($squeezed -join "`n") + "`n")
  if ((TrimTrailing ([System.IO.File]::ReadAllText($agentsPath))) -cne (TrimTrailing $newText)) {
    Write-TextNoBom $agentsPath $newText
    Ok 'stripped bd-managed blocks from AGENTS.md'
  }
  if (([System.IO.File]::ReadAllText($agentsPath)).Contains($marker)) {
    Ok 'AGENTS.md already carries the beads stanzas'
  } else {
    $current = TrimTrailing ([System.IO.File]::ReadAllText($agentsPath))
    Write-TextNoBom $agentsPath ($current + "`n`n" + $stanzas + "`n")
    Ok 'appended beads stanzas to AGENTS.md'
  }
}

# ---- stage 7: auto-sync git hooks ----------------------------------------
Stage 'auto-sync git hooks'
$hookMarker = '# managed by init-beads-convention.sh'
$hooksResult = 'not installed'
$hooksDir = ''
if (-not $HasGit) {
  Warn 'target is not a git repo; hooks skipped'
} else {
  $gitDir = TrimTrailing (In-Target { & git rev-parse --git-dir 2>$null | Out-String })
  if (($LASTEXITCODE -eq 0) -and $gitDir) {
    if ([System.IO.Path]::IsPathRooted($gitDir)) { $hooksDir = Join-Path $gitDir 'hooks' }
    else { $hooksDir = Join-Path $Target (Join-Path $gitDir 'hooks') }
  } else {
    Warn 'target is not a git repo; hooks skipped'
  }
}
if ($hooksDir) {
  $hookPrompt = 'Install auto-sync git hooks? On git push, pre-push runs bd dolt push (tickets go up before code: a failed code push leaves tickets already pushed). On git pull, post-merge and post-rewrite run bd dolt pull.'
  if ($Yes -or (Confirm $hookPrompt)) {
    New-Item -ItemType Directory -Path $hooksDir -Force | Out-Null
    Install-Hook 'pre-push' 'bd dolt push' 'push tickets to the beads remote'
    Install-Hook 'post-merge' 'bd dolt pull' 'pull tickets after git pull'
    Install-Hook 'post-rewrite' 'bd dolt pull' 'pull tickets after git pull --rebase'
    $hooksResult = "installed in $hooksDir"
    Patch-SyncDoc (Join-Path $Target 'docs/agents/issue-tracker.md')
  } else {
    $hooksResult = 'declined'
  }
}

if ($MemoryGate) {
  Install-File (Join-Path $Src '.opencode/gates/no-memory.sh') (Join-Path $Target '.opencode/gates/no-memory.sh')
  if (([System.Environment]::OSVersion.Platform.ToString() -notlike 'Win*') -and (Get-Command chmod -ErrorAction SilentlyContinue)) {
    & chmod +x (Join-Path $Target '.opencode/gates/no-memory.sh') 2>$null
  }
  Install-File (Join-Path $Src '.opencode/plugins/no-memory.ts') (Join-Path $Target '.opencode/plugins/no-memory.ts')
  Warn 'memory gate copied but not wired: register no-memory.sh as a PreToolUse hook on Bash in .zcode/config.json, and keep .opencode/plugins/no-memory.ts for opencode sessions'
}

Write-Host ''
Write-Host "done. verify with: cd $Target && bd types"
Write-Host 'summary:'
Write-Host "  issue prefix: $prefix"
Write-Host "  custom types: $storedTypes"
if ($SyncSet) {
  Write-Host "  sync remote:  $Origin"
} else {
  Write-Host '  sync remote:  not set (bd dolt push/pull will not work until it is)'
}
Write-Host '  gitignore:    .beads/config.yaml ignored; .beads/issues.jsonl mirror tracked (export.auto on)'
Write-Host "  hydration:    $hydration"
Write-Host "  hooks:        $hooksResult"
