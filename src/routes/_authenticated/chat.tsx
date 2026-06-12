import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { askAura } from "@/lib/chat.functions";
import { Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chat")({
  component: Chat,
  head: () => ({ meta: [{ title: "Pergunte aos seus dados — AURA" }] }),
});

interface Msg { role: "user" | "aura"; text: string }

const SUGGESTIONS = [
  "Quanto gastei este mês?",
  "Qual minha categoria que mais consome?",
  "Onde eu pago mais caro pelo arroz?",
  "Onde posso economizar?",
];

function Chat() {
  const ask = useServerFn(askAura);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  const send = async (question: string) => {
    const t = question.trim();
    if (!t || busy) return;
    setMsgs((m) => [...m, { role: "user", text: t }]);
    setQ("");
    setBusy(true);
    try {
      const res = await ask({ data: { question: t } });
      setMsgs((m) => [...m, { role: "aura", text: res.answer }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader eyebrow="IA" title="Pergunte aos seus dados" />

      {msgs.length === 0 && (
        <div className="space-y-3 mb-5">
          <div className="bg-card border border-border rounded-3xl p-5">
            <div className="flex items-center gap-2 text-primary mb-2">
              <Sparkles className="size-4" />
              <p className="text-xs font-semibold uppercase tracking-wider">Como funciona</p>
            </div>
            <p className="text-sm text-muted-foreground">
              A AURA responde só com base nos seus registros. Sem invenções.
            </p>
          </div>
          <div className="grid gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)}
                className="text-left text-sm bg-card hover:bg-muted border border-border rounded-2xl px-4 py-3 transition-colors">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3 mb-4">
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={
              m.role === "user"
                ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2.5 max-w-[85%] text-sm"
                : "bg-card border border-border rounded-2xl rounded-bl-md px-4 py-2.5 max-w-[90%] text-sm whitespace-pre-wrap"
            }>{m.text}</div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-2xl px-4 py-2.5 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="size-3.5 animate-spin" /> Analisando seus dados…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(q); }}
        className="sticky bottom-24 md:bottom-4 bg-background/80 backdrop-blur-xl flex gap-2"
      >
        <Input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Pergunte sobre seus gastos…"
          className="h-12 rounded-2xl"
          disabled={busy}
        />
        <Button type="submit" disabled={busy || !q.trim()} className="h-12 px-4 rounded-2xl bg-primary text-primary-foreground">
          <Send className="size-4" />
        </Button>
      </form>
    </>
  );
}
