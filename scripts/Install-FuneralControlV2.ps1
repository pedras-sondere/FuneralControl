[CmdletBinding()]
param(
  [string]$InstallRoot = 'C:\Program Files\FuneralControl',
  [string]$DataRoot = 'C:\ProgramData\FuneralControl\v2',
  [string]$DiagnosticRoot = (Join-Path $env:ProgramData 'FuneralControl-Installer\logs'),
  [string]$DesktopPath = [Environment]::GetFolderPath('Desktop'),
  [string]$ManifestPath = (Join-Path $PSScriptRoot '..\installer\FuneralControlV2.manifest.psd1'),
  [switch]$DryRun,
  [switch]$AsJson
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'FuneralControlInstaller.Common.psm1') -Force

$runId = [guid]::NewGuid().ToString('N')
$currentStage = 'inicializacao'
$installerVersion = 'desconhecida'
$installerBuild = 'desconhecido'

function Protect-FuneralControlLogText {
  param([Parameter(Mandatory)][string]$Message)
  $safe = $Message -replace '(?i)(postgres(?:ql)?://)[^@\s]+@', '$1[REMOVIDO]@'
  $safe -replace '(?i)(password|senha)\s*[:=]\s*[^\s;]+', '$1=[REMOVIDO]'
}

function Write-FuneralControlInstallLog {
  param(
    [Parameter(Mandatory)][string]$Path,
    [Parameter(Mandatory)][string]$Message,
    [ValidateSet('INFO', 'ERRO')][string]$Level = 'INFO'
  )
  New-Item -ItemType Directory -Path (Split-Path -Parent $Path) -Force | Out-Null
  $safeMessage = Protect-FuneralControlLogText -Message $Message
  $entry = [ordered]@{
    timestamp = (Get-Date).ToString('o')
    operation = 'Instalacao'
    runId = $script:runId
    installerVersion = $script:installerVersion
    installerBuild = $script:installerBuild
    stage = $script:currentStage
    level = $Level
    message = $safeMessage
  }
  Write-Host $safeMessage
  $line = $entry | ConvertTo-Json -Compress
  [IO.File]::AppendAllText($Path, "$line`r`n", [Text.UTF8Encoding]::new($true))
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
  param([Parameter(Mandatory)]$Asset, [Parameter(Mandatory)][string]$AllowedHost)
  $uri = [uri]$Asset.Url
  if ($uri.Scheme -ne 'https' -or -not [string]::Equals($uri.Host, $AllowedHost, [StringComparison]::OrdinalIgnoreCase)) {
    throw "O manifesto contém uma origem de download não autorizada: $($uri.Host)."
  }
  if ($Asset.Sha256 -notmatch '^[a-fA-F0-9]{64}$') { throw 'O manifesto contém um SHA-256 inválido.' }
  if ([long]$Asset.Size -lt 1) { throw 'O manifesto contém um tamanho inválido.' }
}

function Get-FuneralControlAsset {
  param(
    [Parameter(Mandatory)]$Asset,
    [Parameter(Mandatory)][string]$AllowedHost,
    [Parameter(Mandatory)][string]$StagingRoot
  )
  Assert-FuneralControlAsset -Asset $Asset -AllowedHost $AllowedHost
  $name = [IO.Path]::GetFileName(([uri]$Asset.Url).AbsolutePath)
  if ([string]::IsNullOrWhiteSpace($name)) { throw 'O nome do arquivo de download é inválido.' }
  $destination = Join-Path $StagingRoot $name
  $partial = "$destination.partial"
  Remove-Item -LiteralPath $partial -Force -ErrorAction SilentlyContinue
  if (Test-Path -LiteralPath $destination) {
    throw "A pasta temporária exclusiva já contém o arquivo $name."
  }
  Invoke-WebRequest -Uri $Asset.Url -OutFile $partial -UseBasicParsing
  if ((Get-Item -LiteralPath $partial).Length -ne [long]$Asset.Size) { throw "O tamanho do arquivo $name não confere." }
  $hash = (Get-FileHash -LiteralPath $partial -Algorithm SHA256).Hash
  if ($hash -ne $Asset.Sha256) { throw "O SHA-256 do arquivo $name não confere." }
  [IO.File]::Move($partial, $destination)
  return $destination
}

