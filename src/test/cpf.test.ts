import { describe, expect, it } from "vitest";

import { isValidCpf, normalizeCpf } from "../lib/cpf";

describe("CPF", () => {
  it("normaliza CPF formatado para onze dígitos", () => {
    expect(normalizeCpf("529.982.247-25")).toBe("52998224725");
    expect(isValidCpf("529.982.247-25")).toBe(true);
  });

  it("recusa sequência repetida e dígitos verificadores inválidos", () => {
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(() => normalizeCpf("123")).toThrow("11 dígitos");
  });
});
