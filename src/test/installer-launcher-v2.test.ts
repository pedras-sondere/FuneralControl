import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

describe("inicializador local v2", () => {
  it("usa somente runtimes privados e injeta as configurações protegidas", async () => {
    const script = await readFile(path.join(root, "scripts", "Start-FuneralControlV2.ps1"), "utf8");
    expect(script).toContain("runtime.dpapi");
    expect(script).toContain("ConvertTo-SecureString");
    expect(script).toContain("DATABASE_URL");
    expect(script).toContain("FUNERALCONTROL_ALLOW_SCHEMA_MIGRATION");
    expect(script).toContain("127.0.0.1");
    expect(script).toContain("pg_ctl.exe");
    expect(script).toContain("-PassThru");
    expect(script).toContain("appPid");
    expect(script).toContain("schemaVersion");
    expect(script).toContain("$health.ok");
    expect(script).toContain("$health.version -eq $state.appVersion");
    expect(script).toContain("$health.schemaVersion -ge 1");
    expect(script).not.toContain("npm run start");
    expect(script).not.toContain("Get-Service");
  });
});
