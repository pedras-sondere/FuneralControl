import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, User, Lock, Loader2, ArrowRight } from "lucide-react";
import { getMe, login } from "../lib/api.functions";
import { errorMessage } from "../lib/error-message";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const user = await getMe();
    if (user) {
      throw redirect({ to: "/" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.warning("Por favor, preencha todos os campos.");
      return;
    }

    setLoading(true);
    try {
      const res = await login({ data: { email, password } });
      if (!res.ok) {
        toast.error(res.error || "Credenciais inválidas");
      } else {
        toast.success("Acesso autorizado com sucesso!");
        navigate({ to: res.mustChangePassword ? "/change-password" : "/" });
      }
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Não foi possível conectar ao servidor"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-lg border-slate-200 dark:border-slate-800">
          <CardHeader className="space-y-3 text-center pb-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-700 text-white shadow-md shadow-teal-700/20">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                FuneralControl
              </CardTitle>
              <CardDescription className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Sistema de Gestão de Planos Funerários
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="username"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                >
                  Usuário
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="Digite seu usuário"
                    className="pl-9"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    autoFocus
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
                >
                  Senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-9"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-teal-700 hover:bg-teal-800 text-white font-medium py-2.5 mt-2 transition-all shadow-md shadow-teal-700/20 cursor-pointer"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    Acessar Sistema
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
                <p className="text-xs text-slate-400">
                  Acesso restrito para colaboradores autorizados.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
