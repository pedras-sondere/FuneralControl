import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(import.meta.dirname, "..", "..");
const scriptPath = path.join(projectRoot, "scripts", "Test-FuneralControlPrerequisites.ps1");

describe("pré-verificação do instalador Windows", () => {
  it("retorna um relatório sem alterar o computador quando executado em modo de inspeção", async () => {
    const { stdout } = await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
      "-SkipInternet",
      "-SkipDisk",
      "-SkipAdmin",
      "-AsJson",
    ]);

    expect(JSON.parse(stdout)).toMatchObject({ ok: true, checks: { windows: true } });
  }, 15_000);
});
