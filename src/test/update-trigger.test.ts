import { describe, expect, it } from "vitest";

import {
  buildElevatedUpdateCommand,
  buildUpdateCommand,
  getInstalledApplicationRoot,
} from "../lib/update-trigger.server";

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
        dataRoot: "C:\\ProgramData\\FuneralControl\\v2",
        version: "2.1.0",
        size: 1234,
        packageUrl:
          "https://github.com/pedras-sondere/FuneralControl/releases/download/v2.1.0/FuneralControl-runtime-2.1.0.zip",
        sha256: "a".repeat(64),
      }),
    ).toEqual([
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      "C:\\Program Files\\FuneralControl\\bootstrap\\Update-FuneralControlV2.ps1",
      "-PackageUrl",
      "https://github.com/pedras-sondere/FuneralControl/releases/download/v2.1.0/FuneralControl-runtime-2.1.0.zip",
      "-Sha256",
      "a".repeat(64),
      "-ExpectedVersion",
      "2.1.0",
      "-ExpectedSize",
      "1234",
      "-InstallRoot",
      "C:\\Program Files\\FuneralControl",
      "-DataRoot",
      "C:\\ProgramData\\FuneralControl\\v2",
      "-BackupValidated",
    ]);
  });

  it("solicita elevação administrativa somente após o clique do gestor", () => {
    const command = buildElevatedUpdateCommand({
      installRoot: "C:\\Program Files\\FuneralControl",
      dataRoot: "C:\\ProgramData\\FuneralControl\\v2",
      version: "2.1.0",
      size: 1234,
      packageUrl:
        "https://github.com/pedras-sondere/FuneralControl/releases/download/v2.1.0/FuneralControl-runtime-2.1.0.zip",
      sha256: "a".repeat(64),
    });
    expect(command).toHaveLength(5);
    expect(command[4]).toContain("-Verb RunAs");
    expect(command[4]).toContain("-EncodedCommand");
  });
});
