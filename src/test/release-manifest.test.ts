import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";

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
});
