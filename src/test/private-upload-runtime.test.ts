import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getUploadDirectory } from "../lib/storage.server";

const root = path.resolve(import.meta.dirname, "../..");

afterEach(() => vi.unstubAllEnvs());

describe("uploads no runtime privado", () => {
  it("prioriza o diretório permanente informado pelo launcher", () => {
    vi.stubEnv("UPLOAD_DIR", "C:\\ProgramData\\FuneralControl\\v2\\uploads");

    expect(getUploadDirectory()).toBe("C:\\ProgramData\\FuneralControl\\v2\\uploads");
  });

  it("mantém uploads na área permanente de dados ao iniciar o aplicativo", async () => {
    const launcher = await readFile(
      path.join(root, "scripts", "Start-FuneralControlV2.ps1"),
      "utf8",
    );

    expect(launcher).toContain("UPLOAD_DIR = $paths.UploadRoot");
  });

  it("copia uploads legados com validação de hash antes de ativar a atualização", async () => {
    const updater = await readFile(
      path.join(root, "scripts", "Update-FuneralControlV2.ps1"),
      "utf8",
    );

    expect(updater).toContain("function Copy-FuneralControlLegacyUploads");
    expect(updater).toContain("Get-FileHash -LiteralPath $sourceFile -Algorithm SHA256");
    expect(updater).toContain("Copy-Item -LiteralPath $file.FullName -Destination $destinationFile -Force");
    expect(updater).toContain("Os documentos legados foram validados");
    expect(updater).toContain("Copy-FuneralControlLegacyUploads");
  });
});
