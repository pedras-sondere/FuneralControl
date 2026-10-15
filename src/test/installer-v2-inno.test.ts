import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

describe("executável do instalador v2", () => {
  it("embarca somente o bootstrap e registra falhas no novo log", async () => {
    const source = await readFile(path.join(root, "installer", "FuneralControlV2.iss"), "utf8");
    expect(source).toContain("Install-FuneralControlV2.ps1");
    expect(source).toContain("FuneralControlV2.manifest.psd1");
    expect(source).toContain("instalacao-atual.log");
    expect(source).toContain("FuneralControl-Instalador-2.1.0-rc.1-build-20261015.1");
    expect(source).toContain("C:\\ProgramData\\FuneralControl-Installer\\logs");
    expect(source).not.toContain("Install-FuneralControl.ps1");
    expect(source).not.toContain('Source: "..\\dist');
  });
});
