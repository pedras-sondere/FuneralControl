import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

describe("PostgreSQL privado", () => {
  it("usa apenas o runtime privado em loopback e na porta exclusiva", async () => {
    const script = await readFile(
      path.join(root, "scripts", "Configure-FuneralControlDatabaseV2.ps1"),
      "utf8",
    );
    expect(script).toContain("RuntimePostgresRoot");
    expect(script).toContain("54329");
    expect(script).toContain("initdb.exe");
    expect(script).not.toContain("Get-Command psql");
    expect(script).not.toContain("Program Files\\PostgreSQL");
    expect(script).not.toContain("--superpassword");
  });
});
