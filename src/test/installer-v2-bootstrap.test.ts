import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

describe("bootstrap do instalador v2", () => {
  it("baixa, valida e instala apenas runtimes privados antes de criar o atalho", async () => {
    const script = await readFile(
      path.join(root, "scripts", "Install-FuneralControlV2.ps1"),
      "utf8",
    );
    expect(script).toContain("Invoke-WebRequest");
    expect(script).toContain("Get-FileHash");
    expect(script).toContain("Expand-FuneralControlSafeArchive");
    expect(script).toContain("Configure-FuneralControlDatabaseV2.ps1");
    expect(script).toContain("WScript.Shell");
    expect(script).toContain("Set-FuneralControlPhase");
    expect(script).toContain("Extraindo o PostgreSQL privado");
    expect(script).toContain("Iniciando a configuração do banco local");
    expect(script).toContain("-LogPath $logPath");
    expect(script).toContain("Write-Host $safeMessage");
    expect(script).toContain("Repair-FuneralControlStateAccess");
    expect(script).toContain('"*${Sid}:(OI)(CI)M"');
    expect(script).toContain("FuneralControl-Installer\\logs");
    expect(script).toContain("instalacao-atual.log");
    expect(script).toContain("$runId = [guid]::NewGuid().ToString('N')");
    expect(script).toContain("$runStagingRoot = Join-Path $paths.StagingRoot $runId");
    expect(script).toContain("-StagingRoot $runStagingRoot");
    expect(script).toContain("[IO.File]::Move($partial, $destination)");
    expect(script).not.toContain(
      "Move-Item -LiteralPath $partial -Destination $destination -Force",
    );
    expect(script).toContain("installerVersion");
    expect(script).toContain("installerBuild");
    expect(script).toContain("$currentStage");
    expect(script).toContain("managed-installation.json");
    expect(script).toContain("Assert-FuneralControlPrerequisites");
    expect(script).toContain("IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)");
    expect(script).toContain("[Environment]::Is64BitOperatingSystem");
    expect(script).toContain("Get-PSDrive");
    expect(script).toContain("4GB");
    expect(script).toContain("[Net.Dns]::GetHostAddresses");
    expect(script).toContain("github.com");
    expect(script).toContain("nodejs.org");
    expect(script).toContain("get.enterprisedb.com");
    expect(script).toContain("node.exe') '--version'");
    expect(script).toContain("postgres.exe') '--version'");
    expect(script).toContain("[string]$DesktopPath");
    expect(script).toContain("$verifiedShortcut.TargetPath");
    expect(script).toContain("O atalho criado não aponta para o lançador esperado");
    expect(script).not.toContain("npm ci");
    expect(script).not.toContain("winget");
    expect(script).not.toContain("docker");
  });
});
