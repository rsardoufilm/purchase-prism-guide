// Helpers utilitários do módulo de Grupo Familiar.

/** Iniciais para o avatar (até 2 caracteres). */
export function initialsFromName(name: string | null | undefined, fallback = "?"): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return fallback.toUpperCase();
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Paleta determinística de cores tonais para membros do grupo.
 * Mantém harmonia com o tema (laranja como primary, complementares saturadas
 * mas com brilho controlado para o branco do texto contrastar em ambos os modos).
 */
const MEMBER_PALETTE = [
  { bg: "#F97316", fg: "#FFFFFF" }, // laranja (primary)
  { bg: "#0EA5E9", fg: "#FFFFFF" }, // céu
  { bg: "#10B981", fg: "#FFFFFF" }, // esmeralda
  { bg: "#8B5CF6", fg: "#FFFFFF" }, // violeta
  { bg: "#EC4899", fg: "#FFFFFF" }, // rosa
  { bg: "#F59E0B", fg: "#1F2937" }, // âmbar (fg escuro p/ contraste)
  { bg: "#14B8A6", fg: "#FFFFFF" }, // teal
  { bg: "#EF4444", fg: "#FFFFFF" }, // vermelho
  { bg: "#6366F1", fg: "#FFFFFF" }, // indigo
  { bg: "#84CC16", fg: "#1F2937" }, // lima
] as const;

/** Hash estável (FNV-1a) → índice da paleta. */
export function colorForUserId(userId: string | null | undefined): {
  bg: string;
  fg: string;
} {
  if (!userId) return MEMBER_PALETTE[0];
  let hash = 0x811c9dc5;
  for (let i = 0; i < userId.length; i++) {
    hash ^= userId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return MEMBER_PALETTE[hash % MEMBER_PALETTE.length];
}

/** Formata "ABC123" → "ABC-123". */
export function formatInviteCode(raw: string): string {
  const clean = raw.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  if (clean.length <= 3) return clean;
  return `${clean.slice(0, 3)}-${clean.slice(3, 6)}`;
}

/** Normaliza entrada do usuário (remove separadores e força maiúsculas). */
export function normalizeInviteCode(raw: string): string {
  return raw.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 6);
}
