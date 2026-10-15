[CmdletBinding()]
param(
  [string]$InstallRoot = 'C:\Program Files\FuneralControl',
  [string]$DataRoot = 'C:\ProgramData\FuneralControl',
  [string]$DesktopPath = [Environment]::GetFolderPath('Desktop'),
  [string]$LogPath = (Join-Path $env:ProgramData 'FuneralControl-Installer\logs\desinstalacao-atual.log'),
  [string]$InstallerVersion = '2.1.0-rc.1',
  [switch]$AllowLegacyCleanup,
  [switch]$DryRun,
  [switch]$AsJson
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$runId = [guid]::NewGuid().ToString('N')
$currentStage = 'inicializacao'

function Write-FuneralControlUninstallLog {
  param(
    [Parameter(Mandatory)][string]$Message,
    [ValidateSet('INFO', 'ERRO')][string]$Level = 'INFO'
  )
  $entry = [ordered]@{
    timestamp = (Get-Date).ToString('o')
    operation = 'Desinstalacao'
    runId = $script:runId
    installerVersion = $InstallerVersion
    stage = $script:currentStage
    level = $Level
    message = $Message
  }
  $line = $entry | ConvertTo-Json -Compress
  [IO.File]::AppendAllText($LogPath, "$line`r`n", [Text.UTF8Encoding]::new($true))
  Write-Host $Message
}

function Get-FuneralControlCanonicalPath {
  param([Parameter(Mandatory)][string]$Path)
  [IO.Path]::GetFullPath($Path).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
}

function Assert-FuneralControlManagedPath {
  param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][string]$ExpectedPath)
  $actual = Get-FuneralControlCanonicalPath -Path $Path
  $expected = Get-FuneralControlCanonicalPath -Path $ExpectedPath
  if (-not [string]::Equals($actual, $expected, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'A remoção só pode ser executada nos diretórios oficiais do FuneralControl.'
  }
  if (Test-Path -LiteralPath $actual) {
    $item = Get-Item -Force -LiteralPath $actual
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw "O diretório gerenciado é um redirecionamento e não pode ser removido com segurança: $actual"
    }
  }
  $actual
}

function Test-FuneralControlPrivateProcess {
  param([Parameter(Mandatory)]$Process, [Parameter(Mandatory)][string]$ManagedRoot)
  if ([string]::IsNullOrWhiteSpace([string]$Process.ExecutablePath)) { return $false }
  $root = (Get-FuneralControlCanonicalPath -Path $ManagedRoot) + [IO.Path]::DirectorySeparatorChar
  $executable = [IO.Path]::GetFullPath([string]$Process.ExecutablePath)
  $executable.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)
}

function Stop-FuneralControlPrivateProcesses {
  param([Parameter(Mandatory)][string]$ManagedInstallRoot, [Parameter(Mandatory)][string]$ManagedDataRoot)

  $postgresData = Join-Path $ManagedDataRoot 'v2\postgres-data'
  $pgCtl = Join-Path $ManagedInstallRoot 'runtime\postgresql\bin\pg_ctl.exe'
  if ((Test-Path -LiteralPath $pgCtl -PathType Leaf) -and (Test-Path -LiteralPath $postgresData -PathType Container)) {
    Write-FuneralControlUninstallLog -Message 'Solicitando o encerramento do PostgreSQL privado.'
    & $pgCtl '-D' $postgresData '-w' '-t' '30' 'stop' '-m' 'fast' 2>&1 | ForEach-Object {
      Write-FuneralControlUninstallLog -Message ([string]$_)
    }
  }

  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Name -in @('node.exe', 'postgres.exe') -and
      (Test-FuneralControlPrivateProcess -Process $_ -ManagedRoot $ManagedInstallRoot)
    } |
    ForEach-Object {
      Write-FuneralControlUninstallLog -Message "Encerrando processo privado $($_.Name), PID $($_.ProcessId)."
      Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop
    }
}

