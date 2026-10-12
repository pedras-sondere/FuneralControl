import { getBackupAccessStatus } from "./backup-rules";

export function buildBackupStatus({
  externalLastSuccess,
  cloudLastRunStatus,
  now = new Date(),
}: {
  externalLastSuccess: Date | null;
  cloudLastRunStatus: "sucesso" | "falha" | null;
  now?: Date;
}) {
  const access = getBackupAccessStatus(externalLastSuccess, now);
  return {
    access,
    needsAttention: access === "somente_consulta" || cloudLastRunStatus === "falha",
  };
}
