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
    expect(script).toContain("CREATE ROLE funeralcontrol_app");
    expect(script).toContain("CREATE DATABASE funeralcontrol");
    expect(script).toContain("PGPASSWORD");
    expect(script).toContain("ConvertFrom-SecureString");
    expect(script).toContain('"*${Sid}:(OI)(CI)F"');
    expect(script).toContain("[string]$LogPath");
    expect(script).toContain("Aplicando permissões aos dados locais");
    expect(script).toContain("Write-Host $Message");
    expect(script).toContain("[ValidateSet(54329)]");
    expect(script).toContain("$InitialAdminEmail = 'admin'");
    expect(script).toContain("operation = 'BancoDeDados'");
    expect(script).toContain("$roleSql | & $psql @psqlArguments");
    expect(script).toContain("'-U', 'funeralcontrol_app', '-d', 'funeralcontrol'");
    expect(script).toContain("Conexão da aplicação com o banco funeralcontrol validada");
    expect(script).toContain("Assert-FuneralControlDatabasePath");
    expect(script).toContain("$postgresLog = Join-Path $paths.LogRoot 'postgresql.log'");
    expect(script).toContain("'-l' $postgresLog '-w' '-t' '30' 'start'");
    expect(script).not.toContain("'start' | Out-Null");
    expect(script).not.toContain("Set-FuneralControlPhase");
    expect(script).not.toContain("Protect-FuneralControlData -Directory $DataRoot");
    expect(script).toContain("$paths.PostgresData");
    expect(script).not.toContain("@psqlArguments '-c' $roleSql");
    expect(script).not.toContain("Get-Command psql");
    expect(script).not.toContain("Program Files\\PostgreSQL");
    expect(script).not.toContain("--superpassword");
  });
});
