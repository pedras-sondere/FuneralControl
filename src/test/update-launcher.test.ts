import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..", "..");

describe("atualizador local", () => {
  it("instala lado a lado, usa ZIP seguro e restaura o estado em falha", async () => {
    const source = await readFile(
      path.join(projectRoot, "scripts", "Update-FuneralControlV2.ps1"),
      "utf8",
    );
    expect(source).toContain("Expand-FuneralControlSafeArchive");
    expect(source).toContain("runtime-manifest.json");
    expect(source).toContain("originalStateJson");
    expect(source).toContain("Start-FuneralControlV2.ps1");
    expect(source).toContain("BackupValidated");
    expect(source).not.toContain("Expand-Archive");
    expect(source).not.toContain("ProgramData\\FuneralControl\\v2\\uploads");
  });
});
