$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$BuildDir = Join-Path $Root "build"
$DistDir = Join-Path $Root "dist"

Remove-Item -Recurse -Force $BuildDir, $DistDir -ErrorAction SilentlyContinue

python -m pip install -r (Join-Path $Root "requirements.txt")

python -m PyInstaller `
  --clean `
  --onefile `
  --name VibPrintAgent `
  --distpath $DistDir `
  --workpath $BuildDir `
  --hidden-import pywintypes `
  --hidden-import pythoncom `
  --hidden-import servicemanager `
  --hidden-import win32event `
  --hidden-import win32print `
  --hidden-import win32service `
  --hidden-import win32serviceutil `
  --hidden-import win32timezone `
  (Join-Path $Root "agent.py")

Write-Host "Executavel gerado em: $(Join-Path $DistDir 'VibPrintAgent.exe')"
