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

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

copy /Y "%~dp0%EXE_NAME%" "%INSTALL_DIR%\%EXE_NAME%" >nul
copy /Y "%~dp0README.md" "%INSTALL_DIR%\README.md" >nul
copy /Y "%~dp0config.example.json" "%INSTALL_DIR%\config.example.json" >nul
if exist "%~dp0select-printer.bat" copy /Y "%~dp0select-printer.bat" "%INSTALL_DIR%\select-printer.bat" >nul
if exist "%~dp0config.json" copy /Y "%~dp0config.json" "%INSTALL_DIR%\config.json" >nul

if not exist "%INSTALL_DIR%\config.json" (
  copy /Y "%~dp0config.example.json" "%INSTALL_DIR%\config.json" >nul
  echo.
  echo Configure o arquivo antes de iniciar o servico:
  echo %INSTALL_DIR%\config.json
  echo.
  notepad "%INSTALL_DIR%\config.json"
  echo.
  echo Execute este instalador novamente depois de preencher o config.json.
  pause
  exit /b 1
)

pushd "%INSTALL_DIR%"
"%INSTALL_DIR%\%EXE_NAME%" install --startup auto
"%INSTALL_DIR%\%EXE_NAME%" start
popd

echo.
echo Vib Print Agent instalado.
echo Configuracao: %INSTALL_DIR%\config.json
echo Log: %INSTALL_DIR%\print-agent.log
pause
