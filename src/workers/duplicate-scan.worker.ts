/**
 * Web Worker para a varredura de pares duplicados.
 *
 * Recebe nomes únicos + chaves de pares já respondidos e devolve as
 * sugestões pendentes + auto-merges. Mantém o trabalho O(n²) da
 * tokenização + Jaccard fora da thread principal para não travar a UI.
 *
 * Toda I/O do Supabase continua na thread principal — o worker é puro
 * cálculo, sem dependências do ambiente DOM.
 */

const AUTO_UNIFY_THRESHOLD = 0.92;
const REVIEW_THRESHOLD = 0.6;

const STOPWORDS = new Set([
  "de", "da", "do", "das", "dos", "com", "sem", "tipo", "kg", "g", "gr", "ml",
  "l", "un", "und", "unid", "unidade", "pacote", "pct", "fardo", "cx", "caixa",
  "lt", "lts", "ltr", "litro", "litros", "embalagem", "embal", "emb",
]);

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function tokenize(name: string): string[] {
  return stripAccents((name ?? "").toLowerCase())
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  A.forEach((t) => {
    if (B.has(t)) inter += 1;
  });
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

export interface ScanWorkerInput {
  unique: string[];
  answeredKeys: string[];
}

export interface ScanWorkerOutput {
  newRows: { nome_a: string; nome_b: string; similaridade: number }[];
  autoMerges: { canonical: string; other: string; score: number }[];
}

function runScan({ unique, answeredKeys }: ScanWorkerInput): ScanWorkerOutput {
  const answered = new Set(answeredKeys);
  const tokens = unique.map((n) => ({ n, t: tokenize(n) }));
  const newRows: ScanWorkerOutput["newRows"] = [];
  const autoMerges: ScanWorkerOutput["autoMerges"] = [];

  for (let i = 0; i < tokens.length; i++) {
    for (let j = i + 1; j < tokens.length; j++) {
      const a = tokens[i];
      const b = tokens[j];
      if (a.t.length === 0 || b.t.length === 0) continue;
      const score = jaccard(a.t, b.t);
      if (score < REVIEW_THRESHOLD || score >= 1) continue;
      const k = [a.n, b.n].sort().join("|");
      if (answered.has(k)) continue;
      answered.add(k);
      const [nome_a, nome_b] = [a.n, b.n].sort();

      if (score >= AUTO_UNIFY_THRESHOLD) {
        const canonical = nome_a.length <= nome_b.length ? nome_a : nome_b;
        const other = canonical === nome_a ? nome_b : nome_a;
        autoMerges.push({ canonical, other, score: Number(score.toFixed(3)) });
      } else {
        newRows.push({ nome_a, nome_b, similaridade: Number(score.toFixed(3)) });
      }
    }
  }

  return { newRows, autoMerges };
}

self.onmessage = (event: MessageEvent<ScanWorkerInput>) => {
  try {
    const out = runScan(event.data);
    (self as unknown as Worker).postMessage({ ok: true, data: out });
  } catch (err) {
    (self as unknown as Worker).postMessage({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};

export {};
