import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

describe("base do instalador v2", () => {
  it("define estado retomável e porta privada sem procurar serviços globais", async () => {
    const source = await readFile(
      path.join(root, "scripts", "FuneralControlInstaller.Common.psm1"),
      "utf8",
    );
    expect(source).toContain("54329");
    expect(source).toContain("shortcutCreated");
    expect(source).toContain("Expand-FuneralControlSafeArchive");
    expect(source).toContain("TrimEnd('\\', '/')");
    expect(source).toContain("Replace('\\', [IO.Path]::DirectorySeparatorChar)");
    expect(source).toContain("ExtractToFile");
    expect(source).not.toContain("ExtractToDirectory($zip, $fullDestination, $true)");
    expect(source).not.toContain("Get-Service");
    expect(source).not.toContain("Get-Command psql");
  });

  it("substitui de forma atômica o arquivo de estado quando ele já existe", async () => {
    const source = await readFile(
      path.join(root, "scripts", "FuneralControlInstaller.Common.psm1"),
      "utf8",
    );

    expect(source).toContain("[IO.File]::Replace($temporary, $StatePath, $backup)");
    expect(source).toContain("[IO.File]::Move($temporary, $StatePath)");
    expect(source).not.toContain(
      "Move-Item -LiteralPath $temporary -Destination $StatePath -Force",
    );
  }, 15_000);
});