function Assert-FuneralControlPrerequisites {
  param([Parameter(Mandatory)][string]$TargetRoot, [Parameter(Mandatory)]$Manifest)

  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($identity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'A Instalação precisa ser executada com permissões de administrador.'
  }
  if (-not [Environment]::Is64BitOperatingSystem) {
    throw 'O FuneralControl requer Windows de 64 bits.'
  }

  $driveRoot = [IO.Path]::GetPathRoot([IO.Path]::GetFullPath($TargetRoot))
  $drive = Get-PSDrive -Name $driveRoot.Substring(0, 1) -PSProvider FileSystem
  if ([long]$drive.Free -lt 4GB) {
    throw 'São necessários pelo menos 4 GB livres no disco de instalação.'
  }

  foreach ($hostName in @('github.com', 'nodejs.org', 'get.enterprisedb.com')) {
    try {
      if ([Net.Dns]::GetHostAddresses($hostName).Count -lt 1) { throw 'Nenhum endereço foi retornado.' }
    } catch {
      throw "Não foi possível acessar a origem necessária $hostName. Verifique a conexão com a internet."
    }
  }

  Assert-FuneralControlAsset -Asset $Manifest.Runtime -AllowedHost 'github.com'
  Assert-FuneralControlAsset -Asset $Manifest.Node -AllowedHost 'nodejs.org'
  Assert-FuneralControlAsset -Asset $Manifest.PostgreSQL -AllowedHost 'get.enterprisedb.com'
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
$runStagingRoot = Join-Path $paths.StagingRoot $runId
$result = [ordered]@{ ok = $true; installRoot = $InstallRoot; dataRoot = $DataRoot; desktopShortcut = $true }
if ($DryRun) { if ($AsJson) { $result | ConvertTo-Json -Compress }; exit 0 }

$logPath = Join-Path $DiagnosticRoot 'instalacao-atual.log'
New-Item -ItemType Directory -Path $DiagnosticRoot -Force | Out-Null
[IO.File]::WriteAllText($logPath, '', [Text.UTF8Encoding]::new($true))
try {
  $currentStage = 'manifesto'
  if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) { throw 'O manifesto do instalador v2 não foi encontrado.' }
  $manifest = Import-PowerShellDataFile -LiteralPath $ManifestPath
  if ($manifest.SchemaVersion -ne 2) { throw 'A versão do manifesto do instalador é incompatível.' }
  if (-not $manifest.Installer -or [string]::IsNullOrWhiteSpace($manifest.Installer.Version) -or [string]::IsNullOrWhiteSpace($manifest.Installer.BuildId)) {
    throw 'O manifesto não identifica a versão e a compilação do instalador.'
  }
  $installerVersion = [string]$manifest.Installer.Version
  $installerBuild = [string]$manifest.Installer.BuildId
  Assert-FuneralControlPrerequisites -TargetRoot $InstallRoot -Manifest $manifest
  if ($manifest.Runtime.Asset -ne "FuneralControl-runtime-$($manifest.Runtime.Version).zip") { throw 'O pacote do aplicativo não corresponde à versão informada.' }
  if ([IO.Path]::GetFileName(([uri]$manifest.Node.Url).AbsolutePath) -ne "node-v$($manifest.Node.Version)-win-x64.zip") {
    throw 'O pacote do Node.js não corresponde à versão ou arquitetura informada.'
  }
  if ([IO.Path]::GetFileName(([uri]$manifest.PostgreSQL.Url).AbsolutePath) -ne "postgresql-$($manifest.PostgreSQL.Version)-windows-x64-binaries.zip") {
    throw 'O pacote do PostgreSQL não corresponde à versão ou arquitetura informada.'
  }

  New-Item -ItemType Directory -Path $runStagingRoot, $paths.LogRoot -Force | Out-Null
  $currentStage = 'pre-verificacao'
  Write-FuneralControlInstallLog -Path $logPath -Message 'Pré-verificação do instalador v2 concluída.'
  $sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $currentStage = 'estado'
  Write-FuneralControlInstallLog -Path $logPath -Message 'Verificando o acesso ao estado da instalação.'
  Repair-FuneralControlStateAccess -StatePath $paths.StatePath -Sid $sid
  Set-FuneralControlPhase -StatePath $paths.StatePath -Phase 'prechecked' -State @{
    appVersion = $manifest.Runtime.Version
    installerVersion = $installerVersion
    installerBuild = $installerBuild
    runId = $runId
  }
  $ownershipMarker = Join-Path (Split-Path -Parent $paths.StatePath) 'managed-installation.json'
  $ownershipPayload = [ordered]@{
    product = 'FuneralControl'
    installerVersion = $installerVersion
    installerBuild = $installerBuild
    createdAt = (Get-Date).ToUniversalTime().ToString('o')
  } | ConvertTo-Json -Compress
  [IO.File]::WriteAllText($ownershipMarker, $ownershipPayload, [Text.UTF8Encoding]::new($false))

  $currentStage = 'downloads'
  $nodeArchive = Get-FuneralControlAsset -Asset $manifest.Node -AllowedHost 'nodejs.org' -StagingRoot $runStagingRoot
  $postgresArchive = Get-FuneralControlAsset -Asset $manifest.PostgreSQL -AllowedHost 'get.enterprisedb.com' -StagingRoot $runStagingRoot
  $runtimeArchive = Get-FuneralControlAsset -Asset $manifest.Runtime -AllowedHost 'github.com' -StagingRoot $runStagingRoot
  Set-FuneralControlPhase -StatePath $paths.StatePath -Phase 'verified' -State @{
    appVersion = $manifest.Runtime.Version
    installerVersion = $installerVersion
    installerBuild = $installerBuild
    runId = $runId
  }
  Write-FuneralControlInstallLog -Path $logPath -Message 'Downloads conferidos por tamanho e SHA-256.'

  if (-not (Test-Path -LiteralPath (Join-Path $paths.NodeRoot 'node.exe'))) {
    $currentStage = 'extracao-node'
    Write-FuneralControlInstallLog -Path $logPath -Message 'Extraindo o Node.js privado.'
    $nodeStaging = Join-Path $runStagingRoot 'node'
    Remove-Item -LiteralPath $nodeStaging -Force -Recurse -ErrorAction SilentlyContinue
    Expand-FuneralControlSafeArchive -Archive $nodeArchive -Destination $nodeStaging
    Move-FuneralControlSingleRoot -StagingDirectory $nodeStaging -Destination $paths.NodeRoot -RequiredRelativePath 'node.exe'
    Write-FuneralControlInstallLog -Path $logPath -Message 'Node.js privado extraído.'
  }
  if (-not (Test-Path -LiteralPath (Join-Path $paths.PostgresRoot 'bin\initdb.exe'))) {
    $currentStage = 'extracao-postgresql'
    Write-FuneralControlInstallLog -Path $logPath -Message 'Extraindo o PostgreSQL privado.'
    $postgresStaging = Join-Path $runStagingRoot 'postgresql'
    Remove-Item -LiteralPath $postgresStaging -Force -Recurse -ErrorAction SilentlyContinue
    Expand-FuneralControlSafeArchive -Archive $postgresArchive -Destination $postgresStaging
    Move-FuneralControlSingleRoot -StagingDirectory $postgresStaging -Destination $paths.PostgresRoot -RequiredRelativePath 'bin\initdb.exe'
    Write-FuneralControlInstallLog -Path $logPath -Message 'PostgreSQL privado extraído.'
  }

  $currentStage = 'validacao-runtimes'
  $nodeVersion = (& (Join-Path $paths.NodeRoot 'node.exe') '--version').Trim()
  if ($LASTEXITCODE -ne 0 -or $nodeVersion -ne "v$($manifest.Node.Version)") {
    throw "A versão do Node.js privado não confere. Esperado: $($manifest.Node.Version); obtido: $nodeVersion."
  }
  $postgresVersion = (& (Join-Path $paths.PostgresRoot 'bin\postgres.exe') '--version').Trim()
  $expectedPostgresVersion = ([string]$manifest.PostgreSQL.Version -split '-')[0]
  if ($LASTEXITCODE -ne 0 -or $postgresVersion -notmatch [regex]::Escape($expectedPostgresVersion)) {
    throw "A versão do PostgreSQL privado não confere. Esperado: $expectedPostgresVersion; obtido: $postgresVersion."
  }
  Write-FuneralControlInstallLog -Path $logPath -Message 'Node.js e PostgreSQL privados validados por versão.'

  $appRoot = Join-Path $paths.AppRoot $manifest.Runtime.Version
  if (-not (Test-Path -LiteralPath $appRoot)) {
    $currentStage = 'extracao-aplicativo'
    Write-FuneralControlInstallLog -Path $logPath -Message 'Extraindo o aplicativo local.'
    $appStaging = Join-Path $runStagingRoot 'application'
    Remove-Item -LiteralPath $appStaging -Force -Recurse -ErrorAction SilentlyContinue
    Expand-FuneralControlSafeArchive -Archive $runtimeArchive -Destination $appStaging
    foreach ($required in @('runtime-manifest.json', 'dist\server\server.js', 'node_modules\srvx\bin\srvx.mjs')) {
      if (-not (Test-Path -LiteralPath (Join-Path $appStaging $required))) { throw 'O pacote do aplicativo está incompleto.' }
    }
    New-Item -ItemType Directory -Path $paths.AppRoot -Force | Out-Null
    Move-Item -LiteralPath $appStaging -Destination $appRoot
    Write-FuneralControlInstallLog -Path $logPath -Message 'Aplicativo local extraído.'
  }
  Set-FuneralControlPhase -StatePath $paths.StatePath -Phase 'extracted' -State @{
    appVersion = $manifest.Runtime.Version
    installerVersion = $installerVersion
    installerBuild = $installerBuild
    runId = $runId
  }

  $currentStage = 'banco-de-dados'
  Write-FuneralControlInstallLog -Path $logPath -Message 'Iniciando a configuração do banco local.'
  & (Join-Path $PSScriptRoot 'Configure-FuneralControlDatabaseV2.ps1') -InstallRoot $InstallRoot -DataRoot $DataRoot -RuntimePostgresRoot $paths.PostgresRoot -AuthorizedSid $sid -LogPath $logPath
  if (-not $?) { throw 'Não foi possível preparar o banco de dados local.' }
  Repair-FuneralControlStateAccess -StatePath $paths.StatePath -Sid $sid
  Set-FuneralControlPhase -StatePath $paths.StatePath -Phase 'databaseConfigured' -State @{
    appVersion = $manifest.Runtime.Version
    installerVersion = $installerVersion
    installerBuild = $installerBuild
    runId = $runId
    port = 54329
    authorizedSid = $sid
  }

  $currentStage = 'validacao-aplicativo'
  Write-FuneralControlInstallLog -Path $logPath -Message 'Validando a inicialização do aplicativo local.'
  & (Join-Path $PSScriptRoot 'Start-FuneralControlV2.ps1') -InstallRoot $InstallRoot -DataRoot $DataRoot -NoBrowser
  if (-not $?) { throw 'Não foi possível validar o aplicativo local.' }

  $desktop = [IO.Path]::GetFullPath($DesktopPath)
  if (-not (Test-Path -LiteralPath $desktop -PathType Container)) { throw 'A pasta Área de Trabalho informada não existe.' }
  $currentStage = 'atalho'
  Write-FuneralControlInstallLog -Path $logPath -Message 'Criando o atalho do sistema.'
  $shortcutPath = Join-Path $desktop 'FuneralControl.lnk'
  $targetPath = Join-Path $InstallRoot 'FuneralControlV2.cmd'
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = $targetPath
  $shortcut.WorkingDirectory = $InstallRoot
  $shortcut.IconLocation = "$($shortcut.TargetPath),0"
  $shortcut.Save()
  if (-not (Test-Path -LiteralPath $shortcutPath -PathType Leaf)) { throw 'O Windows não criou o atalho do FuneralControl.' }
  $verifiedShortcut = $shell.CreateShortcut($shortcutPath)
  if (-not [string]::Equals([IO.Path]::GetFullPath($verifiedShortcut.TargetPath), [IO.Path]::GetFullPath($targetPath), [StringComparison]::OrdinalIgnoreCase)) {
    Remove-Item -LiteralPath $shortcutPath -Force -ErrorAction SilentlyContinue
    throw 'O atalho criado não aponta para o lançador esperado.'
  }
  Set-FuneralControlPhase -StatePath $paths.StatePath -Phase 'shortcutCreated' -State @{
    appVersion = $manifest.Runtime.Version
    installerVersion = $installerVersion
    installerBuild = $installerBuild
    runId = $runId
  }
  Write-FuneralControlInstallLog -Path $logPath -Message 'Instalação v2 concluída e atalho criado.'
} catch {
  $failureType = $_.Exception.GetType().FullName
  Write-FuneralControlInstallLog -Path $logPath -Level 'ERRO' -Message "Falha [$failureType]: $($_.Exception.Message)"
  throw
} finally {
  Remove-Item -LiteralPath $runStagingRoot -Recurse -Force -ErrorAction SilentlyContinue
}

if ($AsJson) { $result | ConvertTo-Json -Compress }
