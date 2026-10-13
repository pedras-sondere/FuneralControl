[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$InstallRoot,
  [Parameter(Mandatory)][string]$DataRoot,
  [Parameter(Mandatory)][string]$RuntimePostgresRoot,
  [Parameter(Mandatory)][string]$AuthorizedSid,
  [int]$Port = 54329,
  [switch]$DryRun,
  [switch]$AsJson
)

$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'FuneralControlInstaller.Common.psm1') -Force
$paths = Get-FuneralControlPaths -InstallRoot $InstallRoot -DataRoot $DataRoot
$initdb = Join-Path $RuntimePostgresRoot 'bin\initdb.exe'
$pgCtl = Join-Path $RuntimePostgresRoot 'bin\pg_ctl.exe'
$psql = Join-Path $RuntimePostgresRoot 'bin\psql.exe'
foreach ($tool in @($initdb, $pgCtl, $psql)) { if (-not (Test-Path -LiteralPath $tool)) { throw 'O runtime PostgreSQL privado está incompleto.' } }
$result = @{ ok = $true; database = 'funeralcontrol'; databaseUser = 'funeralcontrol_app'; port = $Port }
if ($DryRun) { if ($AsJson) { $result | ConvertTo-Json -Compress }; exit 0 }
if ((Test-Path $paths.PostgresData) -and -not (Test-Path $paths.StatePath)) { throw 'O diretório de dados não pertence a uma instalação v2 válida.' }
New-Item -ItemType Directory -Path $DataRoot, $paths.ConfigRoot, $paths.UploadRoot, $paths.StagingRoot -Force | Out-Null
$secretFile = Join-Path $paths.StagingRoot ("postgres-" + [guid]::NewGuid() + '.secret')
try {
  $secret = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
  Set-Content -LiteralPath $secretFile -Value $secret -Encoding ASCII -NoNewline
  if (-not (Test-Path $paths.PostgresData)) { & $initdb '-D' $paths.PostgresData '--encoding=UTF8' '--auth=scram-sha-256' "--pwfile=$secretFile" | Out-Null }
  Add-Content (Join-Path $paths.PostgresData 'postgresql.conf') "listen_addresses = '127.0.0.1'`nport = $Port"
  & $pgCtl '-D' $paths.PostgresData '-w' 'start' | Out-Null
  $config = @{ authorizedSid = $AuthorizedSid; port = $Port; uploadDir = $paths.UploadRoot } | ConvertTo-Json -Compress
  (ConvertTo-SecureString $config -AsPlainText -Force | ConvertFrom-SecureString) | Set-Content (Join-Path $paths.ConfigRoot 'runtime.dpapi') -Encoding UTF8
  Set-FuneralControlPhase -StatePath $paths.StatePath -Phase 'databaseConfigured' -State @{ port = $Port; authorizedSid = $AuthorizedSid }
} finally { Remove-Item -LiteralPath $secretFile -Force -ErrorAction SilentlyContinue }
if ($AsJson) { $result | ConvertTo-Json -Compress }
