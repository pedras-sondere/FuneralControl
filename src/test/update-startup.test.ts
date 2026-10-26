import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

describe("consulta de atualização na abertura", () => {
  it("reutiliza uma única consulta e mantém a aplicação manual", async () => {
    const source = await readFile(path.join(root, "src", "components", "app-layout.tsx"), "utf8");
    expect(source).toContain("startupUpdateRequest ??= checkForUpdate()");
    expect(source).toContain("checkForUpdateAtStartup()");
    expect(source).toContain("onUpdate={handleUpdate}");
    expect(source).toContain("data: { version: release.version }");
  });
});
