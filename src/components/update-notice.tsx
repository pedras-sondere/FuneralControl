import { Download } from "lucide-react";
import type { AvailableRelease } from "../lib/update-rules";
import { Button } from "./ui/button";

export function UpdateNotice({
  release,
  onUpdate,
  updating = false,
}: {
  release: AvailableRelease;
  onUpdate: () => void | Promise<void>;
  updating?: boolean;
}) {
  return (
    <div className="border-b border-sky-200 bg-sky-50 px-4 py-2 text-sky-950">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 text-sm">
        <div>
          <strong>Atualização disponível: versão {release.version}</strong>
          <span className="ml-2 text-sky-800">{release.notes.split("\n")[0]}</span>
        </div>
        <Button
          size="sm"
          onClick={() => void onUpdate()}
          disabled={updating}
          className="cursor-pointer bg-sky-700 hover:bg-sky-800"
        >
          <Download className="mr-1.5 h-4 w-4" />
          {updating ? "Preparando..." : "Atualizar sistema"}
        </Button>
      </div>
    </div>
  );
}
