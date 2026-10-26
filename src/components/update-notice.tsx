import { Download } from "lucide-react";
import type { AvailableRelease } from "../lib/update-rules";
import { Button } from "./ui/button";

export function UpdateNotice({
  release,
  onUpdate,
  updateStage = "idle",
}: {
  release: AvailableRelease;
  onUpdate: () => void | Promise<void>;
  updateStage?: "idle" | "preparing" | "started";
}) {
  const updating = updateStage !== "idle";
  const message =
    updateStage === "preparing"
      ? "Preparando a atualização e validando a cópia local de segurança."
      : updateStage === "started"
        ? "Atualização em andamento. Não feche o sistema nem desligue o computador."
        : release.notes.split("\n")[0];
  return (
    <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-sky-950">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 text-sm">
        <div>
          <strong>Atualização disponível: versão {release.version}</strong>
          <span className="ml-2 text-sky-800">
            {message}
          </span>
        </div>
        <Button
          size="sm"
          onClick={() => void onUpdate()}
          disabled={updating}
          className="cursor-pointer bg-sky-700 hover:bg-sky-800"
        >
          <Download className="mr-1.5 h-4 w-4" />
          {updateStage === "preparing"
            ? "Preparando atualização"
            : updateStage === "started"
              ? "Atualização iniciada"
              : "Atualizar sistema"}
        </Button>
      </div>
    </div>
  );
}
