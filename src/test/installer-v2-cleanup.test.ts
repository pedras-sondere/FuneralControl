import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

describe("remoção controlada do instalador v2", () => {
  it("limita a limpeza aos diretórios oficiais e recupera permissões antes de remover", async () => {
    const source = await readFile(path.join(root, "scripts", "Reset-FuneralControlV2.ps1"), "utf8");

    expect(source).toContain("C:\\Program Files\\FuneralControl");
    expect(source).toContain("C:\\ProgramData\\FuneralControl");
    expect(source).toContain("FuneralControl-Installer\\logs");
    expect(source).toContain("desinstalacao-atual.log");
    expect(source).toContain("[switch]$AllowLegacyCleanup");
    expect(source).toContain("managed-installation.json");
    expect(source).toContain("takeown.exe");
    expect(source).toContain("icacls.exe");
    expect(source).toContain("'/reset'");
    expect(source).toContain("Remove-Item -LiteralPath $Path -Recurse -Force");
    expect(source).toContain("Test-FuneralControlPrivateProcess");
    expect(source).toContain("ExecutablePath");
    expect(source).toContain("CommandLine");
    expect(source).toContain("ManagedDataRoot");
    expect(source).toContain("FullyQualifiedErrorId");
    expect(source).toContain("TargetObject");
    expect(source).toContain("Confirm-FuneralControlTargetAbsent");
    expect(source).toContain("FuneralControl.lnk");
  });

  it("oferece instalar ou desinstalar antes de avançar e não cria desinstalador separado", async () => {
    const source = await readFile(path.join(root, "installer", "FuneralControlV2.iss"), "utf8");

    expect(source).toContain("TInputOptionWizardPage");
    expect(source).toContain("Instalação");
    expect(source).toContain("Desinstalação completa");
    expect(source).toContain("Reset-FuneralControlV2.ps1");
    expect(source).toContain('DestDir: "{tmp}"');
    expect(source).toContain("Check: IsUninstallMode");
    expect(source).toContain("Check: IsInstallMode");
    expect(source).toContain("-AllowLegacyCleanup");
    expect(source).toContain("desinstalacao-atual.log");
    expect(source).toContain("Uninstallable=no");

    const programFilesSources = source
      .split(/\r?\n/)
      .filter((line) => line.startsWith("Source:") && line.includes('DestDir: "{app}'));
    expect(programFilesSources.length).toBeGreaterThan(0);
    expect(programFilesSources.every((line) => line.includes("Check: IsInstallMode"))).toBe(true);
  });

  it("inclui um modo de teste que não remove arquivos", async () => {
    const source = await readFile(path.join(root, "scripts", "Reset-FuneralControlV2.ps1"), "utf8");

    expect(source).toContain("[switch]$DryRun");
    expect(source).toContain("if ($DryRun)");
    expect(source).toContain("removes = @($InstallRoot, $DataRoot, $desktopShortcut)");
  });
});
