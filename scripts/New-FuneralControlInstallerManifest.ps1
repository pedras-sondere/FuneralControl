[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$RuntimeMetadata,
  [Parameter(Mandatory)][ValidatePattern('^https://')][string]$RuntimeBaseUrl,
  [Parameter(Mandatory)][ValidatePattern('^\d+\.\d+\.\d+(-[a-z0-9.]+)?$')][string]$InstallerVersion,
  [Parameter(Mandatory)][ValidatePattern('^[A-Za-z0-9._-]+$')][string]$BuildId,
  [Parameter(Mandatory)][ValidatePattern('^\d+\.\d+\.\d+$')][string]$NodeVersion,
  [Parameter(Mandatory)][ValidatePattern('^https://')][string]$NodeUrl,
  [Parameter(Mandatory)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$NodeSha256,
  [Parameter(Mandatory)][ValidateRange(1, [long]::MaxValue)][long]$NodeSize,
  [Parameter(Mandatory)][ValidatePattern('^\d+\.\d+(\.\d+)?$')][string]$PostgresVersion,
  [Parameter(Mandatory)][ValidatePattern('^https://')][string]$PostgresUrl,
  [Parameter(Mandatory)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$PostgresSha256,
  [Parameter(Mandatory)][ValidateRange(1, [long]::MaxValue)][long]$PostgresSize,
  [Parameter(Mandatory)][string]$OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $RuntimeMetadata -PathType Leaf)) {
  throw 'O metadado do runtime não foi encontrado.'
}

$runtime = Get-Content -Raw -LiteralPath $RuntimeMetadata | ConvertFrom-Json
if ($runtime.version -notmatch '^\d+\.\d+\.\d+$') { throw 'A versão do runtime é inválida.' }
if ([int]$runtime.schemaVersion -ne 1) { throw 'A versão de esquema do runtime é incompatível.' }
if ($runtime.sha256 -notmatch '^[a-fA-F0-9]{64}$') { throw 'O SHA-256 do runtime é inválido.' }
if ([long]$runtime.size -lt 1) { throw 'O tamanho do runtime é inválido.' }

$runtimeAsset = "FuneralControl-runtime-$($runtime.version).zip"
$runtimeUrl = $RuntimeBaseUrl.TrimEnd('/') + '/' + $runtimeAsset
if ($runtimeUrl -notmatch '^https://') { throw 'A URL do runtime deve utilizar HTTPS.' }

function ConvertTo-Psd1Literal {
  param([Parameter(Mandatory)][string]$Value)
  "'" + $Value.Replace("'", "''") + "'"
}

$manifest = @"
@{
  SchemaVersion = 2
  Installer = @{
    Version = $(ConvertTo-Psd1Literal $InstallerVersion)
    BuildId = $(ConvertTo-Psd1Literal $BuildId)
  }
  Runtime = @{
    Version = $(ConvertTo-Psd1Literal $runtime.version)
    Asset = $(ConvertTo-Psd1Literal $runtimeAsset)
    Url = $(ConvertTo-Psd1Literal $runtimeUrl)
    Sha256 = $(ConvertTo-Psd1Literal $runtime.sha256.ToLowerInvariant())
    Size = $([long]$runtime.size)
  }
  Node = @{
    Version = $(ConvertTo-Psd1Literal $NodeVersion)
    Url = $(ConvertTo-Psd1Literal $NodeUrl)
    Sha256 = $(ConvertTo-Psd1Literal $NodeSha256.ToLowerInvariant())
    Size = $NodeSize
  }
  PostgreSQL = @{
    Version = $(ConvertTo-Psd1Literal $PostgresVersion)
    Url = $(ConvertTo-Psd1Literal $PostgresUrl)
    Sha256 = $(ConvertTo-Psd1Literal $PostgresSha256.ToLowerInvariant())
    Size = $PostgresSize
  }
}
"@

$directory = Split-Path -Parent $OutputPath
if ($directory) { New-Item -ItemType Directory -Path $directory -Force | Out-Null }
$manifest | Set-Content -LiteralPath $OutputPath -Encoding UTF8
Write-Output "Manifesto criado em $OutputPath"
