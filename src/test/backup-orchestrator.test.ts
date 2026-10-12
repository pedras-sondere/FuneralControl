import { describe, expect, it } from "vitest";

import {
  getConfiguredBackupDestinations,
  summarizeBackupRuns,
} from "../lib/backup-orchestrator.server";

describe("orquestração de backups configurados", () => {
  it("usa somente os destinos configurados e identifica os pendentes", () => {
    const configured = getConfiguredBackupDestinations({
      localBackupDirectory: " C:\\FuneralControl\\Backups ",
      cloudBackupDirectory: null,
      externalBackupDirectory: "E:\\Backups",
    });

    expect(configured.destinations).toEqual([
      { destination: "local", directory: "C:\\FuneralControl\\Backups" },
      { destination: "externo", directory: "E:\\Backups" },
    ]);
    expect(configured.notConfigured).toEqual(["nuvem"]);
  });

  it("mantém o encerramento possível, mas sinaliza cópias que falharam ou não foram configuradas", () => {
    const summary = summarizeBackupRuns({
      results: [
        { destination: "local", status: "sucesso" },
        { destination: "externo", status: "falha", message: "HD externo indisponível" },
      ],
      notConfigured: ["nuvem"],
    });

    expect(summary.completed).toBe(false);
    expect(summary.succeeded).toEqual(["local"]);
    expect(summary.failed).toEqual(["externo"]);
    expect(summary.notConfigured).toEqual(["nuvem"]);
  });
});
