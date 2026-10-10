import { describe, expect, it } from "vitest";

import {
  canMutateForBackup,
  getBackupAccessStatus,
  isExternalBackupOverdue,
} from "../lib/backup-rules";

const now = new Date("2026-10-10T12:00:00.000Z");

describe("regras de proteção por backup externo", () => {
  it("mantém o sistema liberado no nono dia após o último backup externo", () => {
    const lastSuccess = new Date("2026-10-01T12:00:00.000Z");

    expect(isExternalBackupOverdue(lastSuccess, now)).toBe(false);
    expect(getBackupAccessStatus(lastSuccess, now)).toBe("completo");
  });

  it("vence o backup externo exatamente no décimo dia", () => {
    const lastSuccess = new Date("2026-09-30T12:00:00.000Z");

    expect(isExternalBackupOverdue(lastSuccess, now)).toBe(true);
    expect(getBackupAccessStatus(lastSuccess, now)).toBe("somente_consulta");
  });

  it("exige backup externo quando não há nenhuma data de sucesso registrada", () => {
    expect(isExternalBackupOverdue(null, now)).toBe(true);
  });

  it("bloqueia alterações somente no modo de consulta", () => {
    expect(canMutateForBackup("completo")).toBe(true);
    expect(canMutateForBackup("somente_consulta")).toBe(false);
  });
});
