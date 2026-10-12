import { describe, expect, it } from "vitest";

import { readAdminConfig } from "../lib/runtime-config.server";

describe("bootstrap administrativo", () => {
  it("exige credenciais explícitas quando o banco está vazio", () => {
    expect(() => readAdminConfig({})).toThrow("ADMIN_EMAIL");
    expect(() => readAdminConfig({ ADMIN_EMAIL: "admin" })).toThrow("ADMIN_PASSWORD");
  });

  it("aceita as credenciais locais fornecidas pelo ambiente", () => {
    expect(readAdminConfig({ ADMIN_EMAIL: "admin", ADMIN_PASSWORD: "admin" })).toEqual({
      email: "admin",
      password: "admin",
    });
  });
});
