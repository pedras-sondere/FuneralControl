import { describe, expect, it } from "vitest";

import { isNewerVersion, parseAvailableRelease } from "../lib/update-rules";

describe("regras de atualização", () => {
  it("reconhece uma versão estável mais recente", () => {
    expect(isNewerVersion("1.0.9", "1.1.0")).toBe(true);
    expect(isNewerVersion("1.1.0", "1.1.0")).toBe(false);
    expect(isNewerVersion("1.2.0", "1.1.9")).toBe(false);
  });

  it("aceita somente o runtime versionado do repositório oficial", () => {
    expect(
      parseAvailableRelease({
        tag_name: "v2.1.0",
        prerelease: false,
        body: `Melhorias\nSHA256: ${"a".repeat(64)}`,
        assets: [
          {
            name: "FuneralControl-runtime-2.1.0.zip",
            browser_download_url:
              "https://github.com/pedras-sondere/FuneralControl/releases/download/v2.1.0/FuneralControl-runtime-2.1.0.zip",
            size: 1234,
          },
        ],
      }),
    ).toEqual({
      version: "2.1.0",
      notes: `Melhorias\nSHA256: ${"a".repeat(64)}`,
      packageUrl:
        "https://github.com/pedras-sondere/FuneralControl/releases/download/v2.1.0/FuneralControl-runtime-2.1.0.zip",
      sha256: "a".repeat(64),
      size: 1234,
    });
  });

  it("recusa pré-release e pacote sem hash publicado", () => {
    expect(
      parseAvailableRelease({ tag_name: "v1.2.0-beta.1", prerelease: true, assets: [] }),
    ).toBeNull();
    expect(
      parseAvailableRelease({
        tag_name: "v1.2.0",
        prerelease: false,
        body: "Atualização importante",
        assets: [
          {
            name: "FuneralControl-runtime-1.2.0.zip",
            browser_download_url: "https://example.test/update.zip",
          },
        ],
      }),
    ).toBeNull();
  });
});
