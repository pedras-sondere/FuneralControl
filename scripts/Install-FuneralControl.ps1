[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)] [string]$InstallRoot,
  [string]$DataRoot = (Join-Path $env:ProgramData 'FuneralControl'),
  [switch]$SkipPrerequisites,
  [switch]$DryRun,
  [switch]$AsJson
)

$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $PSCommandPath
Import-LocalizedData -BaseDirectory $scriptRoot -FileName 'installer-manifest.psd1' -BindingVariable manifest
$result = [ordered]@{
  ok = $true
  preservesExistingConfiguration = $true
  createsSingleShortcut = $true
  verifiesDatabaseBeforeShortcut = $true
  writesInstallationLog = $true
  requiresBuiltApplication = $true
  requiredDependencies = @('Node.js', 'PostgreSQL')
}

$logStarted = $false
function Stop-InstallationTranscript {
  if ($script:logStarted) {
    Stop-Transcript | Out-Null
    $script:logStarted = $false
  }
}

trap {
  $failureMessage = 'A instalação local falhou: ' + $_.Exception.Message
  Write-Host $failureMessage -ForegroundColor Red
  [Console]::Error.WriteLine($failureMessage)
  Stop-InstallationTranscript
  exit 1
}

if ($DryRun) {
  if ($AsJson) { $result | ConvertTo-Json -Compress }
  else { Write-Host 'O FuneralControl será instalado localmente sem substituir dados existentes.' }
  exit 0
}

$logRoot = Join-Path $DataRoot 'logs'
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
$logPath = Join-Path $logRoot 'instalacao.log'
Start-Transcript -Path $logPath -Append | Out-Null
$logStarted = $true
Write-Host 'Iniciando a preparação local do FuneralControl.'

function Get-PostgresBin {
  $psql = Get-Command psql.exe -ErrorAction SilentlyContinue
  if ($psql) { return (Split-Path -Parent $psql.Source) }

  $postgresRoot = Join-Path $env:ProgramFiles 'PostgreSQL'
  if (Test-Path -LiteralPath $postgresRoot) {
    $candidate = Get-ChildItem -Path $postgresRoot -Filter psql.exe -Recurse -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if ($candidate) { return (Split-Path -Parent $candidate.FullName) }
  }
  return $null
}

function New-LocalSecret {
  $alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'.ToCharArray()
  -join (1..32 | ForEach-Object { $alphabet[(Get-Random -Maximum $alphabet.Length)] })
}

