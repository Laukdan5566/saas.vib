@echo off
setlocal

set "INSTALL_DIR=%ProgramData%\VibPrintAgent"
set "EXE_NAME=VibPrintAgent.exe"

net session >nul 2>&1
if not "%errorlevel%"=="0" (
  echo Execute este arquivo como Administrador.
  pause
  exit /b 1
)

if exist "%INSTALL_DIR%\%EXE_NAME%" (
  "%INSTALL_DIR%\%EXE_NAME%" stop
  "%INSTALL_DIR%\%EXE_NAME%" remove
) else (
  "%~dp0%EXE_NAME%" stop
  "%~dp0%EXE_NAME%" remove
)

echo.
echo Servico Vib Print Agent removido.
echo A pasta de configuracao foi mantida em:
echo %INSTALL_DIR%
pause
