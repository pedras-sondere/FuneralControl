export const CURRENT_SCHEMA_VERSION = 2;

export type SchemaCompatibility = { ok: true } | { ok: false; reason: string };

export function assertSchemaCompatibility({
  installed,
  required = CURRENT_SCHEMA_VERSION,
}: {
  installed: number;
  required?: number;
}): SchemaCompatibility {
  if (installed !== required) {
    return {
      ok: false,
      reason: `O esquema do banco (${installed}) não é compatível com a aplicação (${required}).`,
    };
  }
  return { ok: true };
}
