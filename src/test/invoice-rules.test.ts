import { describe, expect, it } from "vitest";

import { canAddBeneficiary, canUsePlanForHolder, shouldCreateInvoice } from "../lib/business-rules";

describe("regras de operação", () => {
  it("respeita o limite de beneficiários do plano", () => {
    expect(canAddBeneficiary(2, 3)).toBe(true);
    expect(canAddBeneficiary(3, 3)).toBe(false);
  });

  it("não cria fatura já existente no mesmo mês", () => {
    expect(shouldCreateInvoice(false)).toBe(true);
    expect(shouldCreateInvoice(true)).toBe(false);
  });

  it("não permite atribuir um plano inativo ao titular", () => {
    expect(canUsePlanForHolder({ active: true })).toBe(true);
    expect(canUsePlanForHolder({ active: false })).toBe(false);
    expect(canUsePlanForHolder(null)).toBe(false);
  });
});
