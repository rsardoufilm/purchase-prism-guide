import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { scanDuplicates } from "@/lib/duplicate-scan";
import { toast } from "sonner";

const LAST_SCAN_KEY = "aura:last-duplicate-scan";
const LAST_AUDIT_KEY = "aura:last-weekly-audit";
const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

/**
 * Detecção contínua de duplicatas:
 * - Roda varredura silenciosa a cada 24h (auto-unifica seguros).
 * - Roda auditoria semanal com toast informando o resultado.
 * - Listener em mudanças de dados dispara nova varredura no próximo ciclo.
 */
export function useContinuousScan() {
  useEffect(() => {
    let cancelled = false;

    const run = async (weekly: boolean) => {
      try {
        const { data } = await supabase.auth.getUser();
        const uid = data.user?.id;
        if (!uid || cancelled) return;
        const result = await scanDuplicates(uid);
        if (cancelled) return;

        if (weekly) {
          const parts: string[] = [];
          if (result.autoUnified > 0) parts.push(`${result.autoUnified} unificado(s)`);
          if (result.pending.length > 0) parts.push(`${result.pending.length} para revisar`);
          toast.message("Auditoria semanal concluída", {
            description: parts.length > 0 ? parts.join(" · ") : "Nenhuma duplicata nova encontrada.",
          });
          localStorage.setItem(LAST_AUDIT_KEY, String(Date.now()));
        } else if (result.autoUnified > 0) {
          toast.success(`${result.autoUnified} produto(s) unificado(s) automaticamente`);
          window.dispatchEvent(new CustomEvent("aura:data-changed"));
        }
        localStorage.setItem(LAST_SCAN_KEY, String(Date.now()));
      } catch {
        /* silent */
      }
    };

    const lastScan = Number(localStorage.getItem(LAST_SCAN_KEY) ?? 0);
    const lastAudit = Number(localStorage.getItem(LAST_AUDIT_KEY) ?? 0);
    const now = Date.now();
    const auditDue = now - lastAudit >= WEEK;
    const scanDue = now - lastScan >= DAY;

    if (auditDue) {
      // pequeno atraso para não competir com o load inicial
      const t = window.setTimeout(() => run(true), 4000);
      return () => {
        cancelled = true;
        window.clearTimeout(t);
      };
    }
    if (scanDue) {
      const t = window.setTimeout(() => run(false), 6000);
      return () => {
        cancelled = true;
        window.clearTimeout(t);
      };
    }
    return () => {
      cancelled = true;
    };
  }, []);
}
