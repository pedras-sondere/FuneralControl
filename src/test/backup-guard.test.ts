import { describe, expect, it } from "vitest";

import { assertBackupMutationAllowed } from "../lib/backup-guard.server";

describe("bloqueio por backup externo vencido", () => {
  it("recusa alterações quando a última cópia externa tem dez dias", () => {
    expect(() =>
      assertBackupMutationAllowed(
        new Date("2026-10-01T12:00:00.000Z"),
        new Date("2026-10-11T12:00:00.000Z"),
      ),
    ).toThrow("backup em HD externo está vencido");
  });

  it("permite alterações enquanto o prazo externo está em dia", () => {
    expect(() =>
      assertBackupMutationAllowed(
        new Date("2026-10-02T12:00:00.000Z"),
        new Date("2026-10-11T12:00:00.000Z"),
      ),
    ).not.toThrow();
  });
});
