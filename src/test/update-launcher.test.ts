import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(import.meta.dirname, "..", "..");

describe("atualizador local", () => {
  it("exige backup validado e preserva dados locais no modo de inspeção", async () => {
    const { stdout } = await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      path.join(projectRoot, "scripts", "Update-FuneralControl.ps1"),
      "-PackageUrl",
      "https://github.com/pedras-sondere/FuneralControl/releases/download/v1.0.1/FuneralControl-update.zip",
      "-Sha256",
      "a".repeat(64),
      "-InstallRoot",
      projectRoot,
      "-DryRun",
      "-AsJson",
    ]);

    expect(JSON.parse(stdout)).toEqual({
      ok: true,
      backupRequired: true,
      preservedPaths: [".env", "data", "uploads", "backups"],
    });
  });
});
