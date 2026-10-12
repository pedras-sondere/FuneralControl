import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  createBackupWithDatabaseDump,
  createValidatedZipBackup,
  runBackup,
  validateBackupZip,
} from "../lib/backup-service.server";

const temporaryDirectories: string[] = [];

async function createTemporaryDirectory() {
  const directory = await mkdtemp(path.join(tmpdir(), "funeral-control-backup-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
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

  it("inclui o dump do PostgreSQL e os documentos no ZIP validado", async () => {
    const sourceDirectory = await createTemporaryDirectory();
    const destinationDirectory = await createTemporaryDirectory();
    await mkdir(path.join(sourceDirectory, "uploads"));
    await writeFile(path.join(sourceDirectory, "uploads", "anexo-assinado.pdf"), "documento");

    const result = await createBackupWithDatabaseDump({
      sourceDirectory,
      destinationDirectory,
      createDatabaseDump: async (outputPath) => writeFile(outputPath, "-- backup PostgreSQL"),
    });

    expect(result.files.map((file) => file.path).sort()).toEqual([
      "banco-de-dados.sql",
      "uploads/anexo-assinado.pdf",
    ]);
    await expect(validateBackupZip(result.archivePath)).resolves.toEqual(result.files);
  });

  it("preserva o resultado de cada destino quando uma cópia falha", async () => {
    const sourceDirectory = await createTemporaryDirectory();
    const localDirectory = await createTemporaryDirectory();
    const unavailableDirectory = path.join(tmpdir(), `inexistente-${randomUUID()}`);

    const results = await runBackup({
      sourceDirectory,
      destinations: [
        { destination: "local", directory: localDirectory },
        { destination: "nuvem", directory: unavailableDirectory },
      ],
      createDatabaseDump: async (outputPath) => writeFile(outputPath, "-- backup PostgreSQL"),
    });

    expect(results.map(({ destination, status }) => ({ destination, status }))).toEqual([
      { destination: "local", status: "sucesso" },
      { destination: "nuvem", status: "falha" },
    ]);
  });
});
