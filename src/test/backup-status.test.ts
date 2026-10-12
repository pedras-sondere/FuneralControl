import { describe, expect, it } from "vitest";

import { buildBackupStatus } from "../lib/backup-status";

describe("status de backup", () => {
  it("mantém alerta de falha na nuvem sem bloquear quando o HD externo está em dia", () => {
    expect(
      buildBackupStatus({
        externalLastSuccess: new Date("2026-10-05T12:00:00.000Z"),
        cloudLastRunStatus: "falha",
        now: new Date("2026-10-11T12:00:00.000Z"),
      }),
    ).toEqual({ access: "completo", needsAttention: true });
  });

  it("bloqueia alterações quando a última cópia externa vence", () => {
    expect(
      buildBackupStatus({
        externalLastSuccess: new Date("2026-10-01T12:00:00.000Z"),
        cloudLastRunStatus: "sucesso",
        now: new Date("2026-10-11T12:00:00.000Z"),
      }),
    ).toEqual({ access: "somente_consulta", needsAttention: true });
  });
});
