import { createHash, randomUUID } from "node:crypto";
import { access, cp, mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { execFile } from "node:child_process";
import path from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { ZipArchive } from "archiver";
import unzipper from "unzipper";

export type BackupManifestFile = { path: string; sha256: string };

type CreateValidatedZipBackupInput = {
  sourceDirectory: string;
  destinationDirectory: string;
};

type CreateBackupWithDatabaseDumpInput = CreateValidatedZipBackupInput & {
  createDatabaseDump: (outputPath: string) => Promise<void>;
};

export type BackupDestination = "local" | "nuvem" | "externo";
export type BackupRunResult = {
  destination: BackupDestination;
  status: "sucesso" | "falha";
  archivePath?: string;
  files?: BackupManifestFile[];
  message?: string;
};

type RunBackupInput = {
  sourceDirectory: string;
  destinations: { destination: BackupDestination; directory: string }[];
  createDatabaseDump?: (outputPath: string) => Promise<void>;
};

const execFileAsync = promisify(execFile);

async function listFiles(directory: string, relativeDirectory = ""): Promise<BackupManifestFile[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const relativePath = path.join(relativeDirectory, entry.name);
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) return listFiles(absolutePath, relativePath);
      if (!entry.isFile()) return [];

      return [
        {
          path: relativePath.split(path.sep).join("/"),
          sha256: createHash("sha256")
            .update(await readFile(absolutePath))
            .digest("hex"),
        },
      ];
    }),
  );

  return files.flat();
}

async function ensureAvailableDirectory(directory: string) {
  try {
    if (!(await stat(directory)).isDirectory()) throw new Error();
    await access(directory);
  } catch {
    throw new Error("O destino do backup não está disponível.");
  }
}

async function writeZip(archivePath: string, sourceDirectory: string, files: BackupManifestFile[]) {
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(archivePath);
    const archive = new ZipArchive({ zlib: { level: 9 } });

    output.on("close", resolve);
    output.on("error", reject);
    archive.on("error", reject);
    archive.pipe(output);
    archive.directory(sourceDirectory, false);
    archive.append(JSON.stringify({ version: 1, files }, null, 2), { name: "manifest.json" });
    void archive.finalize();
  });
}

export async function validateBackupZip(archivePath: string): Promise<BackupManifestFile[]> {
  const zip = await unzipper.Open.file(archivePath);
  const manifest = zip.files.find((file) => file.path === "manifest.json");
  if (!manifest) throw new Error("O backup não possui manifesto de integridade.");

  const parsed = JSON.parse((await manifest.buffer()).toString("utf8")) as {
    version?: number;
    files?: BackupManifestFile[];
  };
  if (parsed.version !== 1 || !Array.isArray(parsed.files)) {
    throw new Error("O manifesto do backup é inválido.");
  }

  const archiveFiles = zip.files.filter(
    (file) => !file.path.endsWith("/") && file.path !== "manifest.json",
  );
  if (archiveFiles.length !== parsed.files.length)
    throw new Error("O backup possui arquivos divergentes.");

  for (const expected of parsed.files) {
    const file = archiveFiles.find((entry) => entry.path === expected.path);
    if (!file) throw new Error("O backup possui arquivos divergentes.");
    const actualHash = createHash("sha256")
      .update(await file.buffer())
      .digest("hex");
    if (actualHash !== expected.sha256)
      throw new Error("O backup não passou na conferência de integridade.");
  }

  return parsed.files;
}

export async function createValidatedZipBackup({
  sourceDirectory,
  destinationDirectory,
}: CreateValidatedZipBackupInput) {
  await ensureAvailableDirectory(destinationDirectory);
  const files = await listFiles(sourceDirectory);
  const archivePath = path.join(destinationDirectory, `backup-funeralcontrol-${randomUUID()}.zip`);

  await writeZip(archivePath, sourceDirectory, files);
  await validateBackupZip(archivePath);

  return { archivePath, files };
}

export async function createBackupWithDatabaseDump({
  sourceDirectory,
  destinationDirectory,
  createDatabaseDump,
}: CreateBackupWithDatabaseDumpInput) {
  const snapshotDirectory = await mkdtemp(path.join(tmpdir(), "funeral-control-snapshot-"));
  try {
    await cp(sourceDirectory, snapshotDirectory, { recursive: true });
    await createDatabaseDump(path.join(snapshotDirectory, "banco-de-dados.sql"));
    return await createValidatedZipBackup({
      sourceDirectory: snapshotDirectory,
      destinationDirectory,
    });
  } finally {
    await rm(snapshotDirectory, { recursive: true, force: true });
  }
}

export async function createPostgresDump(
  outputPath: string,
  databaseUrl = process.env["DATABASE_URL"],
  execute: (file: string, args: string[], options: { windowsHide: boolean }) => Promise<unknown> =
    execFileAsync,
) {
  if (!databaseUrl)
    throw new Error("DATABASE_URL é obrigatória para gerar o backup do PostgreSQL.");
  const installRoot = process.env["FUNERALCONTROL_INSTALL_ROOT"];
  const pgDump = installRoot
    ? path.join(installRoot, "runtime", "postgresql", "bin", "pg_dump.exe")
    : "pg_dump";
  try {
    await execute(pgDump, ["--format=plain", `--file=${outputPath}`, databaseUrl], {
      windowsHide: true,
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        "Não foi possível localizar o utilitário de backup do PostgreSQL. Verifique a instalação do FuneralControl.",
      );
    }
    throw new Error("Não foi possível gerar o backup do banco de dados PostgreSQL.");
  }
}

export async function runBackup({
  sourceDirectory,
  destinations,
  createDatabaseDump = createPostgresDump,
}: RunBackupInput): Promise<BackupRunResult[]> {
  return Promise.all(
    destinations.map(async ({ destination, directory }) => {
      try {
        const result = await createBackupWithDatabaseDump({
          sourceDirectory,
          destinationDirectory: directory,
          createDatabaseDump,
        });
        return { destination, status: "sucesso", ...result };
      } catch (error) {
        return {
          destination,
          status: "falha",
          message: error instanceof Error ? error.message : "Não foi possível concluir o backup.",
        };
      }
    }),
  );
}
