import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("tela de login", () => {
  it("não exibe nem preenche credenciais administrativas", async () => {
    const source = await readFile(resolve(import.meta.dirname, "../routes/login.tsx"), "utf8");
    expect(source).not.toContain("admin@admin.com");
    expect(source).not.toContain("admin123");
  });
});
