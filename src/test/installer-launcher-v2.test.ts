import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

describe("inicializador local v2", () => {
  it("remove a barra final do diretório antes de passá-lo ao PowerShell", async () => {
    const launcher = await readFile(path.join(root, "FuneralControlV2.cmd"), "utf8");
    expect(launcher).toContain('set "FUNERALCONTROL_ROOT=%~dp0"');
    expect(launcher).toContain('set "FUNERALCONTROL_ROOT=%FUNERALCONTROL_ROOT:~0,-1%"');
    expect(launcher).toContain('-InstallRoot "%FUNERALCONTROL_ROOT%"');
    expect(launcher).not.toContain('-InstallRoot "%~dp0"');
  });

  it("usa somente runtimes privados e injeta as configurações protegidas", async () => {
    const script = await readFile(path.join(root, "scripts", "Start-FuneralControlV2.ps1"), "utf8");
    expect(script).toContain("runtime.dpapi");
    expect(script).toContain("ConvertTo-SecureString");
    expect(script).toContain("DATABASE_URL");
    expect(script).toContain("FUNERALCONTROL_ALLOW_SCHEMA_MIGRATION");
    expect(script).toContain("127.0.0.1");
    expect(script).toContain("pg_ctl.exe");
    expect(script).toContain("$postgresLog = Join-Path $paths.LogRoot 'postgresql.log'");
    expect(script).toContain("'-l' $postgresLog '-w' '-t' '30' 'start'");
    expect(script).not.toContain("'start' | Out-Null");
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
