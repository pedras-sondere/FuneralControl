import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createPostgresDump } from "../lib/backup-service.server";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("localização do pg_dump", () => {
  it("usa o PostgreSQL privado da instalação para gerar o backup", async () => {
    const root = path.resolve("instalação com espaços");
    vi.stubEnv("FUNERALCONTROL_INSTALL_ROOT", root);
    const execute = vi.fn().mockResolvedValue(undefined);

    await createPostgresDump("backup.sql", "postgresql://usuario:senha@localhost/banco", execute);

    expect(execute).toHaveBeenCalledWith(
      path.join(root, "runtime", "postgresql", "bin", "pg_dump.exe"),
      expect.arrayContaining(["--format=plain", "--file=backup.sql"]),
      expect.objectContaining({ windowsHide: true }),
    );
  });

  it("mantém a busca no PATH para o ambiente de desenvolvimento", async () => {
    vi.stubEnv("FUNERALCONTROL_INSTALL_ROOT", "");
    const execute = vi.fn().mockResolvedValue(undefined);
    await createPostgresDump("backup.sql", "postgresql://localhost/banco", execute);
    expect(execute).toHaveBeenCalledWith(
      "pg_dump",
      expect.arrayContaining(["--format=plain", "--file=backup.sql"]),
      expect.objectContaining({ windowsHide: true }),
    );
  });

  it("informa claramente quando o utilitário não é encontrado", async () => {
    vi.stubEnv("FUNERALCONTROL_INSTALL_ROOT", path.resolve("instalação"));
    const execute = vi.fn().mockRejectedValue(Object.assign(new Error("spawn pg_dump ENOENT"), { code: "ENOENT" }));
    await expect(createPostgresDump("backup.sql", "postgresql://localhost/banco", execute)).rejects.toThrow(
      "Não foi possível localizar o utilitário de backup do PostgreSQL",
    );
  });
});
