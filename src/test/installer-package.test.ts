import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..", "..");

describe("pacote do instalador Windows", () => {
  it("exige administrador e chama o bootstrap local", async () => {
    const definition = await readFile(
      path.join(projectRoot, "installer", "FuneralControl.iss"),
      "utf8",
    );

    expect(definition).toContain("PrivilegesRequired=admin");
    expect(definition).not.toContain("PrivilegesRequiredOverridesAllowed");
    expect(definition).toContain("Install-FuneralControl.ps1");
    expect(definition).toContain("FuneralControl");
  });

  it("não deixa uma senha técnica literal na definição do instalador", async () => {
    const definition = await readFile(
      path.join(projectRoot, "installer", "FuneralControl.iss"),
      "utf8",
    );

    expect(definition).not.toMatch(/DATABASE_URL=.*:/i);
    expect(definition).not.toMatch(/superpassword/i);
  });

  it("inclui somente os arquivos necessários para executar o sistema local", async () => {
    const definition = await readFile(
      path.join(projectRoot, "installer", "FuneralControl.iss"),
      "utf8",
    );

    expect(definition).toContain('Source: "..\\dist\\*"');
    expect(definition).toContain('Source: "..\\scripts\\*"');
    expect(definition).toContain('Source: "..\\package.json"');
    expect(definition).toContain('Source: "..\\package-lock.json"');
    expect(definition).not.toContain('Source: "..\\*"');
    expect(definition).not.toContain("runhidden");
  });

  it("interrompe a instalação quando a configuração local falhar", async () => {
    const definition = await readFile(
      path.join(projectRoot, "installer", "FuneralControl.iss"),
      "utf8",
    );

    expect(definition).toContain("CurStepChanged");
    expect(definition).toContain("ewWaitUntilTerminated");
    expect(definition).toMatch(/resultCode <> 0/i);
  });
});
