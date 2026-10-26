[CmdletBinding()]
param(
  [string]$InstallRoot = 'C:\Program Files\FuneralControl',
  [string]$DataRoot = 'C:\ProgramData\FuneralControl\v2',
  [switch]$NoBrowser,
  [switch]$DryRun,
  [switch]$AsJson
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'FuneralControlInstaller.Common.psm1') -Force

function Read-FuneralControlRuntimeConfig {
  param([Parameter(Mandatory)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw 'A configuração protegida do FuneralControl não foi encontrada.' }
  $ciphertext = Get-Content -LiteralPath $Path -Raw
  $plaintext = [System.Net.NetworkCredential]::new('', (ConvertTo-SecureString $ciphertext)).Password
  return $plaintext | ConvertFrom-Json
}

function Get-FuneralControlHealth {
  param([Parameter(Mandatory)][string]$Url)
  try {
    $response = Invoke-WebRequest -Uri "$Url/api/health" -UseBasicParsing -TimeoutSec 2
    return $response.Content | ConvertFrom-Json
  } catch { return $null }
}

$paths = Get-FuneralControlPaths -InstallRoot $InstallRoot -DataRoot $DataRoot
$result = [ordered]@{ ok = $true; url = 'http://127.0.0.1:3000'; startsPostgreSQL = $true; startsApplication = $true }
if ($DryRun) { if ($AsJson) { $result | ConvertTo-Json -Compress }; return }

$state = Read-FuneralControlState -StatePath $paths.StatePath
if (-not $state -or -not $state.appVersion) { throw 'O FuneralControl v2 não foi concluído. Execute novamente o instalador.' }
$config = Read-FuneralControlRuntimeConfig -Path (Join-Path $paths.ConfigRoot 'runtime.dpapi')
$currentSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
if ($config.authorizedSid -ne $currentSid) { throw 'Esta instalação pertence a outro usuário do Windows.' }

$appRoot = Join-Path $paths.AppRoot ([string]$state.appVersion)
$node = Join-Path $paths.NodeRoot 'node.exe'
$pgCtl = Join-Path $paths.PostgresRoot 'bin\pg_ctl.exe'
$pgIsReady = Join-Path $paths.PostgresRoot 'bin\pg_isready.exe'
$postgresLog = Join-Path $paths.LogRoot 'postgresql.log'
foreach ($required in @($appRoot, $node, $pgCtl, $pgIsReady)) {
  if (-not (Test-Path -LiteralPath $required)) { throw 'A instalação privada do FuneralControl está incompleta. Execute novamente o instalador.' }
}

& $pgIsReady '-h' '127.0.0.1' '-p' "$($config.port)" '-t' '1' | Out-Null
if ($LASTEXITCODE -ne 0) {
  & $pgCtl '-D' ([string]$config.postgresData) '-l' $postgresLog '-w' '-t' '30' 'start'
  if ($LASTEXITCODE -ne 0) { throw 'Não foi possível iniciar o banco de dados local do FuneralControl.' }
}

$health = Get-FuneralControlHealth -Url $result.url
if ($health -and $health.ok -and $health.version -eq $state.appVersion -and $health.schemaVersion -ge 1) {
  if (-not $NoBrowser) { Start-Process $result.url }
  if ($AsJson) { $result | ConvertTo-Json -Compress }
  return
}
if ($health -and $health.version -ne $state.appVersion) {
  throw 'Uma versão anterior do FuneralControl ainda está em execução. Feche-a antes de atualizar.'
}

$environment = [ordered]@{
  DATABASE_URL = [string]$config.databaseUrl
  DATABASE_SSL = 'false'
  INITIAL_ADMIN_EMAIL = [string]$config.initialAdminEmail
  INITIAL_ADMIN_PASSWORD = [string]$config.initialAdminPassword
  FUNERALCONTROL_APP_VERSION = [string]$state.appVersion
  FUNERALCONTROL_INSTALL_ROOT = $InstallRoot
  FUNERALCONTROL_DATA_ROOT = $DataRoot
  UPLOAD_DIR = $paths.UploadRoot
  FUNERALCONTROL_ALLOW_SCHEMA_MIGRATION = if ($state.phase -eq 'databaseConfigured') { 'true' } else { 'false' }
}
$originalEnvironment = @{}
foreach ($name in $environment.Keys) {
  $originalEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
  [Environment]::SetEnvironmentVariable($name, $environment[$name], 'Process')
}
try {
  $output = Join-Path $paths.LogRoot 'application.out.log'
  $errorOutput = Join-Path $paths.LogRoot 'application.err.log'
  $nodeArguments = @('node_modules/srvx/bin/srvx.mjs', 'serve', '--prod', '--host=127.0.0.1', '--port=3000', '--dir=.', '--static=dist/client', '--entry=dist/server/server.js')
  $applicationProcess = Start-Process -FilePath $node -ArgumentList $nodeArguments -WorkingDirectory $appRoot -WindowStyle Hidden -RedirectStandardOutput $output -RedirectStandardError $errorOutput -PassThru
} finally {
  foreach ($name in $environment.Keys) { [Environment]::SetEnvironmentVariable($name, $originalEnvironment[$name], 'Process') }
}

for ($attempt = 0; $attempt -lt 30; $attempt++) {
  Start-Sleep -Seconds 1
  $health = Get-FuneralControlHealth -Url $result.url
  if ($health -and $health.ok -and $health.version -eq $state.appVersion -and $health.schemaVersion -ge 1) {
    Set-FuneralControlPhase -StatePath $paths.StatePath -Phase 'appValidated' -State @{
      appVersion = $state.appVersion
      appPid = $applicationProcess.Id
      schemaVersion = [int]$health.schemaVersion
    }
    if (-not $NoBrowser) { Start-Process $result.url }
    if ($AsJson) { $result | ConvertTo-Json -Compress }
    return
  }
}

throw 'O FuneralControl não iniciou. Consulte os registros da aplicação e execute o instalador novamente.'
