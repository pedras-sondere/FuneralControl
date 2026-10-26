import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("retirada do módulo de faturas", () => {
  it("não mantém operações de gerar, baixar ou consultar faturas na aplicação", async () => {
    const root = resolve(import.meta.dirname, "..");
    const [api, management, holder] = await Promise.all([
      readFile(resolve(root, "lib/api.functions.ts"), "utf8"),
      readFile(resolve(root, "routes/invoices/index.tsx"), "utf8"),
      readFile(resolve(root, "routes/holders/$id.tsx"), "utf8"),
    ]);

    expect(api).not.toMatch(/export const (listInvoices|generateInvoices|payInvoice|setInvoiceStatus)/);
    expect(management).not.toContain("Faturas anteriores");
    expect(holder).not.toContain("Histórico de Faturas");
  });
});
