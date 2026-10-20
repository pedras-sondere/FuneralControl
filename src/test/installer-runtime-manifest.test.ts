import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

describe("manifesto do bootstrap v2", () => {
  it("exige versão, URL HTTPS, tamanho e SHA-256 do runtime", async () => {
    const script = await readFile(
      path.join(root, "scripts", "New-FuneralControlInstallerManifest.ps1"),
      "utf8",
    );
    expect(script).toContain("RuntimeMetadata");
    expect(script).toContain("Sha256");
    expect(script).toContain("Size");
    expect(script).toContain("https://");
    expect(script).toContain("InstallerVersion");
    expect(script).toContain("BuildId");
    expect(script).toContain("Installer = @{");
  });
});
