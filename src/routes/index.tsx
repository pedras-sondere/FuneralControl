import { createFileRoute, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  ShieldCheck,
  Users,
  Clock,
  AlertTriangle,
  DollarSign,
  Calendar,
  PlusCircle,
  FileText,
  LogOut,
  Layers,
  ArrowUpRight,
  Receipt,
  UserCheck
} from "lucide-react";
import { getMe, getDashboard, logout } from "../lib/api.functions";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { AppLayout } from "../components/app-layout";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const user = await getMe();
    if (!user) {
      throw redirect({ to: "/login" });
    }
    return { user };
  },
  loader: async () => {
    try {
      return await getDashboard();
    } catch {
      return {
        stats: {
          active_holders: 0,
          open_invoices: 0,
          overdue_invoices: 0,
          received_month: 0,
        },
        upcoming: [],
      };
    }
  },
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = Route.useRouteContext();
  const data = Route.useLoaderData();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const stats = data?.stats ?? {
    active_holders: 0,
    open_invoices: 0,
    overdue_invoices: 0,
    received_month: 0,
  };
  const upcoming = data?.upcoming ?? [];

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      toast.success("Sessão finalizada");
      navigate({ to: "/login" });
    } catch (err: any) {
      toast.error(err.message || "Erro ao sair");
    } finally {
      setLoggingOut(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val || 0);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const [year, month, day] = dateStr.split("-");
    if (!year || !month || !day) return dateStr;
    return `${day}/${month}/${year}`;
  };

  return (
    <AppLayout activeTab="dashboard" user={user}>
      <div className="space-y-8">
        {/* Welcome Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Painel de Controle
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Visão geral de associados, faturamento e cobranças do mês.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => navigate({ to: "/holders" })} className="bg-teal-700 hover:bg-teal-800 text-white shadow-sm">
              <PlusCircle className="mr-2 h-4 w-4" />
              Novo Titular
            </Button>
            <Button variant="outline" onClick={() => navigate({ to: "/invoices" })}>
              <Receipt className="mr-2 h-4 w-4" />
              Gerar Faturas do Mês
            </Button>
          </div>
        </div>

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Titulares Ativos */}
          <Card className="shadow-sm border-slate-200 dark:border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Titulares Ativos
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-teal-100 dark:bg-teal-900/40 text-teal-700 flex items-center justify-center">
                <Users className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {stats.active_holders}
              </div>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <UserCheck className="h-3.5 w-3.5 text-teal-600" />
                Planos em vigência
              </p>
            </CardContent>
          </Card>

          {/* Faturas em Aberto */}
          <Card className="shadow-sm border-slate-200 dark:border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Faturas em Aberto
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 flex items-center justify-center">
                <Clock className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {stats.open_invoices}
              </div>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-blue-600" />
                Aguardando pagamento
              </p>
            </CardContent>
          </Card>

          {/* Faturas Vencidas */}
          <Card className="shadow-sm border-slate-200 dark:border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Faturas Vencidas
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-rose-100 dark:bg-rose-900/40 text-rose-700 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-rose-600">
                {stats.overdue_invoices}
              </div>
              <p className="text-xs text-rose-500 mt-1">
                Atenção: inadimplência pendente
              </p>
            </CardContent>
          </Card>

          {/* Recebido no Mês */}
          <Card className="shadow-sm border-slate-200 dark:border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Recebido no Mês
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 flex items-center justify-center">
                <DollarSign className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                {formatCurrency(stats.received_month)}
              </div>
              <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                <ArrowUpRight className="h-3.5 w-3.5" />
                Mensalidades liquidadas
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Invoices Table */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Próximos Vencimentos</CardTitle>
              <CardDescription className="text-sm text-slate-500 mt-0.5">
                Mensalidades com vencimento próximo que requerem acompanhamento.
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/invoices" })} className="text-teal-700 hover:text-teal-800">
              Ver todas as faturas
            </Button>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <FileText className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-700 mb-3" />
                <p className="font-medium text-slate-700 dark:text-slate-300">Nenhuma fatura pendente encontrada</p>
                <p className="text-xs text-slate-400 mt-1">
                  Ao cadastrar titulares e emitir faturas, elas aparecerão listadas aqui.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3 rounded-l-lg">Titular</th>
                      <th className="px-4 py-3">Vencimento</th>
                      <th className="px-4 py-3">Valor</th>
                      <th className="px-4 py-3">Situação</th>
                      <th className="px-4 py-3 text-right rounded-r-lg">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {upcoming.map((inv: any) => (
                      <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                        <td className="px-4 py-3.5 font-medium text-slate-900 dark:text-slate-100">
                          {inv.holder_name}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400">
                          {formatDate(inv.due_date)}
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-slate-900 dark:text-slate-100">
                          {formatCurrency(inv.amount)}
                        </td>
                        <td className="px-4 py-3.5">
                          {inv.status === "vencida" ? (
                            <Badge variant="destructive" className="bg-rose-100 text-rose-700 border-none">
                              Vencida
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-blue-700 bg-blue-50 border-blue-200">
                              Aberta
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/invoices" })} className="h-8 text-teal-700 hover:text-teal-800">
                            Dar Baixa
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
