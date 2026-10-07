$ErrorActionPreference = "Stop"
$root = & git -C $PSScriptRoot rev-parse --show-toplevel
if ($LASTEXITCODE -ne 0) { throw "Cannot locate the Git checkout." }
$control = Join-Path $PSScriptRoot "codebase-index.ps1"
$cache = Join-Path $root ".claude/cache/codebase-index"
$envFile = Join-Path $cache "setup.env"
$stageIndex = 0
$totalStages = 7
$utf8 = New-Object System.Text.UTF8Encoding($false)
New-Item -ItemType Directory -Force -Path $cache | Out-Null

function Stage([string]$Name) {
    if (-not [Console]::IsOutputRedirected) { Clear-Host }
    $script:stageIndex++
    Write-Host "`nStage $script:stageIndex/$totalStages - $Name`n" -ForegroundColor Cyan
}

function Pause-Step([string]$Message) {
    Read-Host $Message | Out-Null
}

function Open-Url([string]$Url) {
    Write-Host "Opening $Url"
    try { Start-Process $Url | Out-Null } catch { Write-Warning "Visit $Url manually." }
}

function Saved([string]$Key) {
    if (Test-Path $envFile) {
        $line = Get-Content $envFile | Where-Object { $_.StartsWith("$Key=") } | Select-Object -Last 1
        if ($line) { return $line.Substring($Key.Length + 1) }
    }
    return ""
}

function Write-Env([string]$Key, [string]$Value) {
    $lines = @()
    if (Test-Path $envFile) { $lines = @(Get-Content $envFile | Where-Object { -not $_.StartsWith("$Key=") }) }
    $lines += "$Key=$Value"
    [System.IO.File]::WriteAllLines($envFile, [string[]]$lines, $utf8)
}

function Ask([string]$Key, [string]$Prompt, [string]$Default) {
    $current = Saved $Key
    if ($current) { $Default = $current }
    $value = Read-Host "$Prompt [$Default]"
    if (-not $value) { $value = $Default }
    return $value
}

function Choice([string]$Key, [string]$Prompt, [string]$Default, [string[]]$Allowed) {
    do {
        $value = Ask $Key $Prompt $Default
        if ($Allowed -cnotcontains $value) { Write-Warning "Choose one of: $($Allowed -join ', ')" }
    } while ($Allowed -cnotcontains $value)
    Write-Env $Key $value
    return $value
}

function Invoke-Control([string[]]$ControlArguments) {
    & $control @ControlArguments
    if ($LASTEXITCODE -ne 0) { throw "Codebase index operation failed. Fix the error and rerun." }
}

Write-Host "`nCodebase index setup - $totalStages stages" -ForegroundColor Cyan
Pause-Step "Ready to start? Press Enter"

Stage "Review this checkout"
Write-Host "Checkout: $root"
Write-Host "Settings stay in the ignored codebase-index cache, not Laravel's .env."
Invoke-Control @("status")
Pause-Step "Review the settings, then press Enter"

Stage "Choose automatic indexing"
Write-Host "OpenCode will build on startup and refresh after edits and outside changes."
$auto = Choice "CBX_AUTO" "Automatic indexing, on or off" "on" @("on", "off")

Stage "Choose embeddings"
Write-Host "Off keeps symbol and text retrieval. Ollama uses your installed model."
$provider = Choice "CBX_PROVIDER" "Embeddings, off, local, ollama, or external" "off" @("off", "local", "ollama", "external")

Stage "Choose the provider model"
$model = ""
$endpoint = ""
switch ($provider) {
    "off" { Write-Host "No model or endpoint needed." }
    "ollama" {
        Open-Url "https://docs.ollama.com/api/openai-compatibility"
        Write-Host "Use the exact model tag from 'ollama list'."
        if (Get-Command ollama -ErrorAction SilentlyContinue) { & ollama list }
        $model = Ask "CBX_MODEL" "Model" "unclemusclez/jina-embeddings-v2-base-code:latest"
        $endpoint = Ask "CBX_ENDPOINT" "Endpoint" "http://localhost:11434/v1/embeddings"
        Write-Env "CBX_MODEL" $model
        Write-Env "CBX_ENDPOINT" $endpoint
    }
    "local" {
        Open-Url "https://www.sbert.net/docs/sentence_transformer/pretrained_models.html"
        Write-Host "Choose a Sentence Transformers model ID. Loading it may download model files."
        $model = Ask "CBX_MODEL" "Model" "all-MiniLM-L6-v2"
        Write-Env "CBX_MODEL" $model
    }
    "external" {
        Write-Host "Use your provider's full OpenAI-compatible embeddings endpoint and model ID."
        $endpoint = Ask "CBX_ENDPOINT" "HTTPS embeddings endpoint" ""
        $model = Ask "CBX_MODEL" "Model ID" ""
        if (-not $endpoint -or -not $model) { throw "Endpoint and model are required." }
        Write-Env "CBX_ENDPOINT" $endpoint
        Write-Env "CBX_MODEL" $model
    }
}

Stage "Configure authentication"
if ($provider -eq "external") {
    $secure = Read-Host "API key, hidden input. Enter keeps the saved key" -AsSecureString
    $pointer = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        $key = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
        if (-not $key -and -not $env:CBX_EMBEDDINGS_API_KEY -and -not (Test-Path (Join-Path $cache "credentials.env"))) {
            throw "An API key is required."
        }
    } finally {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
        $secure.Dispose()
    }
    Write-Host "The key stays in memory until you confirm and validation succeeds."
} else {
    Write-Host "No secret required. The local Ollama preset supplies a placeholder automatically."
}

Stage "Validate and apply"
Write-Host "Provider: $provider. Automatic indexing: $auto."
Write-Host "Enabled embeddings send indexed code chunks to the selected provider."
Write-Host "Changing providers or models rebuilds vectors. Your source files stay untouched."
$confirm = Read-Host "Validate the provider, save these settings, and refresh the index? [y/N]"
if ($confirm -notmatch "^[Yy]$") { Remove-Variable key -ErrorAction SilentlyContinue; return }
$arguments = @("configure", "--auto", $auto, "--embeddings", $provider)
if ($provider -ne "off") { $arguments += @("--model", $model) }
if ($provider -eq "ollama" -or $provider -eq "external") { $arguments += @("--endpoint", $endpoint) }
if ($provider -eq "external" -and $key) {
    try {
        $key | & $control @arguments --credential-stdin
        if ($LASTEXITCODE -ne 0) { throw "Provider validation failed. The saved key and configuration are unchanged." }
    } finally {
        Remove-Variable key -ErrorAction SilentlyContinue
    }
} else {
    Invoke-Control $arguments
}
Invoke-Control @("refresh")

Stage "Review the result"
Invoke-Control @("status")
Write-Host "OpenCode owns ongoing indexing. Agents only retrieve evidence."
Pause-Step "Press Enter for the closing summary"
Write-Host "`nSetup complete. Settings: $cache/config.json" -ForegroundColor Green
Write-Host "Saved prompts: $envFile. Credentials stay local and never go to GitHub."
