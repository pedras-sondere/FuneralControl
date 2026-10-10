import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createValidatedZipBackup, validateBackupZip } from "../lib/backup-service.server";

const temporaryDirectories: string[] = [];

async function createTemporaryDirectory() {
  const directory = await mkdtemp(path.join(tmpdir(), "funeral-control-backup-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("backup ZIP validado", () => {
  it("cria um ZIP com manifesto e hashes conferíveis", async () => {
    const sourceDirectory = await createTemporaryDirectory();
    const destinationDirectory = await createTemporaryDirectory();
    await mkdir(path.join(sourceDirectory, "documentos"));
    await writeFile(path.join(sourceDirectory, "documentos", "contrato.txt"), "conteúdo assinado");

    const result = await createValidatedZipBackup({ sourceDirectory, destinationDirectory });
    const expectedHash = createHash("sha256").update("conteúdo assinado").digest("hex");

    expect(path.dirname(result.archivePath)).toBe(destinationDirectory);
    expect(result.files).toEqual([{ path: "documentos/contrato.txt", sha256: expectedHash }]);
    await expect(validateBackupZip(result.archivePath)).resolves.toEqual(result.files);
  });

  it("recusa destino de backup que não esteja disponível", async () => {
    const sourceDirectory = await createTemporaryDirectory();
    const unavailableDestination = path.join(tmpdir(), `inexistente-${randomUUID()}`);

    await expect(
      createValidatedZipBackup({ sourceDirectory, destinationDirectory: unavailableDestination }),
    ).rejects.toThrow("destino do backup não está disponível");
  });
});
