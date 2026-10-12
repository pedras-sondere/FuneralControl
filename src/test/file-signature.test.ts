import { describe, expect, it } from "vitest";

import { detectAllowedFileType } from "../lib/file-signature";

describe("assinatura de contrato", () => {
  it("detecta os formatos permitidos pelo conteúdo", () => {
    expect(detectAllowedFileType(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe(
      "application/pdf",
    );
    expect(detectAllowedFileType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(
      detectAllowedFileType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe("image/png");
    expect(
      detectAllowedFileType(
        new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]),
      ),
    ).toBe("image/webp");
  });

  it("recusa bytes incompatíveis com formatos permitidos", () => {
    expect(detectAllowedFileType(new TextEncoder().encode("not an image"))).toBeNull();
  });
});
