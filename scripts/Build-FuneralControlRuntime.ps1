[CmdletBinding()]
param(
  [Parameter(Mandatory)][ValidatePattern('^\d+\.\d+\.\d+$')][string]$Version,
  [Parameter(Mandatory)][string]$OutputDirectory,
  [switch]$AsJson
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$package = Get-Content -Raw (Join-Path $projectRoot 'package.json') | ConvertFrom-Json
if ($package.version -ne $Version) { throw "A versão informada não corresponde ao package.json." }

$staging = Join-Path ([IO.Path]::GetTempPath()) ("funeralcontrol-runtime-" + [guid]::NewGuid())
$archiveName = "FuneralControl-runtime-$Version.zip"
$archivePath = Join-Path $OutputDirectory $archiveName
try {
  & npm.cmd run build --prefix $projectRoot
  New-Item -ItemType Directory -Path $staging, $OutputDirectory -Force | Out-Null
  Copy-Item (Join-Path $projectRoot 'package.json') $staging
  Copy-Item (Join-Path $projectRoot 'package-lock.json') $staging
  Copy-Item (Join-Path $projectRoot 'dist') $staging -Recurse
  & npm.cmd ci --omit=dev --ignore-scripts --prefix $staging
  if ($LASTEXITCODE -ne 0) { throw "Não foi possível instalar as dependências de produção no staging." }
  if (-not (Test-Path (Join-Path $staging 'node_modules'))) {
    throw "O staging não contém as dependências de produção."
  }
  $manifest = @{ version = $Version; schemaVersion = 1; generatedAt = (Get-Date).ToUniversalTime().ToString('o') } | ConvertTo-Json
  Set-Content -LiteralPath (Join-Path $staging 'runtime-manifest.json') -Value $manifest -Encoding UTF8
  $forbidden = @('.env', '.git', 'src', 'docs', 'tests', 'docker-compose.yml', '.wrangler', '.superpowers')
  foreach ($name in $forbidden) { if (Test-Path (Join-Path $staging $name)) { throw "Conteúdo proibido no runtime: $name" } }
  Remove-Item -LiteralPath $archivePath -Force -ErrorAction SilentlyContinue
  # ZipFile evita o bloqueio observado no Compress-Archive do PowerShell 5.1
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [IO.Compression.ZipFile]::CreateFromDirectory($staging, $archivePath, [IO.Compression.CompressionLevel]::Optimal, $false)
  $hash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
  $result = @{ archivePath = $archivePath; sha256 = $hash; version = $Version; schemaVersion = 1; size = (Get-Item $archivePath).Length }
  if ($AsJson) { $result | ConvertTo-Json -Compress } else { $result }
} finally {
  Remove-Item -LiteralPath $staging -Force -Recurse -ErrorAction SilentlyContinue
}
