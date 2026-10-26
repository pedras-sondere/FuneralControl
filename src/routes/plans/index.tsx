import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Layers, Loader2, Pencil, PlusCircle, Power } from "lucide-react";
import { toast } from "sonner";

import { getMe, listPlans, savePlan, type Plan } from "../../lib/api.functions";
import { AppLayout } from "../../components/app-layout";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";

export const Route = createFileRoute("/plans/")({
  beforeLoad: async () => {
    const user = await getMe();
    if (!user) throw redirect({ to: "/login" });
    return { user };
  },
  loader: () => listPlans(),
  component: PlansPage,
});

type PlanForm = {
  id?: number;
  name: string;
  monthly_price: string;
  max_beneficiaries: string;
  description: string;
  active: boolean;
};

const emptyForm = (): PlanForm => ({
  id: undefined,
  name: "",
  monthly_price: "",
  max_beneficiaries: "0",
  description: "",
  active: true,
});

function PlansPage() {
  const { user } = Route.useRouteContext();
  const plans = Route.useLoaderData() as Array<Plan & { holders: number }>;
  const router = useRouter();
  const [form, setForm] = useState<PlanForm>(emptyForm);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const edit = (plan?: Plan) => {
    setForm(
      plan
        ? {
            id: plan.id,
            name: plan.name,
            monthly_price: String(plan.monthly_price),
            max_beneficiaries: String(plan.max_beneficiaries),
            description: plan.description ?? "",
            active: plan.active,
          }
        : emptyForm(),
    );
    setOpen(true);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || Number(form.monthly_price) < 0 || Number(form.max_beneficiaries) < 0) {
      toast.warning("Preencha os dados do plano corretamente.");
      return;
    }
    setSaving(true);
    try {
      await savePlan({
        data: {
          id: form.id,
          name: form.name.trim(),
          monthly_price: Number(form.monthly_price),
          max_beneficiaries: Number(form.max_beneficiaries),
          description: form.description.trim() || null,
          active: form.active,
        },
      });
      toast.success(form.id ? "Plano atualizado." : "Plano criado.");
      setOpen(false);
      await router.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o plano.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout activeTab="plans" user={user}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Layers className="h-7 w-7 text-teal-700" />
              Planos
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Configure valores e limites de dependentes.
            </p>
          </div>
          <Button onClick={() => edit()} className="bg-teal-700 text-white hover:bg-teal-800">
            <PlusCircle className="mr-2 h-4 w-4" />
            Novo Plano
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-slate-500">
                Nenhum plano cadastrado.
              </CardContent>
            </Card>
          ) : (
            [...plans]
              .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
              .map((plan) => (
                <Card
                  key={plan.id}
                  className={
                    plan.active
                      ? "border-teal-200 bg-white shadow-sm"
                      : "border-dashed border-slate-300 bg-slate-50 opacity-75"
                  }
                >
                  <CardHeader className="flex flex-row items-start justify-between">
                    <div>
                      <CardTitle>{plan.name}</CardTitle>
                      <p className="mt-1 text-2xl font-bold text-teal-700">
                        R$ {Number(plan.monthly_price).toFixed(2)}
                        <span className="text-sm font-normal text-slate-500">/mês</span>
                      </p>
                    </div>
                    <Badge variant={plan.active ? "default" : "outline"}>
                      {plan.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="min-h-10 text-sm text-slate-600">
                      {plan.description || "Sem descrição."}
                    </p>
                    <div className="flex justify-between text-sm">
                      <span>
                        Beneficiários: <strong>{plan.max_beneficiaries}</strong>
                      </span>
                      <span>
                        Titulares: <strong>{plan.holders}</strong>
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => edit(plan)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => edit({ ...plan, active: !plan.active })}
                      >
                        <Power className="mr-2 h-4 w-4" />
                        {plan.active ? "Inativar" : "Ativar"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
          )}
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar plano" : "Novo plano"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="plan-name">Nome</Label>
              <Input
                id="plan-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="plan-price">Mensalidade</Label>
                <Input
                  id="plan-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.monthly_price}
                  onChange={(e) => setForm({ ...form, monthly_price: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="plan-max">Máx. beneficiários</Label>
                <Input
                  id="plan-max"
                  type="number"
                  min="0"
                  value={form.max_beneficiaries}
                  onChange={(e) => setForm({ ...form, max_beneficiaries: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="plan-description">Descrição</Label>
              <Textarea
                id="plan-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-teal-700 text-white" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
