[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$InstallRoot,
  [Parameter(Mandatory)][string]$DataRoot,
  [Parameter(Mandatory)][string]$RuntimePostgresRoot,
  [Parameter(Mandatory)][string]$AuthorizedSid,
  [ValidatePattern('^[^\s@]+@[^\s@]+\.[^\s@]+$')][string]$InitialAdminEmail = 'admin@local.funeralcontrol',
  [ValidateLength(5, 256)][string]$InitialAdminPassword = 'admin',
  [int]$Port = 54329,
  [switch]$DryRun,
  [switch]$AsJson
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'FuneralControlInstaller.Common.psm1') -Force

function Assert-LastExitCode {
  param([Parameter(Mandatory)][string]$Action)
  if ($LASTEXITCODE -ne 0) { throw "Não foi possível $Action." }
}

function Read-FuneralControlProtectedConfig {
  param([Parameter(Mandatory)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
  $ciphertext = Get-Content -LiteralPath $Path -Raw
  $plaintext = [System.Net.NetworkCredential]::new('', (ConvertTo-SecureString $ciphertext)).Password
  return $plaintext | ConvertFrom-Json
}

function Set-FuneralControlProtectedConfig {
  param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)]$Config)
  $json = $Config | ConvertTo-Json -Depth 8 -Compress
  $ciphertext = ConvertTo-SecureString $json -AsPlainText -Force | ConvertFrom-SecureString
  Set-Content -LiteralPath $Path -Value $ciphertext -Encoding UTF8 -NoNewline
}

function Protect-FuneralControlData {
  param([Parameter(Mandatory)][string]$Directory, [Parameter(Mandatory)][string]$Sid)
  New-Item -ItemType Directory -Path $Directory -Force | Out-Null
  $output = & icacls.exe $Directory '/inheritance:r' '/grant:r' "*${Sid}:(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' '/T' '/C' 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "Não foi possível proteger os arquivos locais da instalação (icacls $LASTEXITCODE): $($output -join ' ')"
  }
}

$paths = Get-FuneralControlPaths -InstallRoot $InstallRoot -DataRoot $DataRoot
$initdb = Join-Path $RuntimePostgresRoot 'bin\initdb.exe'
$pgCtl = Join-Path $RuntimePostgresRoot 'bin\pg_ctl.exe'
$psql = Join-Path $RuntimePostgresRoot 'bin\psql.exe'
$pgIsReady = Join-Path $RuntimePostgresRoot 'bin\pg_isready.exe'
foreach ($tool in @($initdb, $pgCtl, $psql, $pgIsReady)) {
  if (-not (Test-Path -LiteralPath $tool -PathType Leaf)) {
    throw 'O runtime PostgreSQL privado está incompleto.'
  }
}

$result = @{ ok = $true; database = 'funeralcontrol'; databaseUser = 'funeralcontrol_app'; port = $Port }
if ($DryRun) { if ($AsJson) { $result | ConvertTo-Json -Compress }; exit 0 }

if ((Test-Path $paths.PostgresData) -and -not (Test-Path $paths.StatePath)) {
  throw 'O diretório de dados não pertence a uma instalação v2 válida.'
}

Protect-FuneralControlData -Directory $DataRoot -Sid $AuthorizedSid
foreach ($directory in @($paths.ConfigRoot, $paths.UploadRoot, $paths.StagingRoot, $paths.LogRoot)) {
  Protect-FuneralControlData -Directory $directory -Sid $AuthorizedSid
}

$configPath = Join-Path $paths.ConfigRoot 'runtime.dpapi'
$existingConfig = Read-FuneralControlProtectedConfig -Path $configPath
$clusterExists = Test-Path -LiteralPath (Join-Path $paths.PostgresData 'PG_VERSION') -PathType Leaf
$secretFile = Join-Path $paths.StagingRoot ("postgres-" + [guid]::NewGuid() + '.secret')
$originalPgPassword = $env:PGPASSWORD

