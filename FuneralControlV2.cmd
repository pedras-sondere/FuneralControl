@echo off
setlocal
set "FUNERALCONTROL_ROOT=%~dp0"
set "FUNERALCONTROL_ROOT=%FUNERALCONTROL_ROOT:~0,-1%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%FUNERALCONTROL_ROOT%\bootstrap\Start-FuneralControlV2.ps1" -InstallRoot "%FUNERALCONTROL_ROOT%" -DataRoot "C:\ProgramData\FuneralControl\v2"
endlocal
