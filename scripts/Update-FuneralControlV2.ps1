[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$PackageUrl,
  [Parameter(Mandatory)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$Sha256,
  [Parameter(Mandatory)][ValidatePattern('^\d+\.\d+\.\d+$')][string]$ExpectedVersion,
  [Parameter(Mandatory)][ValidateRange(1, [long]::MaxValue)][long]$ExpectedSize,
  [Parameter(Mandatory)][string]$InstallRoot,
  [string]$DataRoot = 'C:\ProgramData\FuneralControl\v2',
  [string]$LogPath = 'C:\ProgramData\FuneralControl-Installer\logs\atualizacao-atual.log',
  [switch]$BackupValidated,
  [switch]$DryRun,
  [switch]$AsJson
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'FuneralControlInstaller.Common.psm1') -Force

function Assert-FuneralControlUpdatePath {
  param([Parameter(Mandatory)][string]$Actual, [Parameter(Mandatory)][string]$Expected)
  $actualPath = [IO.Path]::GetFullPath($Actual).TrimEnd([IO.Path]::DirectorySeparatorChar)
  $expectedPath = [IO.Path]::GetFullPath($Expected).TrimEnd([IO.Path]::DirectorySeparatorChar)
  if (-not [string]::Equals($actualPath, $expectedPath, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'O atualizador só pode alterar a instalação oficial do FuneralControl.'
  }
  $actualPath
}

function Write-FuneralControlUpdateLog {
  param([Parameter(Mandatory)][string]$Stage, [Parameter(Mandatory)][string]$Message)
  $entry = [ordered]@{
    timestamp = (Get-Date).ToString('o')
    operation = 'Atualizacao'
    version = $ExpectedVersion
    stage = $Stage
    message = $Message
  } | ConvertTo-Json -Compress
  [IO.File]::AppendAllText($LogPath, "$entry`r`n", [Text.UTF8Encoding]::new($true))
}

$InstallRoot = Assert-FuneralControlUpdatePath -Actual $InstallRoot -Expected 'C:\Program Files\FuneralControl'
$DataRoot = Assert-FuneralControlUpdatePath -Actual $DataRoot -Expected 'C:\ProgramData\FuneralControl\v2'
$expectedAsset = "FuneralControl-runtime-$ExpectedVersion.zip"
$expectedPath = "/pedras-sondere/FuneralControl/releases/download/v$ExpectedVersion/$expectedAsset"
$uri = [uri]$PackageUrl
if ($uri.Scheme -ne 'https' -or $uri.Host -ne 'github.com' -or $uri.AbsolutePath -ne $expectedPath) {
  throw 'O pacote de atualização não pertence à versão publicada no repositório oficial.'
}

$result = [ordered]@{ ok = $true; backupRequired = $true; version = $ExpectedVersion; sideBySide = $true }
if ($DryRun) {
  if ($AsJson) { $result | ConvertTo-Json -Compress }
  exit 0
}
if (-not $BackupValidated) { throw 'A atualização exige um backup local validado antes de continuar.' }

$paths = Get-FuneralControlPaths -InstallRoot $InstallRoot -DataRoot $DataRoot
if (-not (Test-Path -LiteralPath $paths.StatePath -PathType Leaf)) { throw 'O estado da instalação não foi encontrado.' }
$originalStateJson = [IO.File]::ReadAllText($paths.StatePath)
$originalState = $originalStateJson | ConvertFrom-Json
$candidateRoot = Join-Path $paths.AppRoot $ExpectedVersion
$temporaryRoot = Join-Path ([IO.Path]::GetTempPath()) ("FuneralControl-update-$([guid]::NewGuid().ToString('N'))")
$archivePath = Join-Path $temporaryRoot $expectedAsset
$stagingPath = Join-Path $temporaryRoot 'staging'
$candidateInstalled = $false

New-Item -ItemType Directory -Path (Split-Path -Parent $LogPath) -Force | Out-Null
[IO.File]::WriteAllText($LogPath, '', [Text.UTF8Encoding]::new($true))

try {
  Write-FuneralControlUpdateLog -Stage 'encerramento' -Message 'Aguardando o encerramento da versão em uso.'
  Start-Sleep -Seconds 3
  $nodePath = [IO.Path]::GetFullPath((Join-Path $paths.NodeRoot 'node.exe'))
  $originalPid = if ($originalState.PSObject.Properties.Name -contains 'appPid') { [int]$originalState.appPid } else { 0 }
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    $privateProcesses = @(Get-CimInstance Win32_Process -Filter "ProcessId = $originalPid" -ErrorAction SilentlyContinue | Where-Object {
      $_.ExecutablePath -and
      [string]::Equals([IO.Path]::GetFullPath([string]$_.ExecutablePath), $nodePath, [StringComparison]::OrdinalIgnoreCase)
    })
    if ($privateProcesses.Count -eq 0) { break }
    Start-Sleep -Seconds 1
  }
  foreach ($process in $privateProcesses) {
    Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
  }

  Write-FuneralControlUpdateLog -Stage 'download' -Message 'Baixando o runtime versionado do GitHub Releases.'
  New-Item -ItemType Directory -Path $temporaryRoot -Force | Out-Null
  Invoke-WebRequest -Uri $PackageUrl -OutFile $archivePath -UseBasicParsing
  if ((Get-Item -LiteralPath $archivePath).Length -ne $ExpectedSize) { throw 'O tamanho do pacote de atualização não confere.' }
  $actualHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash
  if ($actualHash -ne $Sha256) { throw 'O SHA-256 do pacote de atualização não confere.' }

  Write-FuneralControlUpdateLog -Stage 'extracao' -Message 'Extraindo o runtime em área temporária protegida.'
  Expand-FuneralControlSafeArchive -Archive $archivePath -Destination $stagingPath
  $allowedTopLevel = @('package.json', 'package-lock.json', 'dist', 'node_modules', 'runtime-manifest.json')
  $unexpected = @(Get-ChildItem -Force -LiteralPath $stagingPath | Where-Object { $allowedTopLevel -notcontains $_.Name })
  if ($unexpected.Count -gt 0) { throw 'O pacote de atualização contém arquivos fora da lista permitida.' }
  foreach ($required in @('runtime-manifest.json', 'dist\server\server.js', 'node_modules\srvx\bin\srvx.mjs')) {
    if (-not (Test-Path -LiteralPath (Join-Path $stagingPath $required))) { throw 'O pacote de atualização está incompleto.' }
  }
  $runtimeManifest = Get-Content -Raw -LiteralPath (Join-Path $stagingPath 'runtime-manifest.json') | ConvertFrom-Json
  if ([int]$runtimeManifest.schemaVersion -ne 1 -or [string]$runtimeManifest.version -ne $ExpectedVersion) {
    throw 'A identidade interna do pacote de atualização não confere.'
  }
  if (Test-Path -LiteralPath $candidateRoot) { throw 'A versão candidata já existe. Execute a Desinstalação completa se a instalação anterior ficou inconsistente.' }

  New-Item -ItemType Directory -Path $paths.AppRoot -Force | Out-Null
  Move-Item -LiteralPath $stagingPath -Destination $candidateRoot
  $candidateInstalled = $true

  Write-FuneralControlUpdateLog -Stage 'ativacao' -Message 'Ativando e validando a nova versão local.'
  Set-FuneralControlPhase -StatePath $paths.StatePath -Phase 'databaseConfigured' -State @{
    appVersion = $ExpectedVersion
    previousAppVersion = [string]$originalState.appVersion
    updatedAt = (Get-Date).ToUniversalTime().ToString('o')
  }
  & (Join-Path $PSScriptRoot 'Start-FuneralControlV2.ps1') -InstallRoot $InstallRoot -DataRoot $DataRoot -NoBrowser
  if (-not $?) { throw 'A nova versão não passou na verificação de inicialização.' }
  Write-FuneralControlUpdateLog -Stage 'concluida' -Message 'Atualização instalada e validada com sucesso.'
} catch {
  [IO.File]::WriteAllText($paths.StatePath, $originalStateJson, [Text.UTF8Encoding]::new($false))
  if ($candidateInstalled -and (Test-Path -LiteralPath $candidateRoot)) {
    Remove-Item -LiteralPath $candidateRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
  Write-FuneralControlUpdateLog -Stage 'reversao' -Message "Falha; versão anterior restaurada: $($_.Exception.Message)"
  try { & (Join-Path $PSScriptRoot 'Start-FuneralControlV2.ps1') -InstallRoot $InstallRoot -DataRoot $DataRoot -NoBrowser } catch {}
  throw
} finally {
  if (Test-Path -LiteralPath $temporaryRoot) { Remove-Item -LiteralPath $temporaryRoot -Recurse -Force -ErrorAction SilentlyContinue }
}

if ($AsJson) { $result | ConvertTo-Json -Compress }
