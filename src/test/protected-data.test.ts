import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("rotas protegidas", () => {
  it("não substitui falha do banco por um dashboard vazio", async () => {
    const source = await readFile(resolve(import.meta.dirname, "../routes/index.tsx"), "utf8");
    expect(source).not.toContain("active_holders: 0");
    expect(source).not.toContain("upcoming: []");
  });
});
