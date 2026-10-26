import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Activity, CalendarClock, CheckCircle2, CircleDollarSign, Users } from "lucide-react";
import { toast } from "sonner";
import { completeRenewal, getManagementOverview, getMe } from "../../lib/api.functions";
import { AppLayout } from "../../components/app-layout";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
export const Route = createFileRoute("/invoices/")({
  beforeLoad: async () => {
    const user = await getMe();
    if (!user) throw redirect({ to: "/login" });
    return { user };
  },
  loader: () => getManagementOverview(),
  component: ManagementPage,
});

const money = (value: number | null) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

const formatDate = (value: string) => {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
};

const renewalLabel: Record<string, string> = {
  sem_data: "Sem data-base",
  em_dia: "Em dia",
  lembrete_30: "Renovação no próximo mês",
  atrasada: "Renovação pendente",
};

function ManagementPage() {
  const { user } = Route.useRouteContext();
  const management = Route.useLoaderData();
  const router = useRouter();
  const [busyHolderId, setBusyHolderId] = useState<number | null>(null);
  const attentionFamilies = management.families.filter(
    (family) => family.renewal.kind !== "em_dia",
  );

  const confirmRenewal = async (holderId: number, referenceDate: string | null) => {
    if (!referenceDate) {
      toast.warning(
        "Informe a data-base da mensalidade na ficha familiar antes de concluir a renovação.",
      );
      return;
    }
    setBusyHolderId(holderId);
    try {
      const result = await completeRenewal({
        data: { holder_id: holderId, reference_date: referenceDate },
      });
      if (!result.ok) return toast.error(result.error);
      toast.success("Renovação registrada no histórico familiar.");
      await router.invalidate();
    } catch {
      toast.error("Não foi possível concluir a renovação.");
    } finally {
      setBusyHolderId(null);
    }
  };

  return (
    <AppLayout activeTab="invoices" user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Activity className="h-7 w-7 text-teal-700" /> Gestão
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Renovações anuais, ocorrências e indicadores operacionais dos planos.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Metric
            icon={Users}
            label="Famílias ativas"
            value={String(management.indicators.activeFamilies)}
          />
          <Metric
            icon={CircleDollarSign}
            label="Receita mensal estimada"
            value={money(management.indicators.monthlyRevenueEstimate)}
          />
          <Metric
            icon={Activity}
            label="Falecimentos registrados"
            value={String(management.indicators.deaths)}
          />
          <Metric
            icon={Activity}
            label="Utilizações do plano"
            value={String(management.indicators.utilizations)}
          />
          <Metric
            icon={CalendarClock}
            label="Índice de utilização"
            value={`${(management.indicators.utilizationRatio * 100).toFixed(1)}%`}
          />
          <Metric
            icon={CircleDollarSign}
            label="Receita estimada por utilização"
            value={
              management.indicators.revenuePerUtilization === null
                ? "Sem utilização"
                : money(management.indicators.revenuePerUtilization)
            }
          />
        </div>
        <Tabs defaultValue="renewals" className="space-y-4">
          <TabsList>
            <TabsTrigger value="renewals">Renovações</TabsTrigger>
            <TabsTrigger value="occurrences">Ocorrências</TabsTrigger>
          </TabsList>
          <TabsContent value="renewals">
            <Card>
              <CardHeader>
                <CardTitle>Renovações anuais</CardTitle>
                <CardDescription>
                  Acompanhe a data-base de cada família e marque como concluída quando a renovação
                  for gerada.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ManagementTable
                  rows={attentionFamilies}
                  busyHolderId={busyHolderId}
                  onConfirm={confirmRenewal}
                />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="occurrences">
            <Card>
              <CardHeader>
                <CardTitle>Ocorrências recentes</CardTitle>
                <CardDescription>
                  Inadimplências, cancelamentos, falecimentos e utilizações ficam vinculados ao
                  histórico familiar.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <OccurrenceTable rows={management.recentOccurrences} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-5">
        <span className="rounded-lg bg-teal-50 p-2 text-teal-700">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

type ManagementFamily = Awaited<ReturnType<typeof getManagementOverview>>["families"][number];
function ManagementTable({
  rows,
  busyHolderId,
  onConfirm,
}: {
  rows: ManagementFamily[];
  busyHolderId: number | null;
  onConfirm: (holderId: number, referenceDate: string | null) => Promise<void>;
}) {
  if (!rows.length)
    return (
      <p className="px-6 py-12 text-center text-sm text-slate-500">
        Nenhuma renovação precisa de atenção agora.
      </p>
    );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-600">
          <tr>
            <th className="px-5 py-3">Família</th>
            <th className="px-5 py-3">Plano</th>
            <th className="px-5 py-3">Referência</th>
            <th className="px-5 py-3">Situação</th>
            <th className="px-5 py-3 text-right">Ação</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((family) => (
            <tr key={family.id}>
              <td className="px-5 py-3">
                <Link
                  to="/holders/$id"
                  params={{ id: String(family.id) }}
                  className="font-medium text-teal-700 hover:underline"
                >
                  {family.name}
                </Link>
                {family.current_holder_name ? (
                  <span className="block text-xs text-slate-500">
                    Titular atual: {family.current_holder_name}
                  </span>
                ) : null}
              </td>
              <td className="px-5 py-3">{family.plan_name}</td>
              <td className="px-5 py-3">
                {family.renewal.referenceDate
                  ? formatDate(family.renewal.referenceDate)
                  : "Não informada"}
              </td>
              <td className="px-5 py-3">
                <Badge variant={family.renewal.kind === "atrasada" ? "destructive" : "outline"}>
                  {renewalLabel[family.renewal.kind]}
                </Badge>
              </td>
              <td className="px-5 py-3 text-right">
                <Button
                  size="sm"
                  disabled={busyHolderId === family.id || !family.renewal.referenceDate}
                  onClick={() => void onConfirm(family.id, family.renewal.referenceDate)}
                >
                  <CheckCircle2 className="mr-1 h-4 w-4" />
                  {busyHolderId === family.id ? "Salvando..." : "Concluir"}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Occurrence = Awaited<ReturnType<typeof getManagementOverview>>["recentOccurrences"][number];
function OccurrenceTable({ rows }: { rows: Occurrence[] }) {
  if (!rows.length)
    return (
      <p className="px-6 py-12 text-center text-sm text-slate-500">
        Nenhuma ocorrência registrada.
      </p>
    );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-600">
          <tr>
            <th className="px-5 py-3">Data</th>
            <th className="px-5 py-3">Família</th>
            <th className="px-5 py-3">Tipo</th>
            <th className="px-5 py-3">Descrição</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((item) => (
            <tr key={item.id}>
              <td className="px-5 py-3">{formatDate(item.occurred_on)}</td>
              <td className="px-5 py-3">
                <Link
                  to="/holders/$id"
                  params={{ id: String(item.holder_id) }}
                  className="font-medium text-teal-700 hover:underline"
                >
                  {item.holder_name}
                </Link>
                {item.beneficiary_name ? ` · ${item.beneficiary_name}` : ""}
              </td>
              <td className="px-5 py-3">
                <Badge variant="outline">{item.event_type}</Badge>
              </td>
              <td className="px-5 py-3 text-slate-600">{item.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
