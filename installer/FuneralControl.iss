#define AppName "FuneralControl"
#define AppVersion "1.0.1"
#define AppPublisher "FuneralControl"

[Setup]
AppId={{7DF2F4A5-5B7D-41CD-B856-5D3345A5CC38}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={autopf}\{#AppName}
DisableProgramGroupPage=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\release
OutputBaseFilename=FuneralControl-Instalador
Compression=lzma2
SolidCompression=yes
Uninstallable=no

[Files]
Source: "..\dist\*"; DestDir: "{app}\dist"; Flags: recursesubdirs createallsubdirs
Source: "..\scripts\*"; DestDir: "{app}\scripts"; Flags: recursesubdirs createallsubdirs
Source: "..\package.json"; DestDir: "{app}"
Source: "..\package-lock.json"; DestDir: "{app}"
Source: "..\FuneralControl.cmd"; DestDir: "{app}"

[Code]
procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
  InstallRoot: String;
begin
  if CurStep <> ssPostInstall then
    Exit;

  InstallRoot := ExpandConstant('{app}');
  WizardForm.StatusLabel.Caption := 'Preparando Node.js, PostgreSQL e o banco local. Esta etapa pode levar alguns minutos.';

  if not Exec(
    ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
    '-NoProfile -ExecutionPolicy Bypass -File "' + InstallRoot + '\scripts\Install-FuneralControl.ps1" -InstallRoot "' + InstallRoot + '"',
    '',
    SW_SHOW,
    ewWaitUntilTerminated,
    ResultCode
  ) then begin
    MsgBox('Não foi possível iniciar a configuração local. Consulte o suporte.', mbError, MB_OK);
    Abort;
  end;

  if ResultCode <> 0 then begin
    MsgBox(
      'A preparação do FuneralControl não foi concluída. Nenhum atalho foi criado.' + #13#10 +
      'Consulte o arquivo C:\\ProgramData\\FuneralControl\\logs\\instalacao.log e execute novamente o instalador.',
      mbError,
      MB_OK
    );
    Abort;
  end;
end;
