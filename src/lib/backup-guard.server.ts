import { isExternalBackupOverdue } from "./backup-rules";

export function assertBackupMutationAllowed(lastExternalSuccess: Date | null, now = new Date()) {
  if (isExternalBackupOverdue(lastExternalSuccess, now)) {
    throw new Error(
      "O backup em HD externo está vencido. Faça uma cópia validada para continuar realizando alterações.",
    );
  }
}

export async function requireMutableOperation() {
  const { q } = await import("./db.server");
  const [settings] = await q<{ external_last_success_at: string | null }>(
    "SELECT external_last_success_at::text FROM backup_settings WHERE id = true",
  );
  assertBackupMutationAllowed(
    settings?.external_last_success_at ? new Date(settings.external_last_success_at) : null,
  );
}
