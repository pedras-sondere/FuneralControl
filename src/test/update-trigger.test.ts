import { describe, expect, it } from "vitest";

import { buildUpdateCommand, getInstalledApplicationRoot } from "../lib/update-trigger.server";

describe("disparo da atualização local", () => {
  it("só permite disparar a partir de uma instalação identificada pelo lançador", () => {
    expect(getInstalledApplicationRoot({})).toBeNull();
    expect(
      getInstalledApplicationRoot({
        FUNERALCONTROL_INSTALL_ROOT: "C:\\Program Files\\FuneralControl",
      }),
    ).toBe("C:\\Program Files\\FuneralControl");
  });

  it("monta o comando do atualizador com pacote, hash e backup validado", () => {
    expect(
      buildUpdateCommand({
        installRoot: "C:\\Program Files\\FuneralControl",
        packageUrl:
          "https://github.com/pedras-sondere/FuneralControl/releases/download/v1.2.0/FuneralControl-update.zip",
        sha256: "a".repeat(64),
      }),
    ).toEqual([
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      "C:\\Program Files\\FuneralControl\\scripts\\Update-FuneralControl.ps1",
      "-PackageUrl",
      "https://github.com/pedras-sondere/FuneralControl/releases/download/v1.2.0/FuneralControl-update.zip",
      "-Sha256",
      "a".repeat(64),
      "-InstallRoot",
      "C:\\Program Files\\FuneralControl",
      "-BackupValidated",
    ]);
  });
});
