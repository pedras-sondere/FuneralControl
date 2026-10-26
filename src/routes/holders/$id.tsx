import { createFileRoute, redirect, Link, useRouter, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "../../lib/error-message";
import {
  ArrowLeft,
  Users,
  FileText,
  UserCheck,
  AlertTriangle,
  PlusCircle,
  Calendar,
  Phone,
  Mail,
  MapPin,
  ShieldCheck,
  Download,
  ExternalLink,
  Trash2,
  Edit,
  Loader2,
  Upload,
  CheckCircle2,
  DollarSign,
} from "lucide-react";
import {
  getMe,
  getHolder,
  listPlans,
  saveHolder,
  saveBeneficiary,
  deleteBeneficiary,
  recordFamilyOccurrence,
  recordPersonLifecycle,
  uploadContract,
  deleteContract,
} from "../../lib/api.functions";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
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

type BeneficiaryRecord = {
  id: number;
  name: string;
  cpf: string | null;
  birth_date: string | null;
  relationship: string;
  status: "ativo" | "falecido" | "cancelado";
  status_changed_at: string | null;
  is_current_holder: boolean;
};

type ContractRecord = {
  id: number;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
};

export const Route = createFileRoute("/holders/$id")({
  beforeLoad: async () => {
    const user = await getMe();
    if (!user) {
      throw redirect({ to: "/login" });
    }
    return { user };
  },
  loader: async ({ params }) => {
    const holderId = Number(params.id);
    if (!holderId || isNaN(holderId)) {
      throw notFound();
    }
    const [data, plans] = await Promise.all([getHolder({ data: { id: holderId } }), listPlans()]);
    if (!data || !data.holder) {
      throw notFound();
    }
    return { data, plans: plans || [] };
  },
  component: HolderDetailsPage,
});

function HolderDetailsPage() {
  const { user } = Route.useRouteContext();
  const { data, plans } = Route.useLoaderData();
  const router = useRouter();

  const { holder, beneficiaries, contracts } = data;
  const events = data.events;

  // Edit Holder Modal State
  const [isEditHolderOpen, setIsEditHolderOpen] = useState(false);
  const [savingHolder, setSavingHolder] = useState(false);
  const [isOccurrenceOpen, setIsOccurrenceOpen] = useState(false);
  const [isLifecycleOpen, setIsLifecycleOpen] = useState(false);
  const [savingOccurrence, setSavingOccurrence] = useState(false);
  const [savingLifecycle, setSavingLifecycle] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [occurrenceForm, setOccurrenceForm] = useState({
    event_type: "observacao" as "inadimplencia" | "utilizacao" | "observacao" | "outro",
    beneficiary_id: "none",
    occurred_on: today,
    description: "",
  });
  const [lifecycleForm, setLifecycleForm] = useState({
    subject: "titular" as "titular" | "beneficiario",
    beneficiary_id: "none",
    status: "falecido" as "falecido" | "cancelado",
    occurred_on: today,
    description: "",
    successor_beneficiary_id: "none",
  });
  const [holderFormData, setHolderFormData] = useState({
    name: holder.name,
    cpf: holder.cpf,
    birth_date: holder.birth_date || "",
    phone: holder.phone || "",
    email: holder.email || "",
    address: holder.address || "",
    plan_id: String(holder.plan_id),
    due_day: String(holder.due_day),
    join_date: holder.join_date,
    monthly_billing_date: holder.monthly_billing_date || "",
    status: holder.base_status as "ativo" | "falecido" | "cancelado",
  });

  // Beneficiary Modal State
  const [isBenModalOpen, setIsBenModalOpen] = useState(false);
  const [savingBen, setSavingBen] = useState(false);
  const [editingBenId, setEditingBenId] = useState<number | null>(null);
  const [benFormData, setBenFormData] = useState({
    name: "",
    cpf: "",
    birth_date: "",
    relationship: "Cônjuge",
  });

  // Upload Contract State
  const [uploadingContract, setUploadingContract] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const formatCPF = (val: string) => {
    if (!val) return "-";
    const cleaned = val.replace(/\D/g, "").slice(0, 11);
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return cleaned.replace(/(\d{3})(\d+)/, "$1.$2");
    if (cleaned.length <= 9) return cleaned.replace(/(\d{3})(\d{3})(\d+)/, "$1.$2.$3");
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, "$1.$2.$3-$4");
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val || 0);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const [year, month, day] = dateStr.split("-");
    if (!year || !month || !day) return dateStr;
    return `${day}/${month}/${year}`;
  };

  // Handler: Update Holder
  const handleUpdateHolder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingHolder(true);
    try {
      const res = await saveHolder({
        data: {
          id: holder.id,
          name: holderFormData.name.trim(),
          cpf: holderFormData.cpf.replace(/\D/g, ""),
          birth_date: holderFormData.birth_date || null,
          phone: holderFormData.phone || null,
          email: holderFormData.email ? holderFormData.email.trim() : null,
          address: holderFormData.address || null,
          plan_id: Number(holderFormData.plan_id),
          due_day: Number(holderFormData.due_day),
          join_date: holderFormData.join_date,
          monthly_billing_date: holderFormData.monthly_billing_date || null,
          status: holderFormData.status,
        },
      });

      if (!res.ok) {
        toast.error("error" in res ? res.error : "Erro ao atualizar titular");
      } else {
        toast.success("Dados do titular atualizados!");
        setIsEditHolderOpen(false);
        router.invalidate();
      }
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Erro de conexão ao salvar alterações"));
    } finally {
      setSavingHolder(false);
    }
  };

  const handleSaveOccurrence = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingOccurrence(true);
    try {
      const result = await recordFamilyOccurrence({
        data: {
          holder_id: holder.id,
          beneficiary_id:
            occurrenceForm.beneficiary_id === "none" ? null : Number(occurrenceForm.beneficiary_id),
          event_type: occurrenceForm.event_type,
          occurred_on: occurrenceForm.occurred_on,
          description: occurrenceForm.description,
        },
      });
      if (!result.ok) return toast.error(result.error);
      toast.success("Ocorrência registrada no histórico familiar.");
      setIsOccurrenceOpen(false);
      setOccurrenceForm({ ...occurrenceForm, description: "" });
      await router.invalidate();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Não foi possível registrar a ocorrência."));
    } finally {
      setSavingOccurrence(false);
    }
  };

  const handleSaveLifecycle = async (event: React.FormEvent) => {
    event.preventDefault();
    if (lifecycleForm.subject === "beneficiario" && lifecycleForm.beneficiary_id === "none") {
      toast.warning("Selecione o beneficiário.");
      return;
    }
    setSavingLifecycle(true);
    try {
      const result = await recordPersonLifecycle({
        data: {
          holder_id: holder.id,
          subject: lifecycleForm.subject,
          beneficiary_id:
            lifecycleForm.subject === "beneficiario" ? Number(lifecycleForm.beneficiary_id) : null,
          status: lifecycleForm.status,
          occurred_on: lifecycleForm.occurred_on,
          description: lifecycleForm.description || undefined,
          successor_beneficiary_id:
            lifecycleForm.successor_beneficiary_id === "none"
              ? null
              : Number(lifecycleForm.successor_beneficiary_id),
        },
      });
      if (!result.ok) return toast.error(result.error);
      toast.success("Situação atualizada e registrada no histórico familiar.");
      setIsLifecycleOpen(false);
      await router.invalidate();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Não foi possível atualizar a situação."));
    } finally {
      setSavingLifecycle(false);
    }
  };

  // Handler: Open Beneficiary Modal
  const handleOpenAddBen = () => {
    const activeBeneficiaries = beneficiaries.filter(
      (beneficiary: BeneficiaryRecord) => beneficiary.status === "ativo",
    );
    if (activeBeneficiaries.length >= holder.max_beneficiaries) {
      toast.error(`Limite do plano atingido (máximo ${holder.max_beneficiaries} dependentes).`);
      return;
    }
    setEditingBenId(null);
    setBenFormData({
      name: "",
      cpf: "",
      birth_date: "",
      relationship: "Cônjuge",
    });
    setIsBenModalOpen(true);
  };

  const handleOpenEditBen = (b: BeneficiaryRecord) => {
    setEditingBenId(b.id);
    setBenFormData({
      name: b.name,
      cpf: b.cpf ? formatCPF(b.cpf) : "",
      birth_date: b.birth_date || "",
      relationship: b.relationship,
    });
    setIsBenModalOpen(true);
  };

  // Handler: Save Beneficiary
  const handleSaveBen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!benFormData.name.trim()) {
      toast.warning("Nome do dependente é obrigatório");
      return;
    }

    setSavingBen(true);
    try {
      const res = await saveBeneficiary({
        data: {
          id: editingBenId || undefined,
          holder_id: holder.id,
          name: benFormData.name.trim(),
          cpf: benFormData.cpf ? benFormData.cpf.replace(/\D/g, "") : null,
          birth_date: benFormData.birth_date || null,
          relationship: benFormData.relationship,
        },
      });

      if (!res.ok) {
        toast.error(res.error || "Erro ao salvar dependente");
      } else {
        toast.success(
          editingBenId ? "Dependente atualizado!" : "Dependente cadastrado com sucesso!",
        );
        setIsBenModalOpen(false);
        router.invalidate();
      }
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Erro de conexão"));
    } finally {
      setSavingBen(false);
    }
  };

  // Handler: Delete Beneficiary
  const handleDeleteBen = async (id: number, name: string) => {
    if (
      !confirm(`Deseja marcar o dependente "${name}" como cancelado? O histórico será preservado.`)
    )
      return;
    try {
      await deleteBeneficiary({ data: { id } });
      toast.success("Dependente marcado como cancelado. O histórico foi preservado.");
      router.invalidate();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Erro ao excluir dependente"));
    }
  };

  // Handler: Upload Contract
  const handleUploadContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.warning("Selecione um arquivo de contrato.");
      return;
    }

    setUploadingContract(true);
    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      fd.append("holder_id", String(holder.id));

      const res = await uploadContract({ data: fd });
      if (!res.ok) {
        toast.error(res.error || "Erro ao fazer upload do contrato");
      } else {
        toast.success("Contrato digitalizado enviado com sucesso!");
        setSelectedFile(null);
        router.invalidate();
      }
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Erro no envio do documento"));
    } finally {
      setUploadingContract(false);
    }
  };

  // Handler: Delete Contract
  const handleDeleteContract = async (id: number, filename: string) => {
    if (!confirm(`Deseja excluir o documento "${filename}"?`)) return;
    try {
      await deleteContract({ data: { id } });
      toast.success("Contrato excluído com sucesso");
      router.invalidate();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Erro ao remover contrato"));
    }
  };

  return (
    <AppLayout activeTab="holders" user={user}>
      <div className="space-y-6">
        {/* Top Navigation Back Link */}
        <div className="flex items-center justify-between">
          <Link
            to="/holders"
            className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Voltar para lista de Titulares
          </Link>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsOccurrenceOpen(true)}
              className="cursor-pointer"
            >
              <PlusCircle className="mr-1.5 h-4 w-4 text-slate-500" /> Registrar ocorrência
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsLifecycleOpen(true)}
              className="cursor-pointer"
            >
              <AlertTriangle className="mr-1.5 h-4 w-4 text-amber-600" /> Falecimento ou
              cancelamento
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditHolderOpen(true)}
              className="cursor-pointer"
            >
              <Edit className="mr-1.5 h-4 w-4 text-slate-500" />
              Editar Dados
            </Button>
          </div>
        </div>

        {/* Titular Header Summary Card */}
        <Card className="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800/80">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    {holder.name}
                  </h1>
                  {holder.status === "ativo" && (
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-none">
                      Ativo
                    </Badge>
                  )}
                  {holder.status === "inadimplente" && (
                    <Badge
                      variant="destructive"
                      className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-none"
                    >
                      Inadimplente
                    </Badge>
                  )}
                  {holder.status === "cancelado" && (
                    <Badge variant="outline" className="text-slate-500">
                      Cancelado
                    </Badge>
                  )}
                  {holder.status === "falecido" && (
                    <Badge className="bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 border-none">
                      Falecido
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                  CPF: {formatCPF(holder.cpf)}
                </p>
              </div>

              <div className="flex items-center gap-4 text-right">
                <div>
                  <p className="text-xs text-slate-400">Plano Contratado</p>
                  <p className="text-base font-bold text-teal-700 dark:text-teal-400">
                    {holder.plan_name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatCurrency(holder.monthly_price)} / mês
                  </p>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-xs text-slate-400 block">Telefone / Contato</span>
                <span className="font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5 mt-0.5">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  {holder.phone || "Não informado"}
                </span>
              </div>

              <div>
                <span className="text-xs text-slate-400 block">E-mail</span>
                <span className="font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5 mt-0.5 truncate">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  {holder.email || "Não informado"}
                </span>
              </div>

              <div>
                <span className="text-xs text-slate-400 block">Dia do Vencimento</span>
                <span className="font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5 mt-0.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  Todo dia {holder.due_day}
                </span>
              </div>

              <div>
                <span className="text-xs text-slate-400 block">Data de Adesão</span>
                <span className="font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5 mt-0.5">
                  <UserCheck className="h-3.5 w-3.5 text-slate-400" />
                  {formatDate(holder.join_date)}
                </span>
              </div>

              <div>
                <span className="text-xs text-slate-400 block">Data-base da Renovação</span>
                <span className="font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5 mt-0.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  {formatDate(holder.monthly_billing_date)}
                </span>
              </div>

              {holder.current_holder_name && (
                <div>
                  <span className="text-xs text-slate-400 block">Titular Atual</span>
                  <span className="font-medium text-teal-700 dark:text-teal-400 flex items-center gap-1.5 mt-0.5">
                    <UserCheck className="h-3.5 w-3.5" />
                    {holder.current_holder_name}
                  </span>
                </div>
              )}

              <div className="sm:col-span-2 md:col-span-4 pt-2 border-t border-slate-50 dark:border-slate-800">
                <span className="text-xs text-slate-400 block">Endereço Residencial</span>
                <span className="font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5 mt-0.5">
                  <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  {holder.address || "Endereço não cadastrado"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs: Beneficiários, Contrato, Faturas */}
        <Tabs defaultValue="beneficiaries" className="space-y-4">
          <TabsList className="bg-slate-200/80 dark:bg-slate-800 p-1">
            <TabsTrigger value="beneficiaries" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Beneficiários ({beneficiaries.length}/{holder.max_beneficiaries})
            </TabsTrigger>
            <TabsTrigger value="contracts" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Contrato Digitalizado ({contracts.length})
            </TabsTrigger>
            <TabsTrigger value="events" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Ocorrências ({events.length})
            </TabsTrigger>
          </TabsList>

          {/* ABA 1: BENEFICIÁRIOS */}
          <TabsContent value="beneficiaries" className="space-y-4">
            <Card className="border-slate-200 dark:border-slate-800 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-lg font-bold">Dependentes e Beneficiários</CardTitle>
                  <CardDescription>
                    O plano {holder.plan_name} permite até {holder.max_beneficiaries} dependentes
                    vinculados.
                  </CardDescription>
                </div>
                <Button
                  onClick={handleOpenAddBen}
                  disabled={
                    beneficiaries.filter(
                      (beneficiary: BeneficiaryRecord) => beneficiary.status === "ativo",
                    ).length >= holder.max_beneficiaries
                  }
                  className="bg-teal-700 hover:bg-teal-800 text-white cursor-pointer"
                  size="sm"
                >
                  <PlusCircle className="mr-1.5 h-4 w-4" />
                  Adicionar Dependente
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {beneficiaries.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <Users className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-700 mb-2" />
                    <p className="font-medium text-slate-700 dark:text-slate-300">
                      Nenhum dependente cadastrado
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Adicione os beneficiários do plano para constarem na cobertura funerária.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="px-5 py-3">Nome Completo</th>
                          <th className="px-5 py-3">CPF</th>
                          <th className="px-5 py-3">Nascimento</th>
                          <th className="px-5 py-3">Parentesco</th>
                          <th className="px-5 py-3">Situação</th>
                          <th className="px-5 py-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {beneficiaries.map((b: BeneficiaryRecord) => (
                          <tr
                            key={b.id}
                            className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50"
                          >
                            <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-slate-100">
                              {b.name}
                            </td>
                            <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400 font-mono text-xs">
                              {formatCPF(b.cpf)}
                            </td>
                            <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">
                              {formatDate(b.birth_date)}
                            </td>
                            <td className="px-5 py-3.5">
                              <Badge variant="outline" className="text-slate-700 border-slate-300">
                                {b.relationship}
                              </Badge>
                            </td>
                            <td className="px-5 py-3.5">
                              <Badge variant={b.status === "ativo" ? "default" : "outline"}>
                                {b.is_current_holder ? "Titular atual" : b.status}
                              </Badge>
                            </td>
                            <td className="px-5 py-3.5 text-right space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenEditBen(b)}
                                className="h-8 w-8 p-0 text-slate-500 hover:text-teal-700"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteBen(b.id, b.name)}
                                className="h-8 w-8 p-0 text-slate-500 hover:text-rose-600"
                              >
                                <Trash2 className="h-4 w-4" />
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
          </TabsContent>

          <TabsContent value="events" className="space-y-4">
            <Card className="border-slate-200 dark:border-slate-800 shadow-xs">
              <CardHeader>
                <CardTitle className="text-lg font-bold">Histórico familiar</CardTitle>
                <CardDescription>
                  Eventos operacionais e alterações de situação preservados para auditoria.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {events.length === 0 ? (
                  <p className="px-6 py-12 text-center text-sm text-slate-500">
                    Nenhuma ocorrência registrada.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {events.map(
                      (item: {
                        id: number;
                        event_type: string;
                        occurred_on: string;
                        description: string;
                        beneficiary_name: string | null;
                        created_by_name: string | null;
                      }) => (
                        <div key={item.id} className="px-5 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{item.event_type}</Badge>
                            <span className="text-xs text-slate-500">
                              {formatDate(item.occurred_on)}
                              {item.beneficiary_name ? ` · ${item.beneficiary_name}` : ""}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                            {item.description}
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ABA 2: CONTRATO DIGITALIZADO */}
          <TabsContent value="contracts" className="space-y-4">
            <Card className="border-slate-200 dark:border-slate-800 shadow-xs">
              <CardHeader>
                <CardTitle className="text-lg font-bold">Upload de Contrato Digitalizado</CardTitle>
                <CardDescription>
                  Envie o contrato físico assinado e digitalizado (formato PDF ou imagem até 20MB).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={handleUploadContract}
                  className="flex flex-col sm:flex-row items-center gap-3"
                >
                  <Input
                    type="file"
                    accept=".pdf,image/jpeg,image/png,image/webp"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="cursor-pointer file:cursor-pointer"
                  />
                  <Button
                    type="submit"
                    disabled={!selectedFile || uploadingContract}
                    className="w-full sm:w-auto bg-teal-700 hover:bg-teal-800 text-white cursor-pointer"
                  >
                    {uploadingContract ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Anexar Arquivo
                      </>
                    )}
                  </Button>
                </form>

                <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-6">
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">
                    Documentos Anexados ({contracts.length})
                  </h4>

                  {contracts.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      <FileText className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-700 mb-2" />
                      <p className="text-sm">Nenhum contrato anexado para este titular.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {contracts.map((c: ContractRecord) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <FileText className="h-5 w-5 text-teal-700 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                                {c.file_name}
                              </p>
                              <p className="text-xs text-slate-400">
                                {(c.size_bytes / 1024 / 1024).toFixed(2)} MB • Enviado em{" "}
                                {formatDate(c.uploaded_at?.split("T")[0])}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <a
                              href={`/api/contracts/${c.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200"
                            >
                              <ExternalLink className="mr-1 h-3.5 w-3.5 text-teal-700" />
                              Visualizar
                            </a>
                            <a
                              href={`/api/contracts/${c.id}?download=1`}
                              className="inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200"
                            >
                              <Download className="mr-1 h-3.5 w-3.5" />
                              Baixar
                            </a>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteContract(c.id, c.file_name)}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>

      <Dialog open={isOccurrenceOpen} onOpenChange={setIsOccurrenceOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar ocorrência</DialogTitle>
            <DialogDescription>O registro ficará no histórico desta família.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveOccurrence} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <Select
                value={occurrenceForm.event_type}
                onValueChange={(value: "inadimplencia" | "utilizacao" | "observacao" | "outro") =>
                  setOccurrenceForm({ ...occurrenceForm, event_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inadimplencia">Inadimplência</SelectItem>
                  <SelectItem value="utilizacao">Utilização do plano</SelectItem>
                  <SelectItem value="observacao">Observação</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Relacionado a</Label>
              <Select
                value={occurrenceForm.beneficiary_id}
                onValueChange={(value) =>
                  setOccurrenceForm({ ...occurrenceForm, beneficiary_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Família / titular original</SelectItem>
                  {beneficiaries.map((beneficiary: BeneficiaryRecord) => (
                    <SelectItem key={beneficiary.id} value={String(beneficiary.id)}>
                      {beneficiary.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data *</Label>
              <Input
                type="date"
                value={occurrenceForm.occurred_on}
                onChange={(e) =>
                  setOccurrenceForm({ ...occurrenceForm, occurred_on: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição *</Label>
              <Input
                value={occurrenceForm.description}
                onChange={(e) =>
                  setOccurrenceForm({ ...occurrenceForm, description: e.target.value })
                }
                placeholder="Ex.: Mensalidade de outubro não foi quitada."
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOccurrenceOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={savingOccurrence}>
                {savingOccurrence ? "Salvando..." : "Registrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isLifecycleOpen} onOpenChange={setIsLifecycleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Falecimento ou cancelamento</DialogTitle>
            <DialogDescription>
              O cadastro não será excluído. A alteração ficará registrada no histórico familiar.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveLifecycle} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Pessoa *</Label>
              <Select
                value={lifecycleForm.subject}
                onValueChange={(value: "titular" | "beneficiario") =>
                  setLifecycleForm({ ...lifecycleForm, subject: value, beneficiary_id: "none" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="titular">Titular original</SelectItem>
                  <SelectItem value="beneficiario">Beneficiário</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {lifecycleForm.subject === "beneficiario" ? (
              <div className="space-y-1.5">
                <Label>Beneficiário *</Label>
                <Select
                  value={lifecycleForm.beneficiary_id}
                  onValueChange={(value) =>
                    setLifecycleForm({ ...lifecycleForm, beneficiary_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {beneficiaries.map((beneficiary: BeneficiaryRecord) => (
                      <SelectItem key={beneficiary.id} value={String(beneficiary.id)}>
                        {beneficiary.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label>Situação *</Label>
              <Select
                value={lifecycleForm.status}
                onValueChange={(value: "falecido" | "cancelado") =>
                  setLifecycleForm({ ...lifecycleForm, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="falecido">Falecimento</SelectItem>
                  <SelectItem value="cancelado">Cancelamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {lifecycleForm.subject === "titular" && lifecycleForm.status === "falecido" ? (
              <div className="space-y-1.5">
                <Label>Beneficiário que assume como titular atual</Label>
                <Select
                  value={lifecycleForm.successor_beneficiary_id}
                  onValueChange={(value) =>
                    setLifecycleForm({ ...lifecycleForm, successor_beneficiary_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Não definir agora" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não definir agora</SelectItem>
                    {beneficiaries
                      .filter((beneficiary: BeneficiaryRecord) => beneficiary.status === "ativo")
                      .map((beneficiary: BeneficiaryRecord) => (
                        <SelectItem key={beneficiary.id} value={String(beneficiary.id)}>
                          {beneficiary.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label>Data *</Label>
              <Input
                type="date"
                value={lifecycleForm.occurred_on}
                onChange={(e) =>
                  setLifecycleForm({ ...lifecycleForm, occurred_on: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Observação</Label>
              <Input
                value={lifecycleForm.description}
                onChange={(e) =>
                  setLifecycleForm({ ...lifecycleForm, description: e.target.value })
                }
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsLifecycleOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="destructive" disabled={savingLifecycle}>
                {savingLifecycle ? "Salvando..." : "Confirmar alteração"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Titular */}
      <Dialog open={isEditHolderOpen} onOpenChange={setIsEditHolderOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Editar Dados do Titular</DialogTitle>
            <DialogDescription>Atualize as informações cadastrais e plano.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateHolder} className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-semibold">Nome Completo *</Label>
                <Input
                  value={holderFormData.name}
                  onChange={(e) => setHolderFormData({ ...holderFormData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">CPF *</Label>
                <Input
                  value={holderFormData.cpf}
                  onChange={(e) =>
                    setHolderFormData({ ...holderFormData, cpf: formatCPF(e.target.value) })
                  }
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Data de Nascimento</Label>
                <Input
                  type="date"
                  value={holderFormData.birth_date}
                  onChange={(e) =>
                    setHolderFormData({ ...holderFormData, birth_date: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Telefone / Celular</Label>
                <Input
                  value={holderFormData.phone}
                  onChange={(e) => setHolderFormData({ ...holderFormData, phone: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">E-mail</Label>
                <Input
                  type="email"
                  value={holderFormData.email}
                  onChange={(e) => setHolderFormData({ ...holderFormData, email: e.target.value })}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-semibold">Endereço</Label>
                <Input
                  value={holderFormData.address}
                  onChange={(e) =>
                    setHolderFormData({ ...holderFormData, address: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Plano *</Label>
                <Select
                  value={holderFormData.plan_id}
                  onValueChange={(val) => setHolderFormData({ ...holderFormData, plan_id: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {plans
                      .filter((p) => p.active || String(p.id) === holderFormData.plan_id)
                      .map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name} - R$ {Number(p.monthly_price).toFixed(2)}/mês
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Dia de Vencimento (1 a 28) *</Label>
                <Input
                  type="number"
                  min="1"
                  max="28"
                  value={holderFormData.due_day}
                  onChange={(e) =>
                    setHolderFormData({ ...holderFormData, due_day: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Data de Adesão *</Label>
                <Input
                  type="date"
                  value={holderFormData.join_date}
                  onChange={(e) =>
                    setHolderFormData({ ...holderFormData, join_date: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Data-base da mensalidade / renovação
                </Label>
                <Input
                  type="date"
                  value={holderFormData.monthly_billing_date}
                  onChange={(e) =>
                    setHolderFormData({ ...holderFormData, monthly_billing_date: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Situação</Label>
                <Input value={holderFormData.status} readOnly className="capitalize bg-slate-50" />
                <p className="text-xs text-slate-500">
                  Use “Falecimento ou cancelamento” para preservar a data e o histórico.
                </p>
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={() => setIsEditHolderOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-teal-700 hover:bg-teal-800 text-white"
                disabled={savingHolder}
              >
                {savingHolder ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Adicionar/Editar Dependente */}
      <Dialog open={isBenModalOpen} onOpenChange={setIsBenModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {editingBenId ? "Editar Dependente" : "Adicionar Dependente"}
            </DialogTitle>
            <DialogDescription>
              Informe os dados do dependente para vincular a este titular.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveBen} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nome Completo *</Label>
              <Input
                placeholder="Ex: Maria da Silva"
                value={benFormData.name}
                onChange={(e) => setBenFormData({ ...benFormData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">CPF (opcional)</Label>
              <Input
                placeholder="000.000.000-00"
                value={benFormData.cpf}
                onChange={(e) => setBenFormData({ ...benFormData, cpf: formatCPF(e.target.value) })}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Data de Nascimento</Label>
              <Input
                type="date"
                value={benFormData.birth_date}
                onChange={(e) => setBenFormData({ ...benFormData, birth_date: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Grau de Parentesco *</Label>
              <Select
                value={benFormData.relationship}
                onValueChange={(val) => setBenFormData({ ...benFormData, relationship: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cônjuge">Cônjuge</SelectItem>
                  <SelectItem value="Filho(a)">Filho(a)</SelectItem>
                  <SelectItem value="Pai/Mãe">Pai/Mãe</SelectItem>
                  <SelectItem value="Irmão(ã)">Irmão(ã)</SelectItem>
                  <SelectItem value="Sogro(a)">Sogro(a)</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={() => setIsBenModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-teal-700 hover:bg-teal-800 text-white"
                disabled={savingBen}
              >
                {savingBen ? "Salvando..." : "Salvar Dependente"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </AppLayout>
  );
}
