import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

describe("empacotador de runtime", () => {
  it("define uma allowlist e bloqueia arquivos de desenvolvimento e credenciais", async () => {
    const script = await readFile(
      path.join(root, "scripts", "Build-FuneralControlRuntime.ps1"),
      "utf8",
    );
    expect(script).toContain("runtime-manifest.json");
    expect(script).toContain("node_modules");
    expect(script).toContain("dist");
    expect(script).toContain(".env");
    expect(script).toContain("docker-compose.yml");
    expect(script).toContain("Compress-Archive");
  });
});
