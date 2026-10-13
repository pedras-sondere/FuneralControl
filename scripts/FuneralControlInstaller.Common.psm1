Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:FuneralControlPhases = @('prechecked', 'downloaded', 'verified', 'extracted', 'clusterInitialized', 'databaseConfigured', 'appValidated', 'shortcutCreated')

function Get-FuneralControlPaths {
  [CmdletBinding()]
  param(
    [string]$InstallRoot = 'C:\Program Files\FuneralControl',
    [string]$DataRoot = 'C:\ProgramData\FuneralControl\v2'
  )
  [pscustomobject]@{
    InstallRoot = $InstallRoot; DataRoot = $DataRoot; Port = 54329
    NodeRoot = Join-Path $InstallRoot 'runtime\node'
    PostgresRoot = Join-Path $InstallRoot 'runtime\postgresql'
    AppRoot = Join-Path $InstallRoot 'app'
    StatePath = Join-Path $DataRoot 'state\installation.json'
    ConfigRoot = Join-Path $DataRoot 'config'
    LogRoot = Join-Path $DataRoot 'logs'
    StagingRoot = Join-Path $DataRoot 'staging'
    PostgresData = Join-Path $DataRoot 'postgres-data'
    UploadRoot = Join-Path $DataRoot 'uploads'
  }
}

function Read-FuneralControlState {
  param([Parameter(Mandatory)][string]$StatePath)
  if (-not (Test-Path -LiteralPath $StatePath)) { return $null }
  Get-Content -Raw -LiteralPath $StatePath | ConvertFrom-Json
}

function Set-FuneralControlPhase {
  param([Parameter(Mandatory)][string]$StatePath, [Parameter(Mandatory)][string]$Phase, [hashtable]$State = @{}) 
  if ($script:FuneralControlPhases -notcontains $Phase) { throw "Fase de instalação inválida: $Phase" }
  $directory = Split-Path -Parent $StatePath
  New-Item -ItemType Directory -Path $directory -Force | Out-Null
  $payload = [ordered]@{ format = 2; phase = $Phase; updatedAt = (Get-Date).ToUniversalTime().ToString('o') }
  $existing = Read-FuneralControlState -StatePath $StatePath
  if ($existing) {
    foreach ($property in $existing.PSObject.Properties) {
      if ($property.Name -notin @('format', 'phase', 'updatedAt')) { $payload[$property.Name] = $property.Value }
    }
  }
  foreach ($key in $State.Keys) { $payload[$key] = $State[$key] }
  $temporary = "$StatePath.$([guid]::NewGuid()).tmp"
  $payload | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $temporary -Encoding UTF8
  Move-Item -LiteralPath $temporary -Destination $StatePath -Force
}

function Expand-FuneralControlSafeArchive {
  param([Parameter(Mandatory)][string]$Archive, [Parameter(Mandatory)][string]$Destination)
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $fullDestination = [IO.Path]::GetFullPath($Destination).TrimEnd('\', '/')
  $destinationPrefix = $fullDestination + [IO.Path]::DirectorySeparatorChar
  New-Item -ItemType Directory -Path $fullDestination -Force | Out-Null
  $zip = [IO.Compression.ZipFile]::OpenRead($Archive)
  try {
    foreach ($entry in $zip.Entries) {
      $entryPath = $entry.FullName.Replace('/', [IO.Path]::DirectorySeparatorChar).Replace('\', [IO.Path]::DirectorySeparatorChar)
      if ([IO.Path]::IsPathRooted($entryPath)) { throw 'Arquivo ZIP contém caminho absoluto inválido.' }
      $target = [IO.Path]::GetFullPath((Join-Path $fullDestination $entryPath))
      if ($target -ne $fullDestination -and -not $target.StartsWith($destinationPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Arquivo ZIP contém caminho inválido.' }
    }
    [IO.Compression.ZipFileExtensions]::ExtractToDirectory($zip, $fullDestination, $true)
  } finally { $zip.Dispose() }
}

Export-ModuleMember -Function Get-FuneralControlPaths,Read-FuneralControlState,Set-FuneralControlPhase,Expand-FuneralControlSafeArchive
