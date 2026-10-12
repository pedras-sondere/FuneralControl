[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)] [string]$InstallRoot,
  [string]$DataRoot = (Join-Path $env:ProgramData 'FuneralControl'),
  [string]$PostgresAdminPassword,
  [string]$DatabasePassword,
  [switch]$DryRun,
  [switch]$AsJson
)

$ErrorActionPreference = 'Stop'
$database = 'funeralcontrol'
$databaseUser = 'funeralcontrol_app'
$result = [ordered]@{
  ok = $true
  database = $database
  databaseUser = $databaseUser
  requiresPostgreSQL = $true
}

if ($DryRun) {
  if ($AsJson) { $result | ConvertTo-Json -Compress }
  else { Write-Host 'O banco local do FuneralControl será configurado sem substituir uma configuração existente.' }
  exit 0
}

function Get-PostgresBin {
  $psql = Get-Command psql.exe -ErrorAction SilentlyContinue
  if ($psql) { return (Split-Path -Parent $psql.Source) }

  $postgresRoot = Join-Path $env:ProgramFiles 'PostgreSQL'
  if (Test-Path -LiteralPath $postgresRoot) {
    $candidate = Get-ChildItem -Path $postgresRoot -Filter psql.exe -Recurse -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if ($candidate) { return (Split-Path -Parent $candidate.FullName) }
  }
  throw 'As ferramentas do PostgreSQL não foram encontradas. Execute novamente o instalador.'
}

function New-LocalSecret {
  $alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'.ToCharArray()
  -join (1..32 | ForEach-Object { $alphabet[(Get-Random -Maximum $alphabet.Length)] })
}

if (-not (Test-Path -LiteralPath $InstallRoot -PathType Container)) {
  throw 'A pasta de instalação do FuneralControl não foi encontrada.'
}

$configPath = Join-Path $InstallRoot '.env'
if (Test-Path -LiteralPath $configPath) {
  Write-Host 'A configuração local existente foi preservada.'
  exit 0
}

if ([string]::IsNullOrWhiteSpace($PostgresAdminPassword)) {
  throw 'A senha administrativa do PostgreSQL é necessária para criar o banco local.'
}
if ([string]::IsNullOrWhiteSpace($DatabasePassword)) { $DatabasePassword = New-LocalSecret }

$postgresBin = Get-PostgresBin
$psql = Join-Path $postgresBin 'psql.exe'
$createdb = Join-Path $postgresBin 'createdb.exe'
$oldPassword = $env:PGPASSWORD
$env:PGPASSWORD = $PostgresAdminPassword
try {
  & $psql '-h' '127.0.0.1' '-U' 'postgres' '-d' 'postgres' '-v' 'ON_ERROR_STOP=1' '-c' 'SELECT 1;' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Não foi possível autenticar no PostgreSQL local.' }

  $roleSql = "DO `$`$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '$databaseUser') THEN CREATE ROLE $databaseUser LOGIN PASSWORD '$DatabasePassword'; END IF; END `$`$;"
  & $psql '-h' '127.0.0.1' '-U' 'postgres' '-d' 'postgres' '-v' 'ON_ERROR_STOP=1' '-c' $roleSql | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Não foi possível criar o usuário técnico do banco.' }

  $exists = (& $psql '-h' '127.0.0.1' '-U' 'postgres' '-d' 'postgres' '-tAc' "SELECT 1 FROM pg_database WHERE datname = '$database';").Trim()
  if ($exists -ne '1') {
    & $createdb '-h' '127.0.0.1' '-U' 'postgres' '-O' $databaseUser $database
    if ($LASTEXITCODE -ne 0) { throw 'Não foi possível criar o banco local do FuneralControl.' }
  }
} finally {
  $env:PGPASSWORD = $oldPassword
}

New-Item -ItemType Directory -Path $DataRoot -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $DataRoot 'uploads') -Force | Out-Null
$config = @(
  "DATABASE_URL=postgresql://${databaseUser}:${DatabasePassword}@127.0.0.1:5432/${database}",
  'DATABASE_SSL=false',
  'ADMIN_EMAIL=admin',
  'ADMIN_PASSWORD=admin',
  ('UPLOAD_DIR=' + (Join-Path $DataRoot 'uploads'))
)
Set-Content -LiteralPath $configPath -Value $config -Encoding utf8 -NoNewline
& icacls $configPath '/inheritance:r' ("/grant:r=$env:USERNAME`:(R,W)") '/grant:r=BUILTIN\Administrators:(F)' | Out-Null
Write-Host 'Banco de dados local configurado com sucesso.'
