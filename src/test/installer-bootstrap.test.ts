import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(import.meta.dirname, "..", "..");

describe("bootstrap da instalação local", () => {
  it("planeja uma instalação que preserva a configuração existente sem executar instalações no modo de teste", async () => {
    const { stdout } = await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      path.join(projectRoot, "scripts", "Install-FuneralControl.ps1"),
      "-InstallRoot",
      projectRoot,
      "-DryRun",
      "-AsJson",
    ]);

    expect(JSON.parse(stdout)).toEqual({
      ok: true,
      preservesExistingConfiguration: true,
      createsSingleShortcut: true,
      verifiesDatabaseBeforeShortcut: true,
      requiredDependencies: ["Node.js", "PostgreSQL"],
    });
  }, 15_000);

  it("mantém o banco e o usuário técnico definidos para a instalação local", async () => {
    const { stdout } = await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      path.join(projectRoot, "scripts", "Configure-FuneralControlDatabase.ps1"),
      "-InstallRoot",
      projectRoot,
      "-DryRun",
      "-AsJson",
    ]);

    expect(JSON.parse(stdout)).toEqual({
      ok: true,
      database: "funeralcontrol",
      databaseUser: "funeralcontrol_app",
      requiresPostgreSQL: true,
    });
  }, 15_000);
});
