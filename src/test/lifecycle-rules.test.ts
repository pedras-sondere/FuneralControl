import { describe, expect, it } from "vitest";

import {
  canAssumeCurrentHolder,
  getRenewalReminder,
  isLifecycleStatus,
} from "../lib/lifecycle-rules";

describe("regras do ciclo de vida familiar", () => {
  it("aceita somente os estados permanentes previstos para pessoas", () => {
    expect(isLifecycleStatus("ativo")).toBe(true);
    expect(isLifecycleStatus("falecido")).toBe(true);
    expect(isLifecycleStatus("cancelado")).toBe(true);
    expect(isLifecycleStatus("inadimplente")).toBe(false);
  });

  it("permite que um beneficiário ativo assuma somente após o falecimento do titular original", () => {
    expect(canAssumeCurrentHolder("falecido", "ativo")).toBe(true);
    expect(canAssumeCurrentHolder("ativo", "ativo")).toBe(false);
    expect(canAssumeCurrentHolder("falecido", "falecido")).toBe(false);
    expect(canAssumeCurrentHolder("falecido", "cancelado")).toBe(false);
  });
});

describe("lembretes de renovação anual", () => {
  it("informa a pendência de data para cadastros antigos que ainda não a possuem", () => {
    expect(getRenewalReminder({ monthlyBillingDate: null, today: "2026-10-26" })).toEqual({
      kind: "sem_data",
      referenceDate: null,
    });
  });

  it("cria alertas graduais antes da renovação e identifica renovação vencida", () => {
    expect(getRenewalReminder({ monthlyBillingDate: "2024-12-25", today: "2026-09-26" }).kind).toBe(
      "lembrete_90",
    );
    expect(getRenewalReminder({ monthlyBillingDate: "2024-12-25", today: "2026-10-26" }).kind).toBe(
      "lembrete_60",
    );
    expect(getRenewalReminder({ monthlyBillingDate: "2024-12-25", today: "2026-11-26" }).kind).toBe(
      "lembrete_30",
    );
    expect(getRenewalReminder({ monthlyBillingDate: "2024-10-20", today: "2026-10-26" }).kind).toBe(
      "atrasada",
    );
  });

  it("considera concluída a referência registrada e aponta o próximo ciclo", () => {
    expect(
      getRenewalReminder({
        monthlyBillingDate: "2024-10-20",
        latestCompletedReferenceDate: "2026-10-20",
        today: "2026-10-26",
      }),
    ).toEqual({ kind: "em_dia", referenceDate: "2027-10-20" });
  });
});
