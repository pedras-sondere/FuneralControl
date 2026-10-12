[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$InstallRoot,
  [switch]$DryRun,
  [switch]$AsJson
)

$ErrorActionPreference = 'Stop'
$url = 'http://localhost:3000'
$result = [ordered]@{
  ok = $true
  url = $url
  startsPostgreSQL = $true
  startsApplication = $true
}

if ($DryRun) {
  if ($AsJson) { $result | ConvertTo-Json -Compress }
  else { Write-Host "O FuneralControl será aberto em $url" }
  exit 0
}

if (-not (Test-Path -LiteralPath $InstallRoot -PathType Container)) {
  throw 'A pasta de instalação do FuneralControl não foi encontrada.'
}

$postgresService = Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $postgresService) {
  throw 'O serviço PostgreSQL não foi encontrado. Execute novamente o instalador.'
}
if ($postgresService.Status -ne 'Running') {
  Start-Service -Name $postgresService.Name
}

try {
  Invoke-WebRequest -Uri $url -Method Head -UseBasicParsing -TimeoutSec 2 | Out-Null
} catch {
  $psqlCommand = Get-Command psql.exe -ErrorAction SilentlyContinue
  $postgresBin = if ($psqlCommand) { Split-Path -Parent $psqlCommand.Source } else { $null }
  if (-not $postgresBin) {
    $postgresRoot = Join-Path $env:ProgramFiles 'PostgreSQL'
    $psqlFile = if (Test-Path -LiteralPath $postgresRoot) {
      Get-ChildItem -Path $postgresRoot -Filter psql.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    }
    if ($psqlFile) { $postgresBin = Split-Path -Parent $psqlFile.FullName }
  }
  if (-not $postgresBin) { throw 'As ferramentas do PostgreSQL não foram encontradas. Execute novamente o instalador.' }
  $startCommand = 'set "PATH=' + $postgresBin + ';%PATH%" && set "FUNERALCONTROL_INSTALL_ROOT=' + $InstallRoot + '" && npm run start'
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', $startCommand -WorkingDirectory $InstallRoot -WindowStyle Hidden
}

for ($attempt = 0; $attempt -lt 30; $attempt++) {
  try {
    Invoke-WebRequest -Uri $url -Method Head -UseBasicParsing -TimeoutSec 2 | Out-Null
    Start-Process $url
    exit 0
  } catch { Start-Sleep -Seconds 1 }
}

throw 'O FuneralControl não iniciou. Verifique o PostgreSQL e execute o atalho novamente.'
