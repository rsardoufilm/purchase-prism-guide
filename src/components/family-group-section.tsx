import { useState } from "react";
import { Copy, LogOut, Plus, Users, UserPlus, Loader2, Crown, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MemberAvatar } from "@/components/member-avatar";
import { formatInviteCode, normalizeInviteCode } from "@/lib/group";
import { useCurrentGroup } from "@/hooks/use-current-group";

/** Notifica o resto do app que o estado de grupo mudou (entrou/saiu/criou). */
function notifyGroupChanged() {
  window.dispatchEvent(new CustomEvent("aura:group-changed"));
  window.dispatchEvent(new CustomEvent("aura:data-changed"));
}

export function FamilyGroupSection() {
  const { loading, userId, group, members, isAdmin, refresh } = useCurrentGroup();
  const [mode, setMode] = useState<"idle" | "create" | "join">("idle");
  const [groupName, setGroupName] = useState("");
  const [inviteInput, setInviteInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleCreate = async () => {
    const name = groupName.trim();
    if (!name) {
      toast.error("Dê um nome ao grupo.");
      return;
    }
    if (!userId) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("grupos_familiares")
        .insert({ nome_grupo: name, criado_por: userId })
        .select("id")
        .single();
      if (error) throw error;
      const { error: e2 } = await supabase
        .from("membros_grupo")
        .insert({ grupo_id: data.id, user_id: userId, papel: "admin" });
      if (e2) throw e2;
      toast.success("Grupo criado! Compartilhe o código com sua família.");
      setGroupName("");
      setMode("idle");
      notifyGroupChanged();
      await refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao criar grupo.";
      toast.error(msg.includes("duplicate") ? "Você já está em um grupo." : msg);
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    const code = normalizeInviteCode(inviteInput);
    if (code.length !== 6) {
      toast.error("Código inválido. Use 6 caracteres.");
      return;
    }
    if (!userId) return;
    setBusy(true);
    try {
      const { data: rows, error } = await supabase.rpc("buscar_grupo_por_codigo", {
        _codigo: code,
      });
      if (error) throw error;
      const g = Array.isArray(rows) ? rows[0] : rows;
      if (!g) {
        toast.error("Código não encontrado. Confira com quem criou o grupo.");
        return;
      }
      const { error: e2 } = await supabase
        .from("membros_grupo")
        .insert({ grupo_id: g.id, user_id: userId, papel: "membro" });
      if (e2) {
        if (e2.message.includes("duplicate") || e2.code === "23505") {
          toast.error("Você já está em um grupo. Saia antes de entrar em outro.");
        } else {
          throw e2;
        }
        return;
      }
      toast.success(`Entrou em "${g.nome_grupo}".`);
      setInviteInput("");
      setMode("idle");
      notifyGroupChanged();
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao entrar.");
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    if (!group || !userId) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("membros_grupo")
        .delete()
        .eq("grupo_id", group.id)
        .eq("user_id", userId);
      if (error) throw error;
      toast.success("Você saiu do grupo.");
      setConfirmLeave(false);
      notifyGroupChanged();
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao sair.");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!group) return;
    setBusy(true);
    try {
      // Ao apagar o grupo, ON DELETE CASCADE remove membros_grupo.
      const { error } = await supabase.from("grupos_familiares").delete().eq("id", group.id);
      if (error) throw error;
      toast.success("Grupo encerrado.");
      setConfirmDelete(false);
      notifyGroupChanged();
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao encerrar.");
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    if (!group) return;
    try {
      await navigator.clipboard.writeText(group.codigo_convite);
      toast.success("Código copiado.");
    } catch {
      toast.error("Não foi possível copiar. Copie manualmente.");
    }
  };

  if (loading) {
    return (
      <section className="bg-card border border-border rounded-3xl p-5 mb-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando grupo…
        </div>
      </section>
    );
  }

  return (
    <section className="bg-card border border-border rounded-3xl p-5 space-y-4 mb-4">
      <div className="flex items-center gap-2">
        <span className="size-9 grid place-items-center rounded-2xl bg-primary-soft text-primary">
          <Users className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Grupo Familiar</h2>
          <p className="text-xs text-muted-foreground">
            Compartilhe as despesas com quem mora ou divide as contas com você.
          </p>
        </div>
      </div>

      {group ? (
        <>
          <div className="rounded-2xl bg-primary-soft/60 border border-primary/10 p-4 space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-display font-semibold text-base text-balance truncate">
                {group.nome_grupo}
              </p>
              {isAdmin && (
                <span className="text-[10px] uppercase tracking-wider font-bold text-primary inline-flex items-center gap-1">
                  <Crown className="size-3" /> Admin
                </span>
              )}
            </div>
            <div>
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Código de convite
              </Label>
              <button
                type="button"
                onClick={copyCode}
                className="mt-1 w-full flex items-center justify-between gap-2 bg-card border border-border rounded-xl px-3 py-2 hover:bg-muted transition-colors"
              >
                <span className="font-mono text-lg font-bold tracking-[0.2em] text-primary">
                  {formatInviteCode(group.codigo_convite)}
                </span>
                <Copy className="size-4 text-muted-foreground" />
              </button>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Compartilhe com até 9 pessoas. Quem entrar verá suas despesas e vice-versa.
              </p>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Membros ({members.length})
            </p>
            <ul className="space-y-1.5">
              {members.map((m) => (
                <li
                  key={m.user_id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2"
                >
                  <MemberAvatar userId={m.user_id} name={m.display_name} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {m.display_name || "Sem nome"}
                      {m.user_id === userId && (
                        <span className="text-muted-foreground font-normal"> (você)</span>
                      )}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {m.papel === "admin" ? "Administrador" : "Membro"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {isAdmin ? (
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(true)}
              disabled={busy}
              className="w-full h-11 rounded-2xl gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
            >
              <Trash2 className="size-4" /> Encerrar grupo
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => setConfirmLeave(true)}
              disabled={busy}
              className="w-full h-11 rounded-2xl gap-2"
            >
              <LogOut className="size-4" /> Sair do grupo
            </Button>
          )}
        </>
      ) : mode === "idle" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button
            onClick={() => setMode("create")}
            className="h-11 rounded-2xl bg-primary text-primary-foreground font-semibold gap-2"
          >
            <Plus className="size-4" /> Criar grupo
          </Button>
          <Button
            variant="outline"
            onClick={() => setMode("join")}
            className="h-11 rounded-2xl gap-2"
          >
            <UserPlus className="size-4" /> Entrar com código
          </Button>
        </div>
      ) : mode === "create" ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Nome do grupo
            </Label>
            <Input
              autoFocus
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Família Silva"
              maxLength={40}
              className="rounded-xl"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setMode("idle");
                setGroupName("");
              }}
              disabled={busy}
              className="flex-1 h-11 rounded-2xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={busy}
              className="flex-1 h-11 rounded-2xl bg-primary text-primary-foreground font-semibold"
            >
              {busy && <Loader2 className="size-4 mr-2 animate-spin" />}
              Criar
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Código (6 caracteres)
            </Label>
            <Input
              autoFocus
              value={formatInviteCode(inviteInput)}
              onChange={(e) => setInviteInput(normalizeInviteCode(e.target.value))}
              placeholder="ABC-123"
              inputMode="text"
              autoCapitalize="characters"
              className="rounded-xl font-mono tracking-[0.2em] text-center text-lg uppercase"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setMode("idle");
                setInviteInput("");
              }}
              disabled={busy}
              className="flex-1 h-11 rounded-2xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleJoin}
              disabled={busy || normalizeInviteCode(inviteInput).length !== 6}
              className="flex-1 h-11 rounded-2xl bg-primary text-primary-foreground font-semibold"
            >
              {busy && <Loader2 className="size-4 mr-2 animate-spin" />}
              Entrar
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair do grupo?</AlertDialogTitle>
            <AlertDialogDescription>
              Você deixará de ver as despesas dos outros membros. Suas despesas pessoais
              permanecem intactas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeave} disabled={busy}>
              {busy && <Loader2 className="size-4 mr-2 animate-spin" />}
              Sair
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar este grupo?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os membros serão desvinculados. As despesas de cada um permanecem
              individuais. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteGroup} disabled={busy}>
              {busy && <Loader2 className="size-4 mr-2 animate-spin" />}
              Encerrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
