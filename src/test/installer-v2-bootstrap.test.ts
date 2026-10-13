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
    expect(script).not.toContain("npm ci");
    expect(script).not.toContain("winget");
  });
});
