import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(import.meta.dirname, "..", "..");

describe("inicializador local", () => {
  it("inicia a versão compilada do sistema, sem manter o servidor de desenvolvimento no computador do gestor", async () => {
    const script = await readFile(
      path.join(projectRoot, "scripts", "Start-FuneralControl.ps1"),
      "utf8",
    );

    expect(script).toContain("npm run start");
    expect(script).not.toContain("npm run dev");
    expect(script).toContain("$psqlCommand = Get-Command psql.exe");
  });

  it("planeja abrir somente o endereço local e não inicia processos no modo de teste", async () => {
    const { stdout } = await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      path.join(projectRoot, "scripts", "Start-FuneralControl.ps1"),
      "-InstallRoot",
      projectRoot,
      "-DryRun",
      "-AsJson",
    ]);

    expect(JSON.parse(stdout)).toEqual({
      ok: true,
      url: "http://localhost:3000",
      startsPostgreSQL: true,
      startsApplication: true,
    });
  }, 15_000);
});
