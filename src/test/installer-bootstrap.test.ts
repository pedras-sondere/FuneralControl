import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
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
      writesInstallationLog: true,
      requiresBuiltApplication: true,
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

  it("cria o log antes de validar os pré-requisitos da instalação", async () => {
    const dataRoot = await mkdtemp(path.join(os.tmpdir(), "funeralcontrol-installer-"));

    try {
      await expect(
        execFileAsync("powershell.exe", [
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          path.join(projectRoot, "scripts", "Install-FuneralControl.ps1"),
          "-InstallRoot",
          path.join(dataRoot, "instalacao-inexistente"),
          "-DataRoot",
          dataRoot,
          "-SkipPrerequisites",
        ]),
      ).rejects.toMatchObject({ code: 1 });

      await expect(stat(path.join(dataRoot, "logs", "instalacao.log"))).resolves.toBeDefined();
    } finally {
      await rm(dataRoot, { recursive: true, force: true });
    }
  }, 15_000);

  it("registra o motivo específico quando a pré-verificação falhar", async () => {
    const dataRoot = await mkdtemp(path.join(os.tmpdir(), "funeralcontrol-installer-"));

    try {
      await expect(
        execFileAsync(
          "powershell.exe",
          [
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            path.join(projectRoot, "scripts", "Install-FuneralControl.ps1"),
            "-InstallRoot",
            projectRoot,
            "-DataRoot",
            dataRoot,
          ],
          { env: { ...process.env, OS: "invalid" } },
        ),
      ).rejects.toMatchObject({ code: 1 });

      await expect(readFile(path.join(dataRoot, "logs", "instalacao.log"), "utf8")).resolves.toContain(
        "O instalador é compatível somente com Windows.",
      );
    } finally {
      await rm(dataRoot, { recursive: true, force: true });
    }
  }, 15_000);
});
