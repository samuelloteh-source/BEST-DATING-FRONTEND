Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned | Out-Null

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

if (Test-Path ".venv\Scripts\Activate.ps1") {
    & ".venv\Scripts\Activate.ps1"
} else {
    Write-Error "Virtual environment not found at .venv\\Scripts\\Activate.ps1"
    exit 1
}

node server/index.js
