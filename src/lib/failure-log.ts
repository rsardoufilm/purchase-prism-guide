// Diário de falhas — persistido em localStorage (últimas 50 entradas).
// Usado pelo fluxo de captura/upload/OCR para auditoria do usuário.

export interface FailureEntry {
  id: string;
  at: string; // ISO
  stage: string;
  message: string;
  meta?: Record<string, unknown>;
}

const KEY = "aura:failures";
const MAX = 50;

function safeRead(): FailureEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FailureEntry[]) : [];
  } catch {
    return [];
  }
}

function safeWrite(list: FailureEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    window.dispatchEvent(new CustomEvent("aura:failures-changed"));
  } catch {
    /* ignore quota */
  }
}

export function logFailure(stage: string, error: unknown, meta?: Record<string, unknown>) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Falha desconhecida";
  const entry: FailureEntry = {
    id: (typeof crypto !== "undefined" && crypto.randomUUID?.()) || String(Date.now()),
    at: new Date().toISOString(),
    stage,
    message,
    meta,
  };
  // eslint-disable-next-line no-console
  console.warn("[AURA_FAILURE]", stage, message, meta ?? {});
  const list = safeRead();
  list.unshift(entry);
  safeWrite(list);
  return entry;
}

export function readFailures(): FailureEntry[] {
  return safeRead();
}

export function clearFailures() {
  safeWrite([]);
}
