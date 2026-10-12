import { createFileRoute, redirect, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "../../lib/error-message";
import {
  Users,
  Search,
  PlusCircle,
  UserCheck,
  AlertTriangle,
  FileText,
  Calendar,
  Phone,
  ChevronRight,
  Filter,
  Loader2,
  Building2,
} from "lucide-react";
import { getMe, listHolders, listPlans, saveHolder, type Plan } from "../../lib/api.functions";
import { AppLayout } from "../../components/app-layout";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";

export const Route = createFileRoute("/holders/")({
  beforeLoad: async () => {
    const user = await getMe();
    if (!user) {
      throw redirect({ to: "/login" });
    }
    return { user };
  },
  loader: async () => {
    const [holders, plans] = await Promise.all([listHolders({ data: {} }), listPlans()]);
    return { holders, plans };
  },
  component: HoldersListPage,
});

function HoldersListPage() {
  const { user } = Route.useRouteContext();
  const { holders: initialHolders, plans } = Route.useLoaderData();
  const router = useRouter();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    cpf: "",
    birth_date: "",
    phone: "",
    email: "",
    address: "",
    plan_id: plans.length > 0 ? String(plans[0].id) : "",
    due_day: "10",
    join_date: new Date().toISOString().split("T")[0],
    status: "ativo" as "ativo" | "cancelado",
  });

  const formatCPF = (val: string) => {
    const cleaned = val.replace(/\D/g, "").slice(0, 11);
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return cleaned.replace(/(\d{3})(\d+)/, "$1.$2");
    if (cleaned.length <= 9) return cleaned.replace(/(\d{3})(\d{3})(\d+)/, "$1.$2.$3");
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, "$1.$2.$3-$4");
  };

  const formatPhone = (val: string) => {
    const cleaned = val.replace(/\D/g, "").slice(0, 11);
    if (cleaned.length <= 2) return cleaned;
    if (cleaned.length <= 7) return cleaned.replace(/(\d{2})(\d+)/, "($1) $2");
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  };

  const handleOpenNewModal = () => {
    if (plans.length === 0) {
      toast.warning("Cadastre ao menos um plano antes de adicionar titulares.");
    }
    setFormData({
      name: "",
      cpf: "",
      birth_date: "",
      phone: "",
      email: "",
      address: "",
      plan_id: plans.length > 0 ? String(plans[0].id) : "",
      due_day: "10",
      join_date: new Date().toISOString().split("T")[0],
      status: "ativo",
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.warning("Informe o nome do titular");
      return;
    }
    const cleanCpf = formData.cpf.replace(/\D/g, "");
    if (cleanCpf.length !== 11) {
      toast.warning("CPF deve conter 11 dígitos");
      return;
    }
    if (!formData.plan_id) {
      toast.warning("Selecione um plano");
      return;
    }

    setSaving(true);
    try {
      const res = await saveHolder({
        data: {
          name: formData.name.trim(),
          cpf: cleanCpf,
          birth_date: formData.birth_date || null,
          phone: formData.phone || null,
          email: formData.email ? formData.email.trim() : null,
          address: formData.address || null,
          plan_id: Number(formData.plan_id),
          due_day: Number(formData.due_day),
          join_date: formData.join_date,
          status: formData.status,
        },
      });

      if (!res.ok) {
        toast.error("error" in res ? res.error : "Erro ao salvar titular");
      } else {
        toast.success("Titular cadastrado com sucesso!");
        setIsModalOpen(false);
        router.invalidate();
      }
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Erro de conexão ao salvar titular"));
    } finally {
      setSaving(false);
    }
  };

  // Client-side filtering
  const filteredHolders = initialHolders.filter((h) => {
    const matchesSearch =
      searchTerm.trim() === "" ||
      h.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.cpf.includes(searchTerm.replace(/\D/g, ""));

    const matchesStatus =
      statusFilter === "todos" || h.status.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  return (
    <AppLayout activeTab="holders" user={user}>
      <div className="space-y-6">
        {/* Header section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
              <Users className="h-7 w-7 text-teal-700" />
              Gestão de Titulares
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Cadastre e gerencie titulares, seus dependentes e contratos associados.
            </p>
          </div>

          <Button
            onClick={handleOpenNewModal}
            className="bg-teal-700 hover:bg-teal-800 text-white shadow-xs cursor-pointer"
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Novo Titular
          </Button>
        </div>

        {/* Filter and Search Bar */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar por nome ou CPF..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-white dark:bg-slate-900"
                />
              </div>

              {/* Status filter buttons */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                {[
                  { id: "todos", label: "Todos" },
                  { id: "ativo", label: "Ativos" },
                  { id: "inadimplente", label: "Inadimplentes" },
                  { id: "cancelado", label: "Cancelados" },
                ].map((s) => (
                  <Button
                    key={s.id}
                    variant={statusFilter === s.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter(s.id)}
                    className={`cursor-pointer text-xs h-9 ${
                      statusFilter === s.id
                        ? "bg-teal-700 hover:bg-teal-800 text-white"
                        : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Holders Table */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardContent className="p-0">
            {filteredHolders.length === 0 ? (
              <div className="text-center py-16 px-4">
                <Users className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-700 mb-3" />
                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
                  Nenhum titular encontrado
                </h3>
                <p className="text-sm text-slate-400 max-w-sm mx-auto mt-1">
                  {searchTerm || statusFilter !== "todos"
                    ? "Tente alterar os termos da busca ou os filtros de status selecionados."
                    : "Cadastre o primeiro titular para iniciar o gerenciamento dos planos funerários."}
                </p>
                {!(searchTerm || statusFilter !== "todos") && (
                  <Button
                    onClick={handleOpenNewModal}
                    className="mt-5 bg-teal-700 hover:bg-teal-800 text-white cursor-pointer"
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Cadastrar Titular
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5">Nome / CPF</th>
                      <th className="px-5 py-3.5">Plano Contratado</th>
                      <th className="px-5 py-3.5 text-center">Vencimento</th>
                      <th className="px-5 py-3.5 text-center">Beneficiários</th>
                      <th className="px-5 py-3.5">Situação</th>
                      <th className="px-5 py-3.5 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredHolders.map((h) => (
                      <tr
                        key={h.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50 transition-colors"
                      >
                        <td className="px-5 py-4">
                          <Link
                            to="/holders/$id"
                            params={{ id: String(h.id) }}
                            className="font-medium text-slate-900 dark:text-slate-100 hover:text-teal-700 dark:hover:text-teal-400 block"
                          >
                            {h.name}
                          </Link>
                          <span className="text-xs text-slate-400 block font-mono">
                            {formatCPF(h.cpf)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-700 dark:text-slate-300">
                          <span className="font-medium">{h.plan_name}</span>
                        </td>
                        <td className="px-5 py-4 text-center font-medium text-slate-700 dark:text-slate-300">
                          Dia {h.due_day}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {h.beneficiaries} dependente{h.beneficiaries !== 1 ? "s" : ""}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {h.status === "ativo" && (
                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-none">
                              Ativo
                            </Badge>
                          )}
                          {h.status === "inadimplente" && (
                            <Badge
                              variant="destructive"
                              className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-none"
                            >
                              Inadimplente
                            </Badge>
                          )}
                          {h.status === "cancelado" && (
                            <Badge variant="outline" className="text-slate-500 border-slate-300">
                              Cancelado
                            </Badge>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <Link
                            to="/holders/$id"
                            params={{ id: String(h.id) }}
                            className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800 dark:text-teal-400 hover:underline"
                          >
                            Abrir Ficha
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
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

      {/* Modal / Dialog de Cadastro de Titular */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Cadastrar Novo Titular
            </DialogTitle>
            <DialogDescription>
              Preencha os dados cadastrais e vincule o plano do titular.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="holder-name" className="text-xs font-semibold">
                  Nome Completo *
                </Label>
                <Input
                  id="holder-name"
                  placeholder="Ex: João da Silva"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="holder-cpf" className="text-xs font-semibold">
                  CPF (apenas números ou formatado) *
                </Label>
                <Input
                  id="holder-cpf"
                  placeholder="000.000.000-00"
                  value={formData.cpf}
                  onChange={(e) => setFormData({ ...formData, cpf: formatCPF(e.target.value) })}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="holder-birth" className="text-xs font-semibold">
                  Data de Nascimento
                </Label>
                <Input
                  id="holder-birth"
                  type="date"
                  value={formData.birth_date}
                  onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="holder-phone" className="text-xs font-semibold">
                  Telefone / Celular
                </Label>
                <Input
                  id="holder-phone"
                  placeholder="(00) 00000-0000"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="holder-email" className="text-xs font-semibold">
                  E-mail
                </Label>
                <Input
                  id="holder-email"
                  type="email"
                  placeholder="cliente@exemplo.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="holder-address" className="text-xs font-semibold">
                  Endereço Completo
                </Label>
                <Input
                  id="holder-address"
                  placeholder="Rua, número, bairro, cidade - UF"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Plano Escolhido *</Label>
                <Select
                  value={formData.plan_id}
                  onValueChange={(val) => setFormData({ ...formData, plan_id: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o plano" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name} - R$ {Number(p.monthly_price).toFixed(2)}/mês (até{" "}
                        {p.max_beneficiaries} dep.)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="holder-due" className="text-xs font-semibold">
                  Dia de Vencimento da Mensalidade (1 a 28) *
                </Label>
                <Input
                  id="holder-due"
                  type="number"
                  min="1"
                  max="28"
                  value={formData.due_day}
                  onChange={(e) => setFormData({ ...formData, due_day: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="holder-join" className="text-xs font-semibold">
                  Data de Adesão *
                </Label>
                <Input
                  id="holder-join"
                  type="date"
                  value={formData.join_date}
                  onChange={(e) => setFormData({ ...formData, join_date: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Situação Cadastral *</Label>
                <Select
                  value={formData.status}
                  onValueChange={(val: "ativo" | "cancelado") =>
                    setFormData({ ...formData, status: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-teal-700 hover:bg-teal-800 text-white cursor-pointer"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Cadastrar Titular"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
