[CmdletBinding()]
param(
  [string]$InstallRoot = 'C:\Program Files\FuneralControl',
  [string]$DataRoot = 'C:\ProgramData\FuneralControl\v2',
  [switch]$DryRun,
  [switch]$AsJson
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Assert-FuneralControlManagedPath {
  param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][string]$ExpectedPath)
  $actual = [IO.Path]::GetFullPath($Path).TrimEnd('\')
  $expected = [IO.Path]::GetFullPath($ExpectedPath).TrimEnd('\')
  if (-not [string]::Equals($actual, $expected, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'A remoção só pode ser executada nos diretórios oficiais do FuneralControl.'
  }
}

function Remove-FuneralControlManagedDirectory {
  param([Parameter(Mandatory)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return }

  Write-Host "Recuperando permissões de $Path"
  $takeOwnershipOutput = & takeown.exe '/F' $Path '/R' '/D' 'Y' 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "Não foi possível recuperar a propriedade de $Path. $($takeOwnershipOutput -join ' ')"
  }
  $accessOutput = & icacls.exe $Path '/grant' '*S-1-5-32-544:(OI)(CI)F' '/T' '/C' 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "Não foi possível recuperar as permissões de $Path. $($accessOutput -join ' ')"
  }
  Remove-Item -LiteralPath $Path -Recurse -Force
}

Assert-FuneralControlManagedPath -Path $InstallRoot -ExpectedPath 'C:\Program Files\FuneralControl'
Assert-FuneralControlManagedPath -Path $DataRoot -ExpectedPath 'C:\ProgramData\FuneralControl\v2'
if ($DryRun) {
  if ($AsJson) { @{ ok = $true; removes = @($InstallRoot, $DataRoot) } | ConvertTo-Json -Compress }
  exit 0
}

$postgresData = Join-Path $DataRoot 'postgres-data'
$pgCtl = Join-Path $InstallRoot 'runtime\postgresql\bin\pg_ctl.exe'
if ((Test-Path -LiteralPath $pgCtl -PathType Leaf) -and (Test-Path -LiteralPath $postgresData -PathType Container)) {
  Write-Host 'Encerrando o PostgreSQL privado do FuneralControl.'
  & $pgCtl '-D' $postgresData '-w' '-t' '30' 'stop' '-m' 'fast' | Out-Null
}

$installPrefix = [IO.Path]::GetFullPath($InstallRoot)
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -and $_.CommandLine.IndexOf($installPrefix, [StringComparison]::OrdinalIgnoreCase) -ge 0 } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Write-Host 'Removendo os arquivos locais e os dados da instalação.'
Remove-FuneralControlManagedDirectory -Path $DataRoot
Remove-FuneralControlManagedDirectory -Path $InstallRoot

$desktopShortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) 'FuneralControl.lnk'
if (Test-Path -LiteralPath $desktopShortcut -PathType Leaf) {
  Remove-Item -LiteralPath $desktopShortcut -Force
}

Write-Host 'Remoção concluída. O computador está pronto para uma nova instalação.'
if ($AsJson) { @{ ok = $true; removed = @($InstallRoot, $DataRoot) } | ConvertTo-Json -Compress }
