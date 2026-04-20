param(
  [switch]$RunDev
)

$ErrorActionPreference = "Stop"
$script:NpmExe = "npm"
$script:ElectronVersion = "28.3.3"

function Write-Step($message) {
  Write-Host "[fix-dev-env] $message" -ForegroundColor Cyan
}

function Try-Run($command) {
  $resolvedCommand = $command
  if ($command.StartsWith("npm ")) {
    $resolvedCommand = "$script:NpmExe " + $command.Substring(4)
  }
  Write-Step "Running: $resolvedCommand"
  cmd /c $resolvedCommand
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: $resolvedCommand"
  }
}

Write-Step "Stopping possible lock processes (node/electron/npm)..."
Get-Process node, electron, npm -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Step "Using Node v20.18.1 if nvm is available..."
if (Get-Command nvm -ErrorAction SilentlyContinue) {
  cmd /c "nvm use 20.18.1"
  if ($env:NVM_HOME) {
    $candidateNpm = Join-Path $env:NVM_HOME "v20.18.1\npm.cmd"
    if (Test-Path $candidateNpm) {
      $script:NpmExe = """$candidateNpm"""
      Write-Step "Using npm from $candidateNpm"
    }
  }
} else {
  Write-Step "nvm not found, skip switching Node version."
}

Write-Step "Set Electron mirror for faster and stable download..."
$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"

Write-Step "Installing dependencies (no audit/fund to avoid mirror audit 404)..."
Try-Run "npm install --no-audit --no-fund"

Write-Step "Pinning Electron version to $script:ElectronVersion for better-sqlite3 compatibility..."
Try-Run "npm install -D electron@$script:ElectronVersion --no-audit --no-fund"

Write-Step "Rebuilding Electron binary..."
Try-Run "npm rebuild electron --verbose"

Write-Step "Rebuilding better-sqlite3 for Electron ABI..."
Try-Run "npm rebuild better-sqlite3 --runtime=electron --target=$script:ElectronVersion --dist-url=https://electronjs.org/headers"

Write-Step "Freeing port 5173 if occupied..."
$portPids = netstat -ano | Select-String ":5173" | ForEach-Object {
  ($_ -split "\s+")[-1]
} | Where-Object { $_ -match "^\d+$" } | Select-Object -Unique

foreach ($pid in $portPids) {
  Stop-Process -Id ([int]$pid) -Force -ErrorAction SilentlyContinue
}

Write-Step "Done. Environment is repaired."
Write-Step "Next command: npm run dev"

if ($RunDev) {
  Write-Step "Starting dev server..."
  Try-Run "npm run dev"
}
