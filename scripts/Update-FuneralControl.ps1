[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)] [string]$PackageUrl,
  [Parameter(Mandatory = $true)] [string]$Sha256,
  [Parameter(Mandatory = $true)] [string]$InstallRoot,
  [switch]$BackupValidated,
  [switch]$DryRun,
  [switch]$AsJson
)

$ErrorActionPreference = 'Stop'
$preservedPaths = @('.env', 'data', 'uploads', 'backups')
$result = [ordered]@{ ok = $true; backupRequired = $true; preservedPaths = $preservedPaths }

if ($DryRun) {
  if ($AsJson) { $result | ConvertTo-Json -Compress }
  else { Write-Host 'A atualização exigirá backup validado e preservará os dados locais.' }
  exit 0
}

if (-not $BackupValidated) { throw 'A atualização exige um backup local validado antes de continuar.' }
if (-not (Test-Path -LiteralPath $InstallRoot -PathType Container)) { throw 'A pasta de instalação não foi encontrada.' }

$uri = [Uri]$PackageUrl
if ($uri.Scheme -ne 'https' -or $uri.Host -ne 'github.com' -or -not $uri.AbsolutePath.StartsWith('/pedras-sondere/FuneralControl/')) {
  throw 'O pacote de atualização não pertence ao repositório oficial.'
}
if ($Sha256 -notmatch '^[a-fA-F0-9]{64}$') { throw 'O hash da atualização é inválido.' }

$temporaryRoot = Join-Path ([IO.Path]::GetTempPath()) ("FuneralControl-update-" + [guid]::NewGuid())
$archivePath = Join-Path $temporaryRoot 'update.zip'
$stagingPath = Join-Path $temporaryRoot 'staging'
$rollbackPath = "$InstallRoot.previous"

try {
  New-Item -ItemType Directory -Path $temporaryRoot -Force | Out-Null
  Invoke-WebRequest -Uri $PackageUrl -OutFile $archivePath -UseBasicParsing
  $actualHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actualHash -ne $Sha256.ToLowerInvariant()) { throw 'A conferência de segurança do pacote falhou.' }
  Expand-Archive -LiteralPath $archivePath -DestinationPath $stagingPath -Force

  if (Test-Path -LiteralPath $rollbackPath) { Remove-Item -LiteralPath $rollbackPath -Recurse -Force }
  New-Item -ItemType Directory -Path $rollbackPath -Force | Out-Null
  Get-ChildItem -LiteralPath $InstallRoot -Force | Where-Object { $preservedPaths -notcontains $_.Name } |
    Copy-Item -Destination $rollbackPath -Recurse -Force

  Get-ChildItem -LiteralPath $stagingPath -Force | ForEach-Object {
    if ($preservedPaths -contains $_.Name) { throw "O pacote não pode conter a pasta protegida '$($_.Name)'." }
    Copy-Item -LiteralPath $_.FullName -Destination $InstallRoot -Recurse -Force
  }

  Start-Process -FilePath 'powershell.exe' -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $InstallRoot 'scripts\Start-FuneralControl.ps1'), '-InstallRoot', $InstallRoot
} catch {
  if (Test-Path -LiteralPath $rollbackPath) {
    Get-ChildItem -LiteralPath $rollbackPath -Force | Copy-Item -Destination $InstallRoot -Recurse -Force
  }
  throw
} finally {
  Remove-Item -LiteralPath $temporaryRoot -Recurse -Force -ErrorAction SilentlyContinue
}
