$ErrorActionPreference = "Stop"

function Refresh-Path {
    $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machinePath;$userPath"
}

function Ensure-Command {
    param(
        [Parameter(Mandatory = $true)][string]$Command,
        [Parameter(Mandatory = $true)][string]$PackageId,
        [Parameter(Mandatory = $true)][string]$DisplayName
    )

    if (Get-Command $Command -ErrorAction SilentlyContinue) {
        return
    }
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw "Windows Package Manager (winget) is required to install $DisplayName. Install App Installer from Microsoft Store and run this script again."
    }

    Write-Host "Installing $DisplayName..."
    winget install --exact --id $PackageId --accept-package-agreements --accept-source-agreements
    Refresh-Path
    if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) {
        throw "$DisplayName was installed but is not available in this PowerShell session. Close PowerShell, reopen it, and run the script again."
    }
}

Ensure-Command -Command "git" -PackageId "Git.Git" -DisplayName "Git"
Ensure-Command -Command "node" -PackageId "OpenJS.NodeJS.LTS" -DisplayName "Node.js LTS"
Ensure-Command -Command "py" -PackageId "Python.Python.3.13" -DisplayName "Python 3.13"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

if (Test-Path ".git") {
    Write-Host "Updating the project..."
    git pull --ff-only
}

Write-Host "Installing frontend dependencies..."
npm ci

if (-not (Test-Path ".venv\Scripts\python.exe")) {
    Write-Host "Creating the Python environment..."
    py -3.13 -m venv .venv
}

Write-Host "Installing backend dependencies..."
& ".venv\Scripts\python.exe" -m pip install --disable-pip-version-check -r requirements.txt

Write-Host "Building Sahayata Atlas..."
npm run build

$env:ENVIRONMENT = "production"
$env:PORT = "5005"
$url = "http://127.0.0.1:5005"
$server = Start-Process -FilePath ".venv\Scripts\python.exe" -ArgumentList "-m", "backend.app" -NoNewWindow -PassThru

try {
    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        if ($server.HasExited) {
            throw "The Sahayata Atlas server stopped before it was ready."
        }
        try {
            $health = Invoke-WebRequest -Uri "$url/api/v1/health" -UseBasicParsing -TimeoutSec 1
            if ($health.StatusCode -eq 200) {
                $ready = $true
                break
            }
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }
    if (-not $ready) {
        throw "Sahayata Atlas did not become ready within 30 seconds."
    }

    Start-Process $url
    Write-Host "Sahayata Atlas is running at $url"
    Write-Host "Keep this window open. Press Ctrl+C to stop the application."
    Wait-Process -Id $server.Id
} finally {
    if (-not $server.HasExited) {
        Stop-Process -Id $server.Id
    }
}
