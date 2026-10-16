@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0bootstrap\Start-FuneralControlV2.ps1" -InstallRoot "%~dp0" -DataRoot "C:\ProgramData\FuneralControl\v2"
endlocal
