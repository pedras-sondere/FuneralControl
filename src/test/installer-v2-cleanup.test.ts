import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

describe("remoção controlada do instalador v2", () => {
  it("limita a limpeza aos diretórios oficiais e recupera permissões antes de remover", async () => {
    const source = await readFile(path.join(root, "scripts", "Reset-FuneralControlV2.ps1"), "utf8");

    expect(source).toContain("C:\\Program Files\\FuneralControl");
    expect(source).toContain("C:\\ProgramData\\FuneralControl\\v2");
    expect(source).toContain("takeown.exe");
    expect(source).toContain("icacls.exe");
    expect(source).toContain("Remove-Item -LiteralPath $Path -Recurse -Force");
    expect(source).toContain("FuneralControl.lnk");
  });

  it("oferece instalar ou desinstalar antes de avançar e não cria desinstalador separado", async () => {
    const source = await readFile(path.join(root, "installer", "FuneralControlV2.iss"), "utf8");

    expect(source).toContain("TInputOptionWizardPage");
    expect(source).toContain("Instalar ou desinstalar");
    expect(source).toContain("Desinstalar");
    expect(source).toContain("Reset-FuneralControlV2.ps1");
    expect(source).toContain("Uninstallable=no");
  });

  it("inclui um modo de teste que não remove arquivos", async () => {
    const source = await readFile(path.join(root, "scripts", "Reset-FuneralControlV2.ps1"), "utf8");

    expect(source).toContain("[switch]$DryRun");
    expect(source).toContain("if ($DryRun)");
    expect(source).toContain("removes = @($InstallRoot, $DataRoot)");
  });
});
