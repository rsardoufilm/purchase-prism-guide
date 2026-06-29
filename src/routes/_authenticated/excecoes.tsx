import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import {
  listDecisions,
  revertDecision,
  type DuplicateSuggestion,
} from "@/lib/duplicate-scan";
import { Check, X, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/excecoes")({
  component: Excecoes,
  head: () => ({ meta: [{ title: "Exceções — AURA Consumo" }] }),
});

function Excecoes() {
  const [items, setItems] = useState<DuplicateSuggestion[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"todas" | "aceita" | "rejeitada">("todas");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (uid: string) => {
    setLoading(true);
    try {
      const data = await listDecisions(uid);
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      setUserId(uid);
      load(uid);
    });
  }, [load]);

  const handleRevert = async (s: DuplicateSuggestion) => {
    if (!userId) return;
    await revertDecision(userId, s.id, s.nome_a, s.nome_b);
    toast.success("Decisão revertida — voltará a aparecer para revisão.");
    load(userId);
  };

  const filtered = items.filter((x) => filter === "todas" || x.status === filter);
  const aceitas = items.filter((x) => x.status === "aceita").length;
  const rejeitadas = items.filter((x) => x.status === "rejeitada").length;

  return (
    <>
      <PageHeader eyebrow="Exceções" title="Decisões de unificação" />
      <p className="text-xs text-muted-foreground mb-3">
        Revise pares de produtos que você já marcou como iguais ou diferentes.
      </p>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <Stat label="Total" value={items.length} active={filter === "todas"} onClick={() => setFilter("todas")} />
        <Stat label="Unificadas" value={aceitas} active={filter === "aceita"} onClick={() => setFilter("aceita")} />
        <Stat label="Mantidas" value={rejeitadas} active={filter === "rejeitada"} onClick={() => setFilter("rejeitada")} />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma decisão registrada ainda.</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((s) => (
            <li
              key={s.id}
              className="bg-card border border-border rounded-2xl p-3 sm:p-4 flex items-start gap-3"
            >
              <div
                className={
                  s.status === "aceita"
                    ? "size-8 rounded-xl bg-primary-soft text-primary grid place-items-center shrink-0"
                    : "size-8 rounded-xl bg-muted text-muted-foreground grid place-items-center shrink-0"
                }
              >
                {s.status === "aceita" ? <Check className="size-4" /> : <X className="size-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  {s.status === "aceita" ? "Unificados" : "Mantidos separados"}
                  {" · "}
                  {Math.round(Number(s.similaridade) * 100)}% similar
                </p>
                <p className="text-sm font-semibold truncate">{s.nome_a}</p>
                <p className="text-sm text-muted-foreground truncate">{s.nome_b}</p>
              </div>
              <button
                type="button"
                onClick={() => handleRevert(s)}
                className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground rounded-lg px-2 py-1 hover:bg-muted transition-colors"
                aria-label="Reverter decisão"
              >
                <RotateCcw className="size-3" />
                Reverter
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-2xl border p-3 text-left transition-colors " +
        (active
          ? "border-primary/40 bg-primary-soft text-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground")
      }
    >
      <p className="text-[10px] uppercase tracking-wider font-semibold">{label}</p>
      <p className="text-lg font-bold text-foreground">{value}</p>
    </button>
  );
}