try {
  if (-not $clusterExists) {
    $bootstrapPassword = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
    New-Item -ItemType Directory -Path $paths.PostgresData -Force | Out-Null
    Set-Content -LiteralPath $secretFile -Value $bootstrapPassword -Encoding ASCII -NoNewline
    & $initdb '-D' $paths.PostgresData '--encoding=UTF8' '--auth=scram-sha-256' '--username=funeralcontrol_bootstrap' "--pwfile=$secretFile" | Out-Null
    Assert-LastExitCode 'inicializar o PostgreSQL privado'
  } else {
    if (-not $existingConfig -or -not $existingConfig.bootstrapPassword) {
      throw 'A configuração protegida do PostgreSQL privado não está disponível para esta conta do Windows.'
    }
    $bootstrapPassword = [string]$existingConfig.bootstrapPassword
  }

  $postgresConf = Join-Path $paths.PostgresData 'postgresql.conf'
  if (-not (Select-String -LiteralPath $postgresConf -SimpleMatch '# FuneralControl V2' -Quiet)) {
    Add-Content -LiteralPath $postgresConf -Encoding UTF8 -Value @"

# FuneralControl V2
listen_addresses = '127.0.0.1'
port = $Port
password_encryption = 'scram-sha-256'
"@
  }

  & $pgIsReady '-h' '127.0.0.1' '-p' "$Port" '-t' '1' | Out-Null
  if ($LASTEXITCODE -ne 0) {
    & $pgCtl '-D' $paths.PostgresData '-w' '-t' '30' 'start' | Out-Null
    Assert-LastExitCode 'iniciar o PostgreSQL privado'
  }

  $env:PGPASSWORD = $bootstrapPassword
  $psqlArguments = @('--no-psqlrc', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', "$Port", '-U', 'funeralcontrol_bootstrap', '-d', 'postgres')
  & $psql @psqlArguments '-c' 'SELECT 1' | Out-Null
  Assert-LastExitCode 'validar o PostgreSQL privado'

  $appPassword = if ($existingConfig -and $existingConfig.appPassword) { [string]$existingConfig.appPassword } else { [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N') }
  $roleSql = @"
DO `$$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'funeralcontrol_app') THEN
    CREATE ROLE funeralcontrol_app LOGIN PASSWORD '$appPassword';
  END IF;
END
`$$;
ALTER ROLE funeralcontrol_app PASSWORD '$appPassword';
"@
  & $psql @psqlArguments '-c' $roleSql | Out-Null
  Assert-LastExitCode 'configurar o usuário do banco de dados'

  $databaseExists = & $psql @psqlArguments '-tAc' "SELECT 1 FROM pg_database WHERE datname = 'funeralcontrol'"
  Assert-LastExitCode 'consultar o banco de dados local'
  if (-not (($databaseExists | Out-String).Trim() -eq '1')) {
    & $psql @psqlArguments '-c' 'CREATE DATABASE funeralcontrol OWNER funeralcontrol_app' | Out-Null
    Assert-LastExitCode 'criar o banco de dados local'
  }

  $databaseUrl = "postgresql://funeralcontrol_app:$appPassword@127.0.0.1:$Port/funeralcontrol"
  $protectedConfig = [ordered]@{
    format = 2
    authorizedSid = $AuthorizedSid
    port = $Port
    uploadDir = $paths.UploadRoot
    postgresData = $paths.PostgresData
    databaseUrl = $databaseUrl
    bootstrapPassword = $bootstrapPassword
    appPassword = $appPassword
    initialAdminEmail = $InitialAdminEmail
    initialAdminPassword = $InitialAdminPassword
  }
  Set-FuneralControlProtectedConfig -Path $configPath -Config $protectedConfig
  Protect-FuneralControlData -Directory $paths.ConfigRoot -Sid $AuthorizedSid
  Set-FuneralControlPhase -StatePath $paths.StatePath -Phase 'databaseConfigured' -State @{ port = $Port; authorizedSid = $AuthorizedSid }
} finally {
  if ($null -eq $originalPgPassword) { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue } else { $env:PGPASSWORD = $originalPgPassword }
  Remove-Item -LiteralPath $secretFile -Force -ErrorAction SilentlyContinue
}

if ($AsJson) { $result | ConvertTo-Json -Compress }
