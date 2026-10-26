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
          size: 1234,
        }}
        onUpdate={onUpdate}
      />,
    );

    expect(screen.getByText("Atualização disponível: versão 1.2.0")).toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Atualizar sistema" }));
    expect(onUpdate).toHaveBeenCalledOnce();
  });

  it("informa que a atualização já está em andamento e bloqueia um segundo clique", () => {
    const onUpdate = vi.fn();
    render(
      <UpdateNotice
        release={{
          version: "1.2.0",
          notes: "Correções de segurança",
          packageUrl:
            "https://github.com/pedras-sondere/FuneralControl/releases/download/v1.2.0/update.zip",
          sha256: "a".repeat(64),
          size: 1234,
        }}
        onUpdate={onUpdate}
        updateStage="started"
      />,
    );

    expect(screen.getByText("Atualização em andamento")).toBeInTheDocument();
    expect(screen.getByText(/não feche o sistema/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Atualização iniciada" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Atualização iniciada" }));
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
