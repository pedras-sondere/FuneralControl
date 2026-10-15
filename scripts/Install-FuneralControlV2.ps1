[CmdletBinding()]
param(
  [string]$InstallRoot = 'C:\Program Files\FuneralControl',
  [string]$DataRoot = 'C:\ProgramData\FuneralControl\v2',
  [string]$ManifestPath = (Join-Path $PSScriptRoot '..\installer\FuneralControlV2.manifest.psd1'),
  [switch]$DryRun,
  [switch]$AsJson
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'FuneralControlInstaller.Common.psm1') -Force

function Write-FuneralControlInstallLog {
  param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][string]$Message)
  New-Item -ItemType Directory -Path (Split-Path -Parent $Path) -Force | Out-Null
  Write-Host $Message
  Add-Content -LiteralPath $Path -Value "$(Get-Date -Format o) $Message" -Encoding UTF8
}

function Repair-FuneralControlStateAccess {
  param(
    [Parameter(Mandatory)][string]$StatePath,
    [Parameter(Mandatory)][string]$Sid
  )

  $stateDirectory = Split-Path -Parent $StatePath
  New-Item -ItemType Directory -Path $stateDirectory -Force | Out-Null

  # Uma instalação interrompida pode ter deixado a pasta de estado vinculada a
  # outra credencial administrativa. Recuperamos somente esse controle técnico;
  # banco, configurações protegidas e documentos do cliente não são alterados.
  $directoryOutput = & icacls.exe $stateDirectory '/grant' "*${Sid}:(OI)(CI)M" '/C' 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "Não foi possível recuperar o acesso ao estado da instalação. $($directoryOutput -join ' ')"
  }

  if (Test-Path -LiteralPath $StatePath -PathType Leaf) {
    $fileOutput = & icacls.exe $StatePath '/grant' "*${Sid}:M" '/C' 2>&1
    if ($LASTEXITCODE -ne 0) {
      throw "Não foi possível recuperar o arquivo de estado da instalação. $($fileOutput -join ' ')"
    }
  }
}

function Assert-FuneralControlAsset {
  param([Parameter(Mandatory)]$Asset)
  if ($Asset.Url -notmatch '^https://') { throw 'O manifesto contém um endereço de download inseguro.' }
  if ($Asset.Sha256 -notmatch '^[a-fA-F0-9]{64}$') { throw 'O manifesto contém um SHA-256 inválido.' }
  if ([long]$Asset.Size -lt 1) { throw 'O manifesto contém um tamanho inválido.' }
}

function Get-FuneralControlAsset {
  param([Parameter(Mandatory)]$Asset, [Parameter(Mandatory)][string]$StagingRoot)
  Assert-FuneralControlAsset -Asset $Asset
  $name = [IO.Path]::GetFileName(([uri]$Asset.Url).AbsolutePath)
  if ([string]::IsNullOrWhiteSpace($name)) { throw 'O nome do arquivo de download é inválido.' }
  $destination = Join-Path $StagingRoot $name
  $partial = "$destination.partial"
  Remove-Item -LiteralPath $partial -Force -ErrorAction SilentlyContinue
  Invoke-WebRequest -Uri $Asset.Url -OutFile $partial -UseBasicParsing
  if ((Get-Item -LiteralPath $partial).Length -ne [long]$Asset.Size) { throw "O tamanho do arquivo $name não confere." }
  $hash = (Get-FileHash -LiteralPath $partial -Algorithm SHA256).Hash
  if ($hash -ne $Asset.Sha256) { throw "O SHA-256 do arquivo $name não confere." }
  Move-Item -LiteralPath $partial -Destination $destination -Force
  return $destination
}

function Move-FuneralControlSingleRoot {
  param([Parameter(Mandatory)][string]$StagingDirectory, [Parameter(Mandatory)][string]$Destination, [Parameter(Mandatory)][string]$RequiredRelativePath)
  $candidates = @(Get-ChildItem -LiteralPath $StagingDirectory -Directory)
  if ($candidates.Count -ne 1 -or -not (Test-Path -LiteralPath (Join-Path $candidates[0].FullName $RequiredRelativePath))) {
    throw 'O pacote de runtime não possui a estrutura esperada.'
  }
  if (Test-Path -LiteralPath $Destination) { throw 'O runtime privado existente está inconsistente.' }
  New-Item -ItemType Directory -Path (Split-Path -Parent $Destination) -Force | Out-Null
  Move-Item -LiteralPath $candidates[0].FullName -Destination $Destination
}

$paths = Get-FuneralControlPaths -InstallRoot $InstallRoot -DataRoot $DataRoot
$result = [ordered]@{ ok = $true; installRoot = $InstallRoot; dataRoot = $DataRoot; desktopShortcut = $true }
if ($DryRun) { if ($AsJson) { $result | ConvertTo-Json -Compress }; exit 0 }

