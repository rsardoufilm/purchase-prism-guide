import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase places recovery info in URL hash
    const hash = window.location.hash;
    if (hash.includes("type=recovery") || hash.includes("access_token")) {
      setReady(true);
    } else {
      supabase.auth.getUser().then(({ data }) => setReady(!!data.user));
    }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      toast.error("Senha precisa de mínimo 6 caracteres, com letras e números.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Senha atualizada!");
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-5 bg-background">
      <div className="w-full max-w-sm bg-card border border-border rounded-3xl p-6 shadow-[var(--shadow-card)]">
        <h1 className="font-display text-2xl font-bold mb-1">Nova senha</h1>
        <p className="text-sm text-muted-foreground mb-5">Defina uma nova senha para sua conta.</p>
        {!ready ? (
          <p className="text-sm text-muted-foreground">Link inválido ou expirado.</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="newpw"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Nova senha
              </Label>
              <Input
                id="newpw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 rounded-xl"
                required
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold"
            >
              {loading && <Loader2 className="size-4 mr-2 animate-spin" />}
              Salvar senha
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
