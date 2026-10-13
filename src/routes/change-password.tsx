import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { changePassword, getMe } from "../lib/api.functions";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

export const Route = createFileRoute("/change-password")({
  beforeLoad: async () => {
    const user = await getMe();
    if (!user) throw redirect({ to: "/login" });
    if (!user.mustChangePassword) throw redirect({ to: "/" });
  },
  component: ChangePasswordPage,
});

function ChangePasswordPage() {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center p-6">
      <form
        className="w-full space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setLoading(true);
          try {
            const result = await changePassword({ data: { currentPassword, newPassword } });
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success("Senha atualizada.");
            navigate({ to: "/" });
          } finally {
            setLoading(false);
          }
        }}
      >
        <h1 className="text-2xl font-bold">Defina uma nova senha</h1>
        <p className="text-sm text-muted-foreground">
          Para sua segurança, altere a senha inicial antes de continuar.
        </p>
        <Label>
          Senha atual
          <Input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
        </Label>
        <Label>
          Nova senha
          <Input
            type="password"
            minLength={8}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />
        </Label>
        <Button type="submit" disabled={loading}>
          {loading ? "Salvando..." : "Salvar nova senha"}
        </Button>
      </form>
    </main>
  );
}
