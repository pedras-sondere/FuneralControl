export function buildHealthPayload({
  version,
  schemaVersion,
}: {
  version: string;
  schemaVersion: number;
}) {
  return { ok: true as const, version, schemaVersion };
}
