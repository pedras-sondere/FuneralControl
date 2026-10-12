const EXTERNAL_BACKUP_INTERVAL_MS = 10 * 24 * 60 * 60 * 1000;

export type BackupAccessStatus = "completo" | "somente_consulta";

export function isExternalBackupOverdue(lastSuccess: Date | null, now = new Date()) {
  if (!lastSuccess) return true;

  return now.getTime() - lastSuccess.getTime() >= EXTERNAL_BACKUP_INTERVAL_MS;
}

export function getBackupAccessStatus(
  lastSuccess: Date | null,
  now = new Date(),
): BackupAccessStatus {
  return isExternalBackupOverdue(lastSuccess, now) ? "somente_consulta" : "completo";
}

export function canMutateForBackup(status: BackupAccessStatus) {
  return status === "completo";
}
