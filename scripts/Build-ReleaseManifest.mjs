import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { sign } from "node:crypto";

const HEX_64 = /^[a-f0-9]{64}$/i;
const SEMVER = /^\d+\.\d+\.\d+$/;

function assertRuntimeMetadata(metadata) {
  if (!metadata || !SEMVER.test(metadata.version)) throw new Error("Versão do runtime inválida.");
  if (!Number.isInteger(metadata.schemaVersion) || metadata.schemaVersion < 1)
    throw new Error("Versão de esquema do runtime inválida.");
  if (!Number.isSafeInteger(metadata.size) || metadata.size < 1)
    throw new Error("Tamanho do runtime inválido.");
  if (!HEX_64.test(metadata.sha256)) throw new Error("SHA-256 do runtime inválido.");
}

export function buildReleaseManifest(runtimeMetadata, privateKeyPem) {
  assertRuntimeMetadata(runtimeMetadata);
  if (!privateKeyPem?.includes("BEGIN PRIVATE KEY")) {
    throw new Error("A chave privada Ed25519 não foi informada.");
  }

  const manifestText = JSON.stringify({
    version: runtimeMetadata.version,
    schemaVersion: runtimeMetadata.schemaVersion,
    asset: `FuneralControl-runtime-${runtimeMetadata.version}.zip`,
    size: runtimeMetadata.size,
    sha256: runtimeMetadata.sha256.toLowerCase(),
  });
  const signature = sign(null, Buffer.from(manifestText), privateKeyPem).toString("base64");
  return { manifestText, signature };
}

function argument(args, flag) {
  const index = args.indexOf(flag);
  if (index < 0 || !args[index + 1]) throw new Error(`Parâmetro obrigatório ausente: ${flag}`);
  return args[index + 1];
}

async function main() {
  const args = process.argv.slice(2);
  const metadata = JSON.parse(await readFile(argument(args, "--runtime-metadata"), "utf8"));
  const privateKey = await readFile(argument(args, "--private-key"), "utf8");
  const outputDirectory = argument(args, "--output-directory");
  const { manifestText, signature } = buildReleaseManifest(metadata, privateKey);

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(path.join(outputDirectory, "release-manifest.json"), manifestText, "utf8");
  await writeFile(path.join(outputDirectory, "release-manifest.sig"), signature, "utf8");
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, "/")}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