function Install-Node {
  $node = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($node) {
    $major = [int]((& $node.Source '--version').TrimStart('v').Split('.')[0])
    if ($major -ge 20) { return }
  }

  $temporaryRoot = Join-Path ([IO.Path]::GetTempPath()) ('FuneralControl-node-' + [guid]::NewGuid())
  New-Item -ItemType Directory -Path $temporaryRoot -Force | Out-Null
  try {
    $msiPath = Join-Path $temporaryRoot 'node.msi'
    Invoke-WebRequest -Uri $manifest.Node.Url -OutFile $msiPath -UseBasicParsing
    $fileName = Split-Path -Leaf ([Uri]$manifest.Node.Url).AbsolutePath
    $checksums = (Invoke-WebRequest -Uri $manifest.Node.ChecksumUrl -UseBasicParsing).Content
    $checksumLine = ($checksums -split "`n") |
      Where-Object { $_ -match ('\s' + [regex]::Escape($fileName) + '$') } |
      Select-Object -First 1
    if (-not $checksumLine) { throw 'Não foi possível obter o hash oficial do Node.js.' }
    $expected = $checksumLine.Split()[0]
    $actual = (Get-FileHash -LiteralPath $msiPath -Algorithm SHA256).Hash
    if ($actual -ne $expected) { throw 'A conferência de segurança do Node.js falhou.' }
    $nodeInstaller = Start-Process -FilePath 'msiexec.exe' -ArgumentList '/i', $msiPath, '/qn', '/norestart' -Wait -PassThru
    if ($nodeInstaller.ExitCode -notin @(0, 3010)) { throw 'Não foi possível instalar o Node.js.' }
  } finally {
    Remove-Item -LiteralPath $temporaryRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
  $nodeFolder = Join-Path $env:ProgramFiles 'nodejs'
  if (Test-Path -LiteralPath $nodeFolder) { $env:Path = "$nodeFolder;$env:Path" }
  $node = Get-Command node.exe -ErrorAction SilentlyContinue
  if (-not $node) { throw 'O Node.js foi instalado, mas não pôde ser localizado.' }
  $major = [int]((& $node.Source '--version').TrimStart('v').Split('.')[0])
  if ($major -lt 20) { throw 'A versão instalada do Node.js não é compatível com o FuneralControl.' }
}

function Install-PostgreSQL {
  if (Get-PostgresBin) { return $false }
  if (-not (Get-Command winget.exe -ErrorAction SilentlyContinue)) {
    throw 'O Windows Package Manager não está disponível para instalar o PostgreSQL. Instale o PostgreSQL e execute novamente o instalador.'
  }
  $adminPassword = New-LocalSecret
  $arguments = @(
    'install', '--id', $manifest.PostgreSQL.WinGetId, '--exact', '--silent',
    '--accept-source-agreements', '--accept-package-agreements',
    '--override', ("--mode unattended --unattendedmodeui none --superpassword " + $adminPassword)
  )
  & winget.exe @arguments
  if ($LASTEXITCODE -ne 0) { throw 'Não foi possível instalar o PostgreSQL.' }
  if (-not (Get-PostgresBin)) { throw 'O PostgreSQL foi instalado, mas suas ferramentas não foram encontradas.' }
  return $adminPassword
}

function Test-ConfiguredDatabase([string]$ConfigPath) {
  $databaseUrl = (Get-Content -LiteralPath $ConfigPath |
    Where-Object { $_ -like 'DATABASE_URL=*' } |
    Select-Object -First 1).Substring('DATABASE_URL='.Length)
  if ([string]::IsNullOrWhiteSpace($databaseUrl)) {
    throw 'A configuração local não possui a conexão com o PostgreSQL.'
  }
  $previousDatabaseUrl = $env:DATABASE_URL
  $env:DATABASE_URL = $databaseUrl
  try {
    & node.exe '-e' 'const { Client } = require("pg"); const client = new Client({ connectionString: process.env.DATABASE_URL }); client.connect().then(() => client.query("SELECT 1")).then(() => client.end()).catch((error) => { console.error(error.message); process.exit(1); });'
    if ($LASTEXITCODE -ne 0) { throw 'Não foi possível conectar ao banco PostgreSQL configurado.' }
  } finally {
    $env:DATABASE_URL = $previousDatabaseUrl
  }
}

if (-not $SkipPrerequisites) {
  $preflightOutput = @(& (Join-Path $scriptRoot 'Test-FuneralControlPrerequisites.ps1') -AsJson 2>&1)
  $preflightExitCode = $LASTEXITCODE
  $preflightText = ($preflightOutput | ForEach-Object { $_.ToString() }) -join "`n"
  Write-Host ('Resultado da pré-verificação: ' + $preflightText)
  if ($preflightExitCode -ne 0) {
    $preflightDetails = 'Consulte o log de instalação.'
    try {
      $preflightJson = ($preflightText -split "`r?`n" | Where-Object { $_.TrimStart().StartsWith('{') } | Select-Object -Last 1)
      $preflightReport = $preflightJson | ConvertFrom-Json
      $reportedErrors = @($preflightReport.errors | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
      if ($reportedErrors.Count -gt 0) { $preflightDetails = $reportedErrors -join ' ' }
    } catch {
      if (-not [string]::IsNullOrWhiteSpace($preflightText)) { $preflightDetails = $preflightText }
    }
    throw ('Os pré-requisitos da instalação não foram atendidos. ' + $preflightDetails)
  }
}
if (-not (Test-Path -LiteralPath $InstallRoot -PathType Container)) {
  throw 'A pasta de instalação do FuneralControl não foi encontrada.'
}

$buildEntry = Join-Path $InstallRoot 'dist\server\server.js'
if (-not (Test-Path -LiteralPath $buildEntry -PathType Leaf)) {
  throw 'A mídia de instalação não contém a aplicação compilada. Baixe um novo instalador.'
}

Install-Node
$configPath = Join-Path $InstallRoot '.env'
if (-not (Test-Path -LiteralPath $configPath)) {
  $postgresAdminPassword = Install-PostgreSQL
  if ([string]::IsNullOrWhiteSpace($postgresAdminPassword)) {
    throw 'O PostgreSQL existente não possui uma configuração do FuneralControl. Instale-o novamente ou solicite a senha administrativa do banco para a configuração inicial.'
  }
  & (Join-Path $scriptRoot 'Configure-FuneralControlDatabase.ps1') -InstallRoot $InstallRoot -DataRoot $DataRoot -PostgresAdminPassword $postgresAdminPassword
  if ($LASTEXITCODE -ne 0) { throw 'A configuração do banco de dados não foi concluída.' }
} else {
  Write-Host 'A configuração existente do FuneralControl foi preservada.'
}

& npm.cmd 'ci' '--omit=dev'
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível instalar as dependências do FuneralControl.' }
Test-ConfiguredDatabase $configPath

$desktop = [Environment]::GetFolderPath('CommonDesktopDirectory')
$shortcutPath = Join-Path $desktop 'FuneralControl.lnk'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = Join-Path $InstallRoot 'FuneralControl.cmd'
$shortcut.WorkingDirectory = $InstallRoot
$shortcut.Save()

Write-Host 'Instalação local concluída. Use o atalho FuneralControl na Área de Trabalho para iniciar o sistema.'
Stop-InstallationTranscript
exit 0
