import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Calendar, CheckCircle2, FileText, Loader2, PlusCircle } from "lucide-react";
import { toast } from "sonner";

import { generateInvoices, getMe, listInvoices, payInvoice, setInvoiceStatus } from "../../lib/api.functions";
import { AppLayout } from "../../components/app-layout";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";

export const Route = createFileRoute("/invoices/")({
  beforeLoad: async () => {
    const user = await getMe();
    if (!user) throw redirect({ to: "/login" });
    return { user };
  },
  loader: () => listInvoices({ data: { status: "todas", month: "" } }),
  component: InvoicesPage,
});

function currentMonth() { return new Date().toISOString().slice(0, 7); }

function InvoicesPage() {
  const { user } = Route.useRouteContext();
  const initial = Route.useLoaderData();
  const router = useRouter();
  const [status, setStatus] = useState("todas");
  const [month, setMonth] = useState("");
  const [paymentId, setPaymentId] = useState<number | null>(null);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [busy, setBusy] = useState(false);
  const invoices = initial.filter((invoice) => (status === "todas" || invoice.status === status) && (!month || invoice.reference_month === month));

  const refresh = () => router.invalidate();
  const generate = async () => { setBusy(true); try { const result = await generateInvoices({ data: { month: month || currentMonth() } }); toast.success(`${result.created} fatura(s) gerada(s).`); await refresh(); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível gerar faturas."); } finally { setBusy(false); } };
  const pay = async (event: React.FormEvent) => { event.preventDefault(); if (!paymentId) return; setBusy(true); try { await payInvoice({ data: { id: paymentId, paid_at: paymentDate, payment_method: paymentMethod } }); toast.success("Pagamento registrado."); setPaymentId(null); await refresh(); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível registrar o pagamento."); } finally { setBusy(false); } };
  const cancel = async (id: number) => { setBusy(true); try { await setInvoiceStatus({ data: { id, status: "cancelada" } }); toast.success("Fatura cancelada."); await refresh(); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível cancelar a fatura."); } finally { setBusy(false); } };
  const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  return <AppLayout activeTab="invoices" user={user}><div className="space-y-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="flex items-center gap-2 text-2xl font-bold"><FileText className="h-7 w-7 text-teal-700" />Faturas</h1><p className="mt-1 text-sm text-slate-500">Acompanhe cobranças e pagamentos dos titulares.</p></div><Button onClick={generate} disabled={busy} className="bg-teal-700 text-white hover:bg-teal-800"><PlusCircle className="mr-2 h-4 w-4" />Gerar faturas do mês</Button></div><Card><CardHeader><CardTitle className="text-base">Filtros</CardTitle></CardHeader><CardContent className="flex flex-col gap-3 sm:flex-row"><Select value={status} onValueChange={setStatus}><SelectTrigger className="sm:w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas">Todas</SelectItem><SelectItem value="aberta">Abertas</SelectItem><SelectItem value="vencida">Vencidas</SelectItem><SelectItem value="paga">Pagas</SelectItem><SelectItem value="cancelada">Canceladas</SelectItem></SelectContent></Select><Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="sm:w-52" /><Button variant="outline" onClick={() => { setStatus("todas"); setMonth(""); }}>Limpar</Button></CardContent></Card><Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-600"><tr><th className="px-4 py-3">Titular</th><th className="px-4 py-3">Referência</th><th className="px-4 py-3">Vencimento</th><th className="px-4 py-3">Valor</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3 text-right">Ações</th></tr></thead><tbody className="divide-y">{invoices.length === 0 ? <tr><td colSpan={6} className="py-12 text-center text-slate-500">Nenhuma fatura encontrada.</td></tr> : invoices.map((invoice) => <tr key={invoice.id}><td className="px-4 py-3 font-medium">{invoice.holder_name}</td><td className="px-4 py-3">{invoice.reference_month}</td><td className="px-4 py-3">{invoice.due_date}</td><td className="px-4 py-3 font-semibold">{money(invoice.amount)}</td><td className="px-4 py-3"><Badge variant={invoice.status === "vencida" ? "destructive" : invoice.status === "paga" ? "default" : "outline"}>{invoice.status}</Badge></td><td className="px-4 py-3 text-right">{invoice.status === "aberta" || invoice.status === "vencida" ? <span className="inline-flex gap-2"><Button size="sm" onClick={() => setPaymentId(invoice.id)}><CheckCircle2 className="mr-1 h-4 w-4" />Baixar</Button><Button size="sm" variant="ghost" onClick={() => cancel(invoice.id)}>Cancelar</Button></span> : invoice.paid_at ? <span className="text-xs text-slate-500">Pago em {invoice.paid_at}</span> : <Calendar className="ml-auto h-4 w-4 text-slate-400" />}</td></tr>)}</tbody></table></div></CardContent></Card></div><Dialog open={paymentId !== null} onOpenChange={(open) => !open && setPaymentId(null)}><DialogContent><DialogHeader><DialogTitle>Registrar pagamento</DialogTitle></DialogHeader><form onSubmit={pay} className="space-y-4"><div><Label htmlFor="payment-date">Data do pagamento</Label><Input id="payment-date" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required /></div><div><Label htmlFor="payment-method">Forma de pagamento</Label><Select value={paymentMethod} onValueChange={setPaymentMethod}><SelectTrigger id="payment-method"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pix">PIX</SelectItem><SelectItem value="dinheiro">Dinheiro</SelectItem><SelectItem value="cartao">Cartão</SelectItem><SelectItem value="transferencia">Transferência</SelectItem></SelectContent></Select></div><DialogFooter><Button type="button" variant="outline" onClick={() => setPaymentId(null)}>Cancelar</Button><Button type="submit" className="bg-emerald-600 text-white" disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar pagamento</Button></DialogFooter></form></DialogContent></Dialog></AppLayout>;
}
