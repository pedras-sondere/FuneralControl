import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UpdateNotice } from "../components/update-notice";

describe("aviso de atualização", () => {
  it("apresenta a versão disponível e só inicia a ação após o clique do gestor", () => {
    const onUpdate = vi.fn();
    render(
      <UpdateNotice
        release={{
          version: "1.2.0",
          notes: "Correções de segurança",
          packageUrl:
            "https://github.com/pedras-sondere/FuneralControl/releases/download/v1.2.0/update.zip",
          sha256: "a".repeat(64),
        }}
        onUpdate={onUpdate}
      />,
    );

    expect(screen.getByText("Atualização disponível: versão 1.2.0")).toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Atualizar sistema" }));
    expect(onUpdate).toHaveBeenCalledOnce();
  });
});
