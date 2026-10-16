#define AppName "FuneralControl"
#define AppVersion "2.1.0-rc.5"
#define BuildId "20261016.3"
#define AppPublisher "FuneralControl"

[Setup]
AppId={{9EDCA460-9DAB-4D80-A34E-5F24B1E5C4B2}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={autopf}\{#AppName}
DisableDirPage=yes
UsePreviousAppDir=no
DisableProgramGroupPage=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\release
OutputBaseFilename=FuneralControl-Instalador-2.1.0-rc.5-build-20261016.3
Compression=lzma2
SolidCompression=yes
SetupLogging=yes
WizardStyle=modern
Uninstallable=no

[Files]
Source: "..\FuneralControlV2.cmd"; DestDir: "{app}"; Flags: ignoreversion; Check: IsInstallMode
Source: "..\scripts\FuneralControlInstaller.Common.psm1"; DestDir: "{app}\bootstrap"; Flags: ignoreversion; Check: IsInstallMode
Source: "..\scripts\Configure-FuneralControlDatabaseV2.ps1"; DestDir: "{app}\bootstrap"; Flags: ignoreversion; Check: IsInstallMode
Source: "..\scripts\Start-FuneralControlV2.ps1"; DestDir: "{app}\bootstrap"; Flags: ignoreversion; Check: IsInstallMode
Source: "..\scripts\Install-FuneralControlV2.ps1"; DestDir: "{app}\bootstrap"; Flags: ignoreversion; Check: IsInstallMode
Source: "..\scripts\Update-FuneralControlV2.ps1"; DestDir: "{app}\bootstrap"; Flags: ignoreversion; Check: IsInstallMode
Source: "FuneralControlV2.manifest.psd1"; DestDir: "{app}\bootstrap"; Flags: ignoreversion; Check: IsInstallMode
Source: "..\scripts\Reset-FuneralControlV2.ps1"; DestDir: "{tmp}"; DestName: "Reset-FuneralControlV2.ps1"; Flags: ignoreversion deleteafterinstall; Check: IsUninstallMode

[Code]
var
  OperationPage: TInputOptionWizardPage;
  UninstallConfirmed: Boolean;

function IsInstallMode: Boolean;
begin
  Result := OperationPage.SelectedValueIndex = 0;
end;

function IsUninstallMode: Boolean;
begin
  Result := OperationPage.SelectedValueIndex = 1;
end;

procedure InitializeWizard;
begin
  UninstallConfirmed := False;
  OperationPage := CreateInputOptionPage(
    wpWelcome,
    'Instalação ou Desinstalação completa',
    'Escolha a operação desejada',
    'A Instalação prepara todos os componentes locais. A Desinstalação completa apaga o programa, o banco local, os documentos, as configurações e o atalho.',
    True,
    False
  );
  OperationPage.Add('Instalação');
  OperationPage.Add('Desinstalação completa');
  OperationPage.SelectedValueIndex := 0;
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := IsUninstallMode and (PageID = wpSelectDir);
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if CurPageID <> OperationPage.ID then
    Exit;

  if IsInstallMode then begin
    UninstallConfirmed := False;
    WizardForm.Caption := 'Instalação do FuneralControl';
    Exit;
  end;

  WizardForm.Caption := 'Desinstalação completa do FuneralControl';
  if not UninstallConfirmed then begin
    UninstallConfirmed := MsgBox(
      'A Desinstalação completa apagará permanentemente o aplicativo, todo o banco de dados local, documentos enviados, configurações e o atalho do FuneralControl deste computador.' + #13#10 + #13#10 +
      'Deseja continuar?',
      mbConfirmation,
      MB_YESNO
    ) = IDYES;
    Result := UninstallConfirmed;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
  InstallRoot: String;
  PowerShellPath: String;
  Arguments: String;
begin
  if CurStep <> ssPostInstall then
    Exit;

  InstallRoot := ExpandConstant('{app}');
  PowerShellPath := ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe');

  if IsUninstallMode then begin
    WizardForm.StatusLabel.Caption := 'Executando a Desinstalação completa e verificando os alvos.';
    Arguments :=
      '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{tmp}\Reset-FuneralControlV2.ps1') + '"' +
      ' -InstallRoot "' + InstallRoot + '"' +
      ' -DataRoot "C:\ProgramData\FuneralControl"' +
      ' -DesktopPath "' + ExpandConstant('{userdesktop}') + '"' +
      ' -LogPath "C:\ProgramData\FuneralControl-Installer\logs\desinstalacao-atual.log"' +
      ' -InstallerVersion "{#AppVersion}" -AllowLegacyCleanup';

    if not Exec(PowerShellPath, Arguments, '', SW_SHOW, ewWaitUntilTerminated, ResultCode) then begin
      MsgBox(
        'Não foi possível iniciar a Desinstalação completa.' + #13#10 +
        'Consulte C:\ProgramData\FuneralControl-Installer\logs\desinstalacao-atual.log.',
        mbError,
        MB_OK
      );
      Abort;
    end;

    if ResultCode <> 0 then begin
      MsgBox(
        'A Desinstalação completa não foi concluída. Nenhuma limpeza manual é necessária.' + #13#10 +
        'Consulte C:\ProgramData\FuneralControl-Installer\logs\desinstalacao-atual.log para ver a etapa e o erro exatos.',
        mbError,
        MB_OK
      );
      Abort;
    end;

    MsgBox(
      'A Desinstalação completa foi concluída e os alvos foram verificados. Execute este instalador novamente e escolha Instalação para começar do zero.',
      mbInformation,
      MB_OK
    );
    Exit;
  end;

  WizardForm.StatusLabel.Caption := 'Executando a Instalação dos componentes locais verificados. Esta etapa pode levar alguns minutos.';
  Arguments :=
    '-NoProfile -ExecutionPolicy Bypass -File "' + InstallRoot + '\bootstrap\Install-FuneralControlV2.ps1"' +
    ' -InstallRoot "' + InstallRoot + '"' +
    ' -ManifestPath "' + InstallRoot + '\bootstrap\FuneralControlV2.manifest.psd1"' +
    ' -DesktopPath "' + ExpandConstant('{userdesktop}') + '"' +
    ' -DiagnosticRoot "C:\ProgramData\FuneralControl-Installer\logs"';

  if not Exec(PowerShellPath, Arguments, '', SW_SHOW, ewWaitUntilTerminated, ResultCode) then begin
    MsgBox(
      'Não foi possível iniciar a Instalação.' + #13#10 +
      'Consulte C:\ProgramData\FuneralControl-Installer\logs\instalacao-atual.log.',
      mbError,
      MB_OK
    );
    Abort;
  end;

  if ResultCode <> 0 then begin
    MsgBox(
      'A Instalação do FuneralControl não foi concluída. O atalho somente é criado após todas as verificações.' + #13#10 +
      'Consulte C:\ProgramData\FuneralControl-Installer\logs\instalacao-atual.log para ver a etapa e o erro exatos.',
      mbError,
      MB_OK
    );
    Abort;
  end;

  MsgBox('A Instalação foi concluída e o atalho FuneralControl foi criado na Área de Trabalho.', mbInformation, MB_OK);
end;
