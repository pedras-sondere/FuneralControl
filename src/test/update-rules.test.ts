import { describe, expect, it } from "vitest";

import { isNewerVersion, parseAvailableRelease } from "../lib/update-rules";

describe("regras de atualização", () => {
  it("reconhece uma versão estável mais recente", () => {
    expect(isNewerVersion("1.0.9", "1.1.0")).toBe(true);
    expect(isNewerVersion("1.1.0", "1.1.0")).toBe(false);
    expect(isNewerVersion("1.2.0", "1.1.9")).toBe(false);
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
            name: "FuneralControl-update.zip",
            browser_download_url: "https://example.test/update.zip",
          },
        ],
      }),
    ).toBeNull();
  });
});
