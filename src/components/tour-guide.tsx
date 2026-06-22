import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export interface TourStep {
  title: string;
  body: string;
}

interface Props {
  tourKey: string;
  steps: TourStep[];
}

const REPLAY_EVENT = "aura:replay-tour";

export function replayTour(tourKey: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(REPLAY_EVENT, { detail: { tourKey } }));
}

export function TourGuide({ tourKey, steps }: Props) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const finish = useCallback(
    async (markDone: boolean) => {
      setOpen(false);
      if (!markDone) return;
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        await supabase
          .from("user_tour_progress")
          .upsert({ user_id: user.id, tour_key: tourKey, completed_at: new Date().toISOString() });
      } catch {
        /* silencioso — não bloqueia UX */
      }
    },
    [tourKey],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const { data } = await supabase
          .from("user_tour_progress")
          .select("tour_key")
          .eq("user_id", user.id)
          .eq("tour_key", tourKey)
          .maybeSingle();
        if (!cancelled && !data) {
          setIndex(0);
          setOpen(true);
        }
      } catch {
        /* sem internet ou sem sessão — ignora */
      }
    })();

    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ tourKey?: string }>).detail;
      if (detail?.tourKey === tourKey) {
        setIndex(0);
        setOpen(true);
      }
    };
    window.addEventListener(REPLAY_EVENT, handler);
    return () => {
      cancelled = true;
      window.removeEventListener(REPLAY_EVENT, handler);
    };
  }, [tourKey]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(true);
      if (e.key === "ArrowRight" && index < steps.length - 1) setIndex((i) => i + 1);
      if (e.key === "ArrowLeft" && index > 0) setIndex((i) => i - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, steps.length, finish]);

  if (!open || typeof document === "undefined" || steps.length === 0) return null;

  const step = steps[index];
  const isLast = index === steps.length - 1;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Guia rápido"
    >
      <button
        type="button"
        aria-label="Fechar guia"
        onClick={() => finish(true)}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default"
      />

      <div className="relative w-[min(94vw,440px)] mb-4 sm:mb-0 bg-card border border-border rounded-2xl shadow-2xl p-5 sm:p-6 animate-aura-in">
        <button
          onClick={() => finish(true)}
          className="absolute top-3 right-3 size-8 grid place-items-center rounded-full hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Fechar guia"
        >
          <X className="size-4" />
        </button>

        <div className="flex items-center gap-2 mb-2">
          <span className="grid place-items-center size-7 rounded-full bg-primary-soft text-primary">
            <Sparkles className="size-4" aria-hidden />
          </span>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">
            Guia rápido · Passo {index + 1} de {steps.length}
          </p>
        </div>

        <h2 className="font-display text-lg sm:text-xl font-bold mb-2 pr-8 leading-tight">
          {step.title}
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
          {step.body}
        </p>

        <div className="flex items-center justify-center gap-1.5 mt-4" aria-hidden>
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-6 bg-primary" : "w-1.5 bg-border"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between mt-5 gap-2">
          <button
            type="button"
            onClick={() => finish(true)}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Não mostrar de novo
          </button>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIndex((i) => i - 1)}
                aria-label="Passo anterior"
              >
                <ChevronLeft className="size-4" />
                Voltar
              </Button>
            )}
            {isLast ? (
              <Button size="sm" onClick={() => finish(true)}>
                Entendi
              </Button>
            ) : (
              <Button size="sm" onClick={() => setIndex((i) => i + 1)} aria-label="Próximo passo">
                Próximo
                <ChevronRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
