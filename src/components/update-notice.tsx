import { Download, LoaderCircle } from "lucide-react";
import type { AvailableRelease } from "../lib/update-rules";
import { Button } from "./ui/button";

export type UpdateStage = "idle" | "preparing" | "started";

export function UpdateProgressOverlay({
  version,
  updateStage,
}: {
  version: string;
  updateStage: Exclude<UpdateStage, "idle">;
}) {
  const preparing = updateStage === "preparing";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4"
      role="status"
      aria-live="assertive"
      aria-label="Atualização do sistema em andamento"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-7 text-center shadow-2xl dark:bg-slate-900">
        <LoaderCircle className="mx-auto mb-4 h-10 w-10 animate-spin text-teal-700" aria-hidden="true" />
        <h2 className="text-lg font-bold text-slate-950 dark:text-white">
          {preparing ? "Preparando a atualização" : "A atualização está sendo instalada"}
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {preparing
            ? "Estamos conferindo a cópia local de segurança antes de iniciar."
            : "O sistema voltará a abrir automaticamente quando a instalação terminar."}
        </p>
        <p className="mt-4 text-xs font-medium text-slate-500">Nova versão: {version}</p>
        <p className="mt-2 text-xs text-slate-500">Não feche o sistema nem desligue o computador.</p>
      </div>
    </div>
  );
}

export function UpdateNotice({
  release,
  onUpdate,
  updateStage = "idle",
}: {
  release: AvailableRelease;
  onUpdate: () => void | Promise<void>;
  updateStage?: UpdateStage;
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
