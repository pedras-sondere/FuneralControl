#define AppName "FuneralControl"
#define AppVersion "2.0.0"
#define AppPublisher "FuneralControl"

[Setup]
AppId={{9EDCA460-9DAB-4D80-A34E-5F24B1E5C4B2}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={autopf}\{#AppName}
DisableProgramGroupPage=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\release
OutputBaseFilename=FuneralControl-Instalador-v2
Compression=lzma2
SolidCompression=yes
Uninstallable=yes

[Files]
Source: "..\FuneralControlV2.cmd"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\scripts\FuneralControlInstaller.Common.psm1"; DestDir: "{app}\bootstrap"; Flags: ignoreversion
Source: "..\scripts\Configure-FuneralControlDatabaseV2.ps1"; DestDir: "{app}\bootstrap"; Flags: ignoreversion
Source: "..\scripts\Start-FuneralControlV2.ps1"; DestDir: "{app}\bootstrap"; Flags: ignoreversion
Source: "..\scripts\Install-FuneralControlV2.ps1"; DestDir: "{app}\bootstrap"; Flags: ignoreversion
Source: "FuneralControlV2.manifest.psd1"; DestDir: "{app}\bootstrap"; Flags: ignoreversion

[Code]
procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
  InstallRoot: String;
begin
  if CurStep <> ssPostInstall then
    Exit;

  InstallRoot := ExpandConstant('{app}');
  WizardForm.StatusLabel.Caption := 'Preparando os componentes locais verificados do FuneralControl. Esta etapa pode levar alguns minutos.';
  if not Exec(
    ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
    '-NoProfile -ExecutionPolicy Bypass -File "' + InstallRoot + '\bootstrap\Install-FuneralControlV2.ps1" -InstallRoot "' + InstallRoot + '" -ManifestPath "' + InstallRoot + '\bootstrap\FuneralControlV2.manifest.psd1"',
    '',
    SW_SHOW,
    ewWaitUntilTerminated,
    ResultCode
  ) then begin
    MsgBox('Não foi possível iniciar a preparação local. Consulte o suporte.', mbError, MB_OK);
    Abort;
  end;

  if ResultCode <> 0 then begin
    MsgBox(
      'A preparação do FuneralControl não foi concluída. Nenhum atalho foi criado.' + #13#10 +
      'Consulte C:\ProgramData\FuneralControl\v2\logs\instalacao-v2.log e execute novamente o instalador.',
      mbError,
      MB_OK
    );
    Abort;
  end;
end;
