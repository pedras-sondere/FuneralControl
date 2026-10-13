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

      const log = await readFile(path.join(dataRoot, "logs", "instalacao.log"), "utf8");
      expect(log).toContain("Resultado da pré-verificação:");
      expect(log).toContain("O instalador é compatível somente com Windows.");
    } finally {
      await rm(dataRoot, { recursive: true, force: true });
    }
  }, 15_000);

  it("localiza o hash oficial do Node antes de processar sua linha", async () => {
    const installerScript = await readFile(
      path.join(projectRoot, "scripts", "Install-FuneralControl.ps1"),
      "utf8",
    );

    expect(installerScript).toContain("$checksumLine =");
    expect(installerScript).toContain("'\\s' + [regex]::Escape($fileName) + '$'");
    expect(installerScript).toContain("if (-not $checksumLine)");
  });

  it("não mistura a saída do winget com a senha temporária do PostgreSQL", async () => {
    const installerScript = await readFile(
      path.join(projectRoot, "scripts", "Install-FuneralControl.ps1"),
      "utf8",
    );

    expect(installerScript).toContain("& winget.exe @arguments | Out-Host");
    expect(installerScript).toContain("postgres-bootstrap.secret");
    expect(installerScript).toContain("Remove-Item -LiteralPath $postgresBootstrapSecretPath");
  });

  it("protege a recuperação do PostgreSQL sem depender do idioma do Windows", async () => {
    const installerScript = await readFile(
      path.join(projectRoot, "scripts", "Install-FuneralControl.ps1"),
      "utf8",
    );

    expect(installerScript).toContain("*S-1-5-32-544:(F)");
    expect(installerScript).toContain("*S-1-5-18:(F)");
  });

  it("baixa o PostgreSQL oficial e confere o hash sem depender do winget", async () => {
    const installerScript = await readFile(
      path.join(projectRoot, "scripts", "Install-FuneralControl.ps1"),
      "utf8",
    );

    expect(installerScript).toContain("$manifest.PostgreSQL.InstallerUrl");
    expect(installerScript).toContain("$manifest.PostgreSQL.InstallerSha256");
    expect(installerScript).toContain("Get-FileHash -LiteralPath $installerPath -Algorithm SHA256");
    expect(installerScript).not.toContain("& winget.exe @arguments");
  });

  it("registra o diagnóstico do PostgreSQL sem registrar a senha técnica", async () => {
    const databaseScript = await readFile(
      path.join(projectRoot, "scripts", "Configure-FuneralControlDatabase.ps1"),
      "utf8",
    );

    expect(databaseScript).toContain("$authenticationOutput = @(& $psql");
    expect(databaseScript).toContain("Detalhes do PostgreSQL:");
    expect(databaseScript).not.toContain("Write-Host $PostgresAdminPassword");
    expect(databaseScript).toContain("*S-1-5-32-544:(F)");
  });
});
