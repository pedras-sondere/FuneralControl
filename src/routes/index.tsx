import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Activity, Layers, PlusCircle, Users, UserMinus } from "lucide-react";
import { getDashboard, getMe } from "../lib/api.functions";
import { AppLayout } from "../components/app-layout";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const user = await getMe();
    if (!user) throw redirect({ to: "/login" });
    return { user };
  },
  loader: () => getDashboard(),
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = Route.useRouteContext();
  const { stats } = Route.useLoaderData();
  const navigate = useNavigate();

  return (
    <AppLayout activeTab="dashboard" user={user}>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100">
              Painel de Controle
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Visão geral das famílias, planos e ocorrências registradas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => navigate({ to: "/holders" })}
              className="bg-teal-700 text-white shadow-sm hover:bg-teal-800"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Novo Titular
            </Button>
            <Button variant="outline" onClick={() => navigate({ to: "/invoices" })}>
              <Activity className="mr-2 h-4 w-4" />
              Abrir Gestão
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardMetric label="Titulares ativos" value={stats.active_holders} icon={Users} detail="Planos em vigência" />
          <DashboardMetric label="Planos ativos" value={stats.active_plans} icon={Layers} detail="Disponíveis para adesão" />
          <DashboardMetric label="Falecimentos" value={stats.deceased_holders} icon={Activity} detail="Titulares com registro" accent="amber" />
          <DashboardMetric label="Cancelamentos" value={stats.cancelled_holders} icon={UserMinus} detail="Cadastros preservados" accent="rose" />
        </div>

        <Card className="border-slate-200 shadow-sm dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-lg">Acompanhamento de renovações</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-slate-600 dark:text-slate-300">
            <p>
              As renovações anuais que exigem atenção aparecem na área de Gestão a partir do mesmo dia do mês anterior à data-base.
            </p>
            <div>
              <Button variant="outline" onClick={() => navigate({ to: "/invoices" })}>
                Ver renovações e ocorrências
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function DashboardMetric({
  label,
  value,
  icon: Icon,
  detail,
  accent = "teal",
}: {
  label: string;
  value: number;
  icon: typeof Users;
  detail: string;
  accent?: "teal" | "amber" | "rose";
}) {
  const accentClasses = {
    teal: "bg-teal-100 text-teal-700 dark:bg-teal-900/40",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/40",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-900/40",
  }[accent];
  return (
    <Card className="border-slate-200 shadow-sm dark:border-slate-800">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">{label}</CardTitle>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${accentClasses}`}>
          <Icon className="h-4 w-4" />
        </span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</div>
        <p className="mt-1 text-xs text-slate-500">{detail}</p>
      </CardContent>
    </Card>
  );
}