$logPath = Join-Path $paths.LogRoot 'instalacao-v2.log'
try {
  if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) { throw 'O manifesto do instalador v2 não foi encontrado.' }
  $manifest = Import-PowerShellDataFile -LiteralPath $ManifestPath
  if ($manifest.SchemaVersion -ne 2) { throw 'A versão do manifesto do instalador é incompatível.' }
  foreach ($asset in @($manifest.Runtime, $manifest.Node, $manifest.PostgreSQL)) { Assert-FuneralControlAsset -Asset $asset }
  if ($manifest.Runtime.Asset -ne "FuneralControl-runtime-$($manifest.Runtime.Version).zip") { throw 'O pacote do aplicativo não corresponde à versão informada.' }

  New-Item -ItemType Directory -Path $paths.StagingRoot, $paths.LogRoot -Force | Out-Null
  Write-FuneralControlInstallLog -Path $logPath -Message 'Pré-verificação do instalador v2 concluída.'
  $sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  Write-FuneralControlInstallLog -Path $logPath -Message 'Verificando o acesso ao estado da instalação.'
  Repair-FuneralControlStateAccess -StatePath $paths.StatePath -Sid $sid
  Set-FuneralControlPhase -StatePath $paths.StatePath -Phase 'prechecked' -State @{ appVersion = $manifest.Runtime.Version }

  $nodeArchive = Get-FuneralControlAsset -Asset $manifest.Node -StagingRoot $paths.StagingRoot
  $postgresArchive = Get-FuneralControlAsset -Asset $manifest.PostgreSQL -StagingRoot $paths.StagingRoot
  $runtimeArchive = Get-FuneralControlAsset -Asset $manifest.Runtime -StagingRoot $paths.StagingRoot
  Set-FuneralControlPhase -StatePath $paths.StatePath -Phase 'verified' -State @{ appVersion = $manifest.Runtime.Version }
  Write-FuneralControlInstallLog -Path $logPath -Message 'Downloads conferidos por tamanho e SHA-256.'

  if (-not (Test-Path -LiteralPath (Join-Path $paths.NodeRoot 'node.exe'))) {
    Write-FuneralControlInstallLog -Path $logPath -Message 'Extraindo o Node.js privado.'
    $nodeStaging = Join-Path $paths.StagingRoot 'node'
    Remove-Item -LiteralPath $nodeStaging -Force -Recurse -ErrorAction SilentlyContinue
    Expand-FuneralControlSafeArchive -Archive $nodeArchive -Destination $nodeStaging
    Move-FuneralControlSingleRoot -StagingDirectory $nodeStaging -Destination $paths.NodeRoot -RequiredRelativePath 'node.exe'
    Write-FuneralControlInstallLog -Path $logPath -Message 'Node.js privado extraído.'
  }
  if (-not (Test-Path -LiteralPath (Join-Path $paths.PostgresRoot 'bin\initdb.exe'))) {
    Write-FuneralControlInstallLog -Path $logPath -Message 'Extraindo o PostgreSQL privado.'
    $postgresStaging = Join-Path $paths.StagingRoot 'postgresql'
    Remove-Item -LiteralPath $postgresStaging -Force -Recurse -ErrorAction SilentlyContinue
    Expand-FuneralControlSafeArchive -Archive $postgresArchive -Destination $postgresStaging
    Move-FuneralControlSingleRoot -StagingDirectory $postgresStaging -Destination $paths.PostgresRoot -RequiredRelativePath 'bin\initdb.exe'
    Write-FuneralControlInstallLog -Path $logPath -Message 'PostgreSQL privado extraído.'
  }

  $appRoot = Join-Path $paths.AppRoot $manifest.Runtime.Version
  if (-not (Test-Path -LiteralPath $appRoot)) {
    Write-FuneralControlInstallLog -Path $logPath -Message 'Extraindo o aplicativo local.'
    $appStaging = Join-Path $paths.StagingRoot 'application'
    Remove-Item -LiteralPath $appStaging -Force -Recurse -ErrorAction SilentlyContinue
    Expand-FuneralControlSafeArchive -Archive $runtimeArchive -Destination $appStaging
    foreach ($required in @('runtime-manifest.json', 'dist\server\server.js', 'node_modules\srvx\bin\srvx.mjs')) {
      if (-not (Test-Path -LiteralPath (Join-Path $appStaging $required))) { throw 'O pacote do aplicativo está incompleto.' }
    }
    New-Item -ItemType Directory -Path $paths.AppRoot -Force | Out-Null
    Move-Item -LiteralPath $appStaging -Destination $appRoot
    Write-FuneralControlInstallLog -Path $logPath -Message 'Aplicativo local extraído.'
  }
  Set-FuneralControlPhase -StatePath $paths.StatePath -Phase 'extracted' -State @{ appVersion = $manifest.Runtime.Version }

  Write-FuneralControlInstallLog -Path $logPath -Message 'Iniciando a configuração do banco local.'
  & (Join-Path $PSScriptRoot 'Configure-FuneralControlDatabaseV2.ps1') -InstallRoot $InstallRoot -DataRoot $DataRoot -RuntimePostgresRoot $paths.PostgresRoot -AuthorizedSid $sid -LogPath $logPath
  if (-not $?) { throw 'Não foi possível preparar o banco de dados local.' }

  Write-FuneralControlInstallLog -Path $logPath -Message 'Validando a inicialização do aplicativo local.'
  & (Join-Path $PSScriptRoot 'Start-FuneralControlV2.ps1') -InstallRoot $InstallRoot -DataRoot $DataRoot -NoBrowser
  if (-not $?) { throw 'Não foi possível validar o aplicativo local.' }

  $desktop = [Environment]::GetFolderPath('Desktop')
  Write-FuneralControlInstallLog -Path $logPath -Message 'Criando o atalho do sistema.'
  $shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $desktop 'FuneralControl.lnk'))
  $shortcut.TargetPath = Join-Path $InstallRoot 'FuneralControlV2.cmd'
  $shortcut.WorkingDirectory = $InstallRoot
  $shortcut.IconLocation = "$($shortcut.TargetPath),0"
  $shortcut.Save()
  Set-FuneralControlPhase -StatePath $paths.StatePath -Phase 'shortcutCreated' -State @{ appVersion = $manifest.Runtime.Version }
  Write-FuneralControlInstallLog -Path $logPath -Message 'Instalação v2 concluída e atalho criado.'
} catch {
  Write-FuneralControlInstallLog -Path $logPath -Message "Falha: $($_.Exception.Message)"
  throw
}

if ($AsJson) { $result | ConvertTo-Json -Compress }
