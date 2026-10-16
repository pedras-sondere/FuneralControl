import { readFile } from "node:fs/promises";
import { verify } from "node:crypto";

const HEX_64 = /^[a-f0-9]{64}$/i;
const SEMVER = /^\d+\.\d+\.\d+$/;

export function verifyReleaseManifest(manifestText, signatureBase64, publicKeyPem) {
  try {
    const manifest = JSON.parse(manifestText);
    const keys = Object.keys(manifest).sort();
    const expected = ["asset", "schemaVersion", "sha256", "size", "version"];
    if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index]))
      return false;
    if (
      !SEMVER.test(manifest.version) ||
      !Number.isInteger(manifest.schemaVersion) ||
      manifest.schemaVersion < 1
    )
      return false;
    if (manifest.asset !== `FuneralControl-runtime-${manifest.version}.zip`) return false;
    if (!Number.isSafeInteger(manifest.size) || manifest.size < 1 || !HEX_64.test(manifest.sha256))
      return false;
    return verify(
      null,
      Buffer.from(manifestText),
      publicKeyPem,
      Buffer.from(signatureBase64, "base64"),
    );
  } catch {
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const value = (flag) => args[args.indexOf(flag) + 1];
  const manifest = await readFile(value("--manifest"), "utf8");
  const signature = await readFile(value("--signature"), "utf8");
  const key = await readFile(value("--public-key"), "utf8");
  process.exitCode = verifyReleaseManifest(manifest, signature.trim(), key) ? 0 : 1;
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, "/")}`) main();
