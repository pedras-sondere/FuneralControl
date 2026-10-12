import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { HardDrive, Play, Save, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppLayout } from "../components/app-layout";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  getBackupStatus,
  getMe,
  runExternalBackup,
  saveBackupSettings,
} from "../lib/api.functions";

export const Route = createFileRoute("/backups")({
  beforeLoad: async () => {
    const user = await getMe();
    if (!user) throw redirect({ to: "/login" });
    return { user };
  },
  loader: () => getBackupStatus(),
  component: BackupsPage,
});

function BackupsPage() {
  const { user } = Route.useRouteContext();
  const data = Route.useLoaderData();
  const router = useRouter();
  const [localDirectory, setLocalDirectory] = useState(data.settings?.local_backup_dir ?? "");
  const [cloudDirectory, setCloudDirectory] = useState(data.settings?.cloud_backup_dir ?? "");
  const [externalDirectory, setExternalDirectory] = useState(
    data.settings?.external_backup_dir ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [runningExternal, setRunningExternal] = useState(false);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await saveBackupSettings({
        data: {
          localBackupDirectory: localDirectory || null,
          cloudBackupDirectory: cloudDirectory || null,
          externalBackupDirectory: externalDirectory || null,
        },
      });
      toast.success("Pastas de backup atualizadas.");
      await router.invalidate();
    } catch {
      toast.error("Não foi possível salvar as pastas de backup.");
    } finally {
      setSaving(false);
    }
  };

  const runExternal = async () => {
    setRunningExternal(true);
    try {
      const result = await runExternalBackup();
      if (!result.ok) throw new Error(result.error);
      toast.success("Backup no HD externo concluído e validado.");
      await router.invalidate();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível realizar o backup externo.",
      );
    } finally {
      setRunningExternal(false);
    }
  };

  const blocked = data.overview.access === "somente_consulta";
  return (
    <AppLayout activeTab="backups" user={user}>
      <div className="mb-6 flex items-center gap-3">
        <HardDrive className="h-7 w-7 text-teal-700" />
        <div>
          <h1 className="text-2xl font-bold">Backups</h1>
          <p className="text-sm text-slate-500">Proteção local, nuvem sincronizada e HD externo.</p>
        </div>
      </div>
      {data.overview.needsAttention ? (
        <div className="mb-5 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <div>
            <strong>{blocked ? "Alterações bloqueadas" : "Backup requer atenção"}</strong>
            <p className="text-sm">
              {blocked
                ? "Faça uma cópia validada no HD externo para liberar alterações."
                : "Uma cópia em nuvem falhou; verifique a pasta configurada."}
            </p>
          </div>
        </div>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pastas de destino</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={save}>
              <div>
                <Label htmlFor="local">Pasta de backup neste computador</Label>
                <Input
                  id="local"
                  value={localDirectory}
                  onChange={(e) => setLocalDirectory(e.target.value)}
                  placeholder="Ex.: C:\\FuneralControl\\Backups"
                />
              </div>
              <div>
                <Label htmlFor="cloud">Pasta sincronizada em nuvem</Label>
                <Input
                  id="cloud"
                  value={cloudDirectory}
                  onChange={(e) => setCloudDirectory(e.target.value)}
                  placeholder="Ex.: C:\\Users\\...\\Google Drive\\FuneralControl"
                />
              </div>
              <div>
                <Label htmlFor="external">Pasta do HD externo</Label>
                <Input
                  id="external"
                  value={externalDirectory}
                  onChange={(e) => setExternalDirectory(e.target.value)}
                  placeholder="Ex.: E:\\Backups\\FuneralControl"
                />
              </div>
              <Button disabled={saving} className="cursor-pointer">
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Salvando..." : "Salvar configurações"}
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p>
              HD externo:{" "}
              <Badge variant={blocked ? "destructive" : "secondary"}>
                {blocked ? "Vencido" : "Em dia"}
              </Badge>
            </p>
            <p className="text-sm text-slate-500">
              Último backup externo:{" "}
              {data.settings?.external_last_success_at
                ? new Date(data.settings.external_last_success_at).toLocaleString("pt-BR")
                : "Ainda não realizado"}
            </p>
            <p className="text-sm text-slate-500">A cópia externa é obrigatória a cada 10 dias.</p>
            <Button onClick={runExternal} disabled={runningExternal} className="cursor-pointer">
              <Play className="mr-2 h-4 w-4" />
              {runningExternal ? "Gerando backup..." : "Realizar backup no HD externo"}
            </Button>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Histórico recente</CardTitle>
        </CardHeader>
        <CardContent>
          {data.history.length ? (
            <div className="space-y-2">
              {data.history.map((run) => (
                <div key={run.id} className="flex justify-between rounded border p-3 text-sm">
                  <span>{run.destination}</span>
                  <span>
                    <Badge variant={run.status === "falha" ? "destructive" : "secondary"}>
                      {run.status}
                    </Badge>{" "}
                    {run.completed_at ? new Date(run.completed_at).toLocaleString("pt-BR") : ""}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Nenhum backup registrado ainda.</p>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