function Grant-FuneralControlCleanupAccess {
  param([Parameter(Mandatory)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return }

  Write-FuneralControlUninstallLog -Message "Recuperando propriedade e permissões de $Path."
  $ownershipOutput = & takeown.exe '/F' $Path '/A' '/R' '/D' 'Y' 2>&1
  if ($LASTEXITCODE -ne 0) {
    $ownershipOutput = & takeown.exe '/F' $Path '/A' '/R' '/D' 'S' 2>&1
  }
  if ($LASTEXITCODE -ne 0) {
    throw "Não foi possível recuperar a propriedade de $Path. $($ownershipOutput -join ' ')"
  }

  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $accessOutput = & icacls.exe $Path '/grant:r' '*S-1-5-32-544:(OI)(CI)F' "*${sid}:(OI)(CI)F" '/T' '/C' '/Q' 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "Não foi possível recuperar as permissões de $Path. $($accessOutput -join ' ')"
  }
}

function Remove-FuneralControlManagedDirectory {
  param([Parameter(Mandatory)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return }
  Grant-FuneralControlCleanupAccess -Path $Path
  for ($attempt = 1; $attempt -le 3; $attempt++) {
    try {
      Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
      return
    } catch {
      if ($attempt -eq 3) { throw }
      Write-FuneralControlUninstallLog -Message "Aguardando liberação de arquivos em $Path (tentativa $attempt de 3)."
      Start-Sleep -Seconds 2
    }
  }
}

function Confirm-FuneralControlTargetAbsent {
  param([Parameter(Mandatory)][string]$Path)
  if (Test-Path -LiteralPath $Path) {
    throw "A remoção não foi concluída; o caminho ainda existe: $Path"
  }
}

$InstallRoot = Assert-FuneralControlManagedPath -Path $InstallRoot -ExpectedPath 'C:\Program Files\FuneralControl'
$DataRoot = Assert-FuneralControlManagedPath -Path $DataRoot -ExpectedPath 'C:\ProgramData\FuneralControl'
$desktopShortcut = Join-Path ([IO.Path]::GetFullPath($DesktopPath)) 'FuneralControl.lnk'

if ($DryRun) {
  if ($AsJson) { @{ ok = $true; removes = @($InstallRoot, $DataRoot, $desktopShortcut) } | ConvertTo-Json -Compress }
  exit 0
}

New-Item -ItemType Directory -Path (Split-Path -Parent $LogPath) -Force | Out-Null
[IO.File]::WriteAllText($LogPath, '', [Text.UTF8Encoding]::new($true))

try {
  $currentStage = 'validacao'
  $ownershipMarker = Join-Path $DataRoot 'v2\state\managed-installation.json'
  if ((Test-Path -LiteralPath $DataRoot) -and -not (Test-Path -LiteralPath $ownershipMarker -PathType Leaf) -and -not $AllowLegacyCleanup) {
    throw 'A pasta de dados não possui o marcador de propriedade. Use apenas o instalador oficial para autorizar a limpeza de uma instalação antiga.'
  }

  Write-FuneralControlUninstallLog -Message 'Validação dos caminhos oficiais concluída.'
  $currentStage = 'processos'
  Stop-FuneralControlPrivateProcesses -ManagedInstallRoot $InstallRoot -ManagedDataRoot $DataRoot

  $currentStage = 'atalho'
  if (Test-Path -LiteralPath $desktopShortcut -PathType Leaf) {
    Remove-Item -LiteralPath $desktopShortcut -Force -ErrorAction Stop
  }

  $currentStage = 'dados'
  Remove-FuneralControlManagedDirectory -Path $DataRoot
  $currentStage = 'programa'
  Remove-FuneralControlManagedDirectory -Path $InstallRoot

  $currentStage = 'verificacao-final'
  Confirm-FuneralControlTargetAbsent -Path $desktopShortcut
  Confirm-FuneralControlTargetAbsent -Path $DataRoot
  Confirm-FuneralControlTargetAbsent -Path $InstallRoot
  Write-FuneralControlUninstallLog -Message 'Desinstalação completa concluída. O computador está pronto para uma instalação limpa.'
} catch {
  $failureType = $_.Exception.GetType().FullName
  Write-FuneralControlUninstallLog -Level 'ERRO' -Message "Falha [$failureType]: $($_.Exception.Message)"
  throw
}

if ($AsJson) { @{ ok = $true; removed = @($InstallRoot, $DataRoot, $desktopShortcut); logPath = $LogPath } | ConvertTo-Json -Compress }
