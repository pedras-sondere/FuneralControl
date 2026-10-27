import { Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  ShieldCheck,
  LogOut,
  Users,
  Layers,
  Receipt,
  LayoutDashboard,
  HardDrive,
} from "lucide-react";
import { checkForUpdate, logoutWithBackup, startUpdate } from "../lib/api.functions";
import type { AvailableRelease } from "../lib/update-rules";
import { errorMessage } from "../lib/error-message";
import { Button } from "./ui/button";
import { UpdateNotice, UpdateProgressOverlay, type UpdateStage } from "./update-notice";
import { SessionTimeout } from "./session-timeout";

interface AppLayoutProps {
  children: ReactNode;
  activeTab?: "dashboard" | "holders" | "plans" | "invoices" | "backups";
  user?: { id: number; name: string; email: string } | null;
}

let startupUpdateRequest: Promise<AvailableRelease | null> | null = null;

function checkForUpdateAtStartup() {
  startupUpdateRequest ??= checkForUpdate();
  return startupUpdateRequest;
}

export function AppLayout({ children, activeTab = "dashboard", user }: AppLayoutProps) {
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [updateStage, setUpdateStage] = useState<UpdateStage>("idle");
  const [release, setRelease] = useState<AvailableRelease | null>(null);

  useEffect(() => {
    void checkForUpdateAtStartup()
      .then(setRelease)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (updateStage !== "started" || !release) return;

    let disposed = false;
    let intervalId: ReturnType<typeof window.setInterval> | undefined;

    const reloadWhenNewVersionIsReady = async () => {
      try {
        const response = await fetch(`/api/health?update-check=${Date.now()}`, {
          cache: "no-store",
        });
        if (!response.ok) return;

        const health = (await response.json()) as { ok?: boolean; version?: string };
        if (!disposed && health.ok && health.version === release.version) {
          window.location.reload();
        }
      } catch {
        // Durante a troca do runtime é esperado que a página antiga não consiga acessar o servidor.
      }
    };

    const firstCheckId = window.setTimeout(() => {
      void reloadWhenNewVersionIsReady();
      intervalId = window.setInterval(() => void reloadWhenNewVersionIsReady(), 2_000);
    }, 5_000);

    return () => {
      disposed = true;
      window.clearTimeout(firstCheckId);
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, [release, updateStage]);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      const result = await logoutWithBackup();
      if (result.backup.completed) {
        toast.success("Sessão finalizada e backups concluídos.");
      } else {
        toast.warning("Sessão finalizada. Verifique os backups que precisam de atenção.");
      }
      navigate({ to: "/login" });
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Erro ao sair"));
    } finally {
      setLoggingOut(false);
    }
  }, [navigate]);

  const handleUpdate = useCallback(async () => {
    if (!release || updateStage !== "idle") return;
    setUpdateStage("preparing");
    let updateStarted = false;
    try {
      const result = await startUpdate({
        data: { version: release.version },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      updateStarted = true;
      setUpdateStage("started");
      toast.success("Atualização iniciada. O sistema será reiniciado automaticamente ao concluir.");
    } catch (error) {
      toast.error(errorMessage(error, "Não foi possível preparar a atualização."));
    } finally {
      if (!updateStarted) setUpdateStage("idle");
    }
  }, [release, updateStage]);

  const navItems = [
    { id: "dashboard", label: "Painel", to: "/", icon: LayoutDashboard },
    { id: "holders", label: "Titulares", to: "/holders", icon: Users },
    { id: "plans", label: "Planos", to: "/plans", icon: Layers },
    { id: "invoices", label: "Gestão", to: "/invoices", icon: Receipt },
    { id: "backups", label: "Backups", to: "/backups", icon: HardDrive },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {release && updateStage !== "idle" ? (
        <UpdateProgressOverlay version={release.version} updateStage={updateStage} />
      ) : null}
      {release ? (
        <UpdateNotice release={release} onUpdate={handleUpdate} updateStage={updateStage} />
      ) : null}
      <SessionTimeout
        onWarning={() => toast.warning("Sua sessão será encerrada em 15 minutos por inatividade.")}
        onTimeout={() => {
          toast.info("Encerrando sessão por inatividade.");
          void handleLogout();
        }}
      />
      {/* Header / Navbar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link
              to="/"
              className="flex items-center gap-2.5 font-bold text-lg text-teal-800 dark:text-teal-400"
            >
              <div className="h-9 w-9 rounded-xl bg-teal-700 text-white flex items-center justify-center shadow-xs">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <span className="tracking-tight">FuneralControl</span>
            </Link>

            <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <Link
                    key={item.id}
                    to={item.to}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-colors ${
                      isActive
                        ? "bg-teal-50 dark:bg-teal-950/70 text-teal-800 dark:text-teal-300 font-semibold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-slate-400">Operador</p>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {user?.name || user?.email || "Administrador"}
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              disabled={loggingOut}
              className="text-slate-600 hover:text-rose-600 border-slate-200 dark:border-slate-800 cursor-pointer"
            >
              <LogOut className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">{loggingOut ? "Saindo..." : "Sair"}</span>
            </Button>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="md:hidden flex items-center justify-around border-t border-slate-100 dark:border-slate-800 px-2 py-1.5 bg-slate-50 dark:bg-slate-900/60 text-xs">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <Link
                key={item.id}
                to={item.to}
                className={`flex flex-col items-center gap-1 py-1 px-3 rounded-md ${
                  isActive ? "text-teal-700 font-bold" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </header>

      {/* Main Page Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  );
}
