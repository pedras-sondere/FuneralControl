import type { BackupDestination, BackupRunResult } from "./backup-service.server";

type BackupDirectories = {
  localBackupDirectory: string | null;
  cloudBackupDirectory: string | null;
  externalBackupDirectory: string | null;
};

const destinationFields: Array<{
  destination: BackupDestination;
  field: keyof BackupDirectories;
}> = [
  { destination: "local", field: "localBackupDirectory" },
  { destination: "nuvem", field: "cloudBackupDirectory" },
  { destination: "externo", field: "externalBackupDirectory" },
];

export function getConfiguredBackupDestinations(directories: BackupDirectories) {
  const destinations: Array<{ destination: BackupDestination; directory: string }> = [];
  const notConfigured: BackupDestination[] = [];

  for (const { destination, field } of destinationFields) {
    const directory = directories[field]?.trim();
    if (directory) {
      destinations.push({ destination, directory });
    } else {
      notConfigured.push(destination);
    }
  }

  return { destinations, notConfigured };
}

export function summarizeBackupRuns({
  results,
  notConfigured,
}: {
  results: BackupRunResult[];
  notConfigured: BackupDestination[];
}) {
  const succeeded = results
    .filter((result) => result.status === "sucesso")
    .map((result) => result.destination);
  const failed = results
    .filter((result) => result.status === "falha")
    .map((result) => result.destination);

  return {
    completed: failed.length === 0 && notConfigured.length === 0,
    succeeded,
    failed,
    notConfigured,
  };
}
