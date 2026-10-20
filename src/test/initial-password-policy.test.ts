import { describe, expect, it } from "vitest";

import { readInitialAdminConfig } from "../lib/runtime-config.server";
import { assertSchemaCompatibility } from "../lib/schema-version";

describe("política da senha inicial", () => {
  it("lê as credenciais iniciais exclusivas do runtime controlado", () => {
    expect(
      readInitialAdminConfig({ INITIAL_ADMIN_EMAIL: "admin", INITIAL_ADMIN_PASSWORD: "admin" }),
    ).toEqual({ email: "admin", password: "admin" });
  });

  it("recusa a operação quando o esquema instalado é incompatível", () => {
    expect(assertSchemaCompatibility({ installed: 1, required: 2 })).toMatchObject({ ok: false });
  });
});
