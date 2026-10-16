import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

describe("manifesto do instalador v2", () => {
  it("fixa os downloads oficiais por HTTPS, tamanho e SHA-256", async () => {
    const manifest = await readFile(
      path.join(root, "installer", "FuneralControlV2.manifest.psd1"),
      "utf8",
    );
    expect(manifest).toContain("SchemaVersion = 2");
    expect(manifest.match(/Url = 'https:\/\//g)).toHaveLength(3);
    expect(manifest.match(/Sha256 = '[a-f0-9]{64}'/g)).toHaveLength(3);
    expect(manifest.match(/Size = \d+/g)).toHaveLength(3);
    expect(manifest).toContain("Installer = @{");
    expect(manifest).toMatch(/Version = '2\.1\.0-rc\.5'/);
    expect(manifest).toMatch(/BuildId = '20261016\.3'/);
    expect(manifest).toContain("https://github.com/pedras-sondere/FuneralControl/");
    expect(manifest).toContain("https://nodejs.org/");
    expect(manifest).toContain("https://get.enterprisedb.com/");
  });
});
