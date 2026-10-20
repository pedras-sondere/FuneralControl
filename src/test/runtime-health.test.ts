import { describe, expect, it } from "vitest";

import { buildHealthPayload } from "../lib/runtime-health.server";

describe("saúde do runtime", () => {
  it("expõe somente o estado, versão e esquema", () => {
    expect(buildHealthPayload({ version: "2.0.0", schemaVersion: 3 })).toEqual({
      ok: true,
      version: "2.0.0",
      schemaVersion: 3,
    });
  });
});
