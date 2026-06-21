import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/lib/theme";
import { Camera, ChevronRight, FileText, Loader2, LogOut, Moon, ShieldCheck, Sun, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { LEGAL } from "@/lib/legal-info";


export const Route = createFileRoute("/_authenticated/configuracoes")({
  component: Configuracoes,
  head: () => ({ meta: [{ title: "Configurações — AURA Finance" }] }),
});

const AVATAR_MAX = 5 * 1024 * 1024;

function Configuracoes() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [signedAvatar, setSignedAvatar] = useState<string | null>(null);

  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const user = u.user;
      if (!user) return;
      setUserId(user.id);
      setEmail(user.email ?? "");
      const { data: p } = await supabase
        .from("profiles")
        .select("display_name,avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (p) {
        setDisplayName(p.display_name ?? "");
        setAvatarUrl(p.avatar_url ?? null);
      }
    })();
  }, []);

  useEffect(() => {
    if (!avatarUrl) { setSignedAvatar(null); return; }
    supabase.storage.from("avatars").createSignedUrl(avatarUrl, 60 * 60).then(({ data }) => {
      setSignedAvatar(data?.signedUrl ?? null);
    });
  }, [avatarUrl]);

  const saveProfile = async () => {
    if (!userId) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: userId, display_name: displayName.trim() || null });
      if (error) throw error;
      toast.success("Perfil atualizado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    } finally { setSavingProfile(false); }
  };

  const uploadAvatar = async (file: File) => {
    if (!userId) return;
    if (!file.type.startsWith("image/")) { toast.error("Use uma imagem."); return; }
    if (file.size > AVATAR_MAX) { toast.error("Máximo 5MB."); return; }
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { contentType: file.type, upsert: true });
      if (upErr) throw upErr;
      const { error: pErr } = await supabase
        .from("profiles")
        .upsert({ id: userId, avatar_url: path });
      if (pErr) throw pErr;
      setAvatarUrl(path);
      toast.success("Foto atualizada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no upload");
    } finally { setUploadingAvatar(false); }
  };

  const changePassword = async () => {
    if (pwd.length < 8) { toast.error("Mínimo de 8 caracteres."); return; }
    if (pwd !== pwd2) { toast.error("As senhas não coincidem."); return; }
    setSavingPwd(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;
      setPwd(""); setPwd2("");
      toast.success("Senha atualizada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao alterar senha");
    } finally { setSavingPwd(false); }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <>
      <PageHeader eyebrow="Conta" title="Configurações" />

      {/* Perfil */}
      <section className="bg-card border border-border rounded-3xl p-5 space-y-4 mb-4">
        <h2 className="text-sm font-semibold">Perfil</h2>

        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="size-20 rounded-full bg-muted grid place-items-center overflow-hidden text-muted-foreground">
              {signedAvatar ? (
                <img src={signedAvatar} alt="Avatar" className="size-full object-cover" />
              ) : (
                <User className="size-8" />
              )}
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 size-8 rounded-full bg-primary text-primary-foreground grid place-items-center shadow"
              aria-label="Trocar foto"
            >
              {uploadingAvatar ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadAvatar(f);
                e.target.value = "";
              }}
            />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{email}</p>
            <p className="text-xs text-muted-foreground">Toque na câmera para trocar a foto</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome</Label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Como devemos te chamar"
            className="rounded-xl"
          />
        </div>

        <Button
          onClick={saveProfile}
          disabled={savingProfile}
          className="w-full h-11 rounded-2xl bg-primary text-primary-foreground font-semibold"
        >
          {savingProfile && <Loader2 className="size-4 mr-2 animate-spin" />}
          Salvar perfil
        </Button>
      </section>

      {/* Aparência */}
      <section className="bg-card border border-border rounded-3xl p-5 space-y-3 mb-4">
        <h2 className="text-sm font-semibold">Aparência</h2>
        <p className="text-xs text-muted-foreground">Escolha o tema da interface.</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setTheme("light")}
            className={`h-12 rounded-2xl border flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
              theme === "light" ? "border-primary bg-primary-soft text-primary" : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            <Sun className="size-4" /> Claro
          </button>
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={`h-12 rounded-2xl border flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
              theme === "dark" ? "border-primary bg-primary-soft text-primary" : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            <Moon className="size-4" /> Escuro
          </button>
        </div>
      </section>

      {/* Segurança */}
      <section className="bg-card border border-border rounded-3xl p-5 space-y-3 mb-4">
        <h2 className="text-sm font-semibold">Alterar senha</h2>
        <div className="space-y-1.5">
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nova senha</Label>
          <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} className="rounded-xl" autoComplete="new-password" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Confirmar nova senha</Label>
          <Input type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} className="rounded-xl" autoComplete="new-password" />
        </div>
        <Button
          onClick={changePassword}
          disabled={savingPwd || !pwd}
          className="w-full h-11 rounded-2xl bg-primary text-primary-foreground font-semibold"
        >
          {savingPwd && <Loader2 className="size-4 mr-2 animate-spin" />}
          Atualizar senha
        </Button>
      </section>

      {/* Sair */}
      <Button
        onClick={signOut}
        variant="outline"
        className="w-full h-11 rounded-2xl gap-2"
      >
        <LogOut className="size-4" /> Sair da conta
      </Button>
    </>
  );
}
