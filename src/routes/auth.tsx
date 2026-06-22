import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import logoAura from "@/assets/logo-aura.png";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Entrar — AURA Consumo" },
      {
        name: "description",
        content: "Acesse o AURA Consumo e entenda para onde seu dinheiro está indo.",
      },
    ],
  }),
});

const credSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z
    .string()
    .min(6, "Mínimo de 6 caracteres")
    .max(72)
    .regex(/[A-Za-z]/, "Use letras e números")
    .regex(/[0-9]/, "Use letras e números"),
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "forgot") {
        const parsed = z.string().email("E-mail inválido").safeParse(email.trim());
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          return;
        }
        const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Enviamos um link para o seu e-mail.");
        setMode("signin");
        return;
      }

      const parsed = credSchema.safeParse({ email: email.trim(), password });
      if (!parsed.success) {
        toast.error(parsed.error.issues[0].message);
        return;
      }

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Conta criada. Bem-vindo ao AURA.");
        navigate({ to: "/dashboard", replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Algo deu errado";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message || "Falha ao entrar com Google");
        setLoading(false);
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao entrar com Google");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-12 bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-block relative mb-5">
            <div className="absolute -inset-2 rounded-2xl bg-gradient-to-br from-primary/25 to-primary/5 dark:from-primary/45 dark:to-primary/15 blur-[4px]" />
            <div className="relative rounded-2xl bg-card/90 dark:bg-card/70 ring-1 ring-primary/20 dark:ring-primary/40 p-2.5 shadow-sm dark:shadow-[0_0_32px_hsla(24,95%,58%,0.30)]">
              <img
                src={logoAura}
                alt="AURA Consumo"
                width={64}
                height={64}
                className="size-16"
              />
            </div>
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight">AURA Consumo</h1>
          <p className="text-sm text-muted-foreground mt-1.5 text-balance">
            Entenda para onde seu dinheiro está indo.
          </p>
        </div>

        <div className="bg-card border border-border rounded-3xl p-6 shadow-[var(--shadow-card)]">
          <div className="flex gap-1 p-1 bg-muted rounded-full mb-6">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 text-xs font-semibold py-2 rounded-full transition-all ${
                  mode === m
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                {m === "signin" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                className="h-11 rounded-xl"
                required
              />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Senha
                  </Label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="text-[11px] text-primary font-semibold"
                    >
                      Esqueci minha senha
                    </button>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres, letras e números"
                  className="h-11 rounded-xl"
                  required
                />
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              {loading && <Loader2 className="size-4 animate-spin mr-2" />}
              {mode === "signin" && "Entrar"}
              {mode === "signup" && "Criar minha conta"}
              {mode === "forgot" && "Enviar link de recuperação"}
            </Button>
          </form>

          {mode !== "forgot" && (
            <>
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                  ou
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <Button
                variant="outline"
                onClick={google}
                disabled={loading}
                className="w-full h-11 rounded-xl border-border bg-card hover:bg-muted font-semibold gap-2"
              >
                <svg className="size-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continuar com Google
              </Button>
            </>
          )}

          {mode === "forgot" && (
            <button
              type="button"
              onClick={() => setMode("signin")}
              className="w-full mt-4 text-xs text-muted-foreground hover:text-foreground"
            >
              ← Voltar para entrar
            </button>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground text-center mt-6 max-w-xs mx-auto text-balance">
          Inteligência de consumo premium. Seus dados são privados e protegidos.
        </p>
      </div>
    </div>
  );
}
