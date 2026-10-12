#define AppName "FuneralControl"
#define AppVersion "0.1.0"
#define AppPublisher "FuneralControl"

[Setup]
AppId={{7DF2F4A5-5B7D-41CD-B856-5D3345A5CC38}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={autopf}\{#AppName}
DisableProgramGroupPage=yes
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\release
OutputBaseFilename=FuneralControl-Instalador
Compression=lzma2
SolidCompression=yes
Uninstallable=no

[Files]
Source: "..\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs; Excludes: ".git\*,.codex\*,.superpowers\*,node_modules\*,dist\*,.env,uploads\*,data\*,backups\*,release\*"

[Run]
Filename: "{cmd}"; Parameters: "/C powershell.exe -NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\Install-FuneralControl.ps1"" -InstallRoot ""{app}"""; Flags: waituntilterminated runhidden

[Code]
function InitializeSetup(): Boolean;
begin
  Result := True;
end;
