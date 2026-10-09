import { describe, expect, it } from "vitest";

import { readDatabaseConfig } from "../lib/runtime-config.server";

describe("configuração do PostgreSQL", () => {
  it("recusa ambiente sem DATABASE_URL", () => {
    expect(() => readDatabaseConfig({})).toThrow("DATABASE_URL");
  });

  it("mantém SSL desabilitado por padrão e habilita somente quando solicitado", () => {
    expect(readDatabaseConfig({ DATABASE_URL: "postgresql://local" })).toEqual({
      connectionString: "postgresql://local",
      ssl: undefined,
    });
    expect(readDatabaseConfig({ DATABASE_URL: "postgresql://local", DATABASE_SSL: "true" })).toEqual({
      connectionString: "postgresql://local",
      ssl: { rejectUnauthorized: true },
    });
  });
});
