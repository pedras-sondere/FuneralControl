import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "../..");

describe("configuração de plataforma", () => {
  it("não mantém referências a plataformas gerenciadas", async () => {
    const files = ["package.json", "vite.config.ts", "bunfig.toml", "README.md", "docs/plano-sistema.md"];
    const contents = await Promise.all(
      files.map(async (file) => (await readFile(resolve(projectRoot, file), "utf8")).toLowerCase()),
    );
    const combined = contents.join("\n");

    expect(combined).not.toContain("lovable");
    expect(combined).not.toContain("cloudflare");
    expect(combined).not.toContain("wrangler");
    expect(combined).not.toContain("pglite");
  });
});
