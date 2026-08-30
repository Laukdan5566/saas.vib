@echo off
setlocal

if not exist "%~dp0config.json" (
  copy /Y "%~dp0config.example.json" "%~dp0config.json" >nul
  echo Configure o arquivo config.json antes do teste.
  notepad "%~dp0config.json"
)

"%~dp0VibPrintAgent.exe" console
pause
