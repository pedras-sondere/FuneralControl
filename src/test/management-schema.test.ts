import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { CURRENT_SCHEMA_VERSION, assertSchemaCompatibility } from "../lib/schema-version";

const root = path.resolve(import.meta.dirname, "../..");

describe("esquema de Gestão", () => {
  it("exige a versão de esquema que suporta histórico familiar", () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(2);
    expect(assertSchemaCompatibility({ installed: 1 }).ok).toBe(false);
    expect(assertSchemaCompatibility({ installed: 2 }).ok).toBe(true);
  });

  it("inclui uma migração incremental para o ciclo de vida e a gestão", async () => {
    const source = await readFile(path.join(root, "src", "lib", "db.server.ts"), "utf8");

    for (const expected of [
      "monthly_billing_date",
      "status_changed_at",
      "current_holder_beneficiary_id",
      "CREATE TABLE IF NOT EXISTS family_events",
      "CREATE TABLE IF NOT EXISTS holder_successions",
      "CREATE TABLE IF NOT EXISTS renewal_completions",
    ]) {
      expect(source).toContain(expected);
    }
  });
});
