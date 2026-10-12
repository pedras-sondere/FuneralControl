[CmdletBinding()]
param(
  [switch]$SkipInternet,
  [switch]$SkipDisk,
  [switch]$SkipAdmin,
  [switch]$AsJson
)

$ErrorActionPreference = 'Stop'
$checks = [ordered]@{
  windows = $env:OS -eq 'Windows_NT'
  administrator = $false
  disk = $false
  internet = $false
}
$errors = [System.Collections.Generic.List[string]]::new()

if (-not $checks.windows) { $errors.Add('O instalador é compatível somente com Windows.') }

if ($SkipAdmin) { $checks.administrator = $true }
else {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($identity)
  $checks.administrator = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if (-not $checks.administrator) { $errors.Add('Execute o instalador como administrador.') }
}

if ($SkipDisk) { $checks.disk = $true }
else {
  $freeBytes = (Get-PSDrive -Name ([IO.Path]::GetPathRoot($PWD).TrimEnd(':','\')) -ErrorAction SilentlyContinue).Free
  $checks.disk = $freeBytes -ge 5GB
  if (-not $checks.disk) { $errors.Add('São necessários ao menos 5 GB livres para instalar o FuneralControl.') }
}

if ($SkipInternet) { $checks.internet = $true }
else {
  try {
    $response = Invoke-WebRequest -Uri 'https://nodejs.org' -Method Head -UseBasicParsing -TimeoutSec 15
    $checks.internet = $response.StatusCode -ge 200 -and $response.StatusCode -lt 400
  } catch { $errors.Add('Não foi possível acessar a internet para baixar as dependências oficiais.') }
}

$result = [ordered]@{ ok = $errors.Count -eq 0; checks = $checks; errors = @($errors) }
if ($AsJson) { $result | ConvertTo-Json -Compress }
else {
  if ($result.ok) { Write-Host 'Pré-requisitos verificados com sucesso.' -ForegroundColor Green }
  else { $errors | ForEach-Object { Write-Error $_ } }
}
if (-not $result.ok) { exit 1 }
exit 0
