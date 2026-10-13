import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";

import { buildReleaseManifest } from "../../scripts/Build-ReleaseManifest.mjs";
import { verifyReleaseManifest } from "../../scripts/Verify-ReleaseManifest.mjs";

describe("manifesto de release assinado", () => {
  it("recusa metadados alterados após a assinatura", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const manifest = JSON.stringify({
      version: "2.0.0",
      schemaVersion: 1,
      asset: "FuneralControl-runtime-2.0.0.zip",
      size: 10,
      sha256: "a".repeat(64),
    });
    const signature = sign(null, Buffer.from(manifest), privateKey).toString("base64");
    expect(
      verifyReleaseManifest(
        `${manifest} `,
        signature,
        publicKey.export({ type: "spki", format: "pem" }).toString(),
      ),
    ).toBe(false);
  });

  it("gera um manifesto verificável sem gravar a chave privada", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const result = buildReleaseManifest(
      { version: "2.0.0", schemaVersion: 1, size: 10, sha256: "a".repeat(64) },
      privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    );
    expect(
      verifyReleaseManifest(
        result.manifestText,
        result.signature,
        publicKey.export({ type: "spki", format: "pem" }).toString(),
      ),
    ).toBe(true);
  });
});
