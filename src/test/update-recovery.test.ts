import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

describe("recuperação após atualização local", () => {
  it("bloqueia a tela antiga, aguarda a nova versão e reabre o sistema", async () => {
    const layout = await readFile(path.join(root, "src", "components", "app-layout.tsx"), "utf8");
    const updater = await readFile(path.join(root, "scripts", "Update-FuneralControlV2.ps1"), "utf8");

    expect(layout).toContain("<UpdateProgressOverlay");
    expect(layout).toContain("fetch(`/api/health?update-check=${Date.now()}`");
    expect(layout).toContain("window.location.reload()");
    expect(updater).not.toContain("-NoBrowser");
  });
});
