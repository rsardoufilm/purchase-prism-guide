// Detecção de linhas de nota que representam TAXA DE SERVIÇO, gorjeta ou couvert.
// Nunca entram em rankings de Consumo, Produtos mais consumidos, Produtos mais caros,
// Comparativo de mercados nem destaques do Dashboard.

const PATTERNS: RegExp[] = [
  /\btaxa\s*(de\s*)?servi[çc]o\b/i,
  /\bservi[çc]o\s*\(?\s*\d{1,2}\s*%?\s*\)?/i, // "Serviço 10%", "Serviço (10)"
  /\b\d{1,2}\s*%\s*(de\s*)?(gar[çc]om|servi[çc]o)\b/i, // "10% garçom"
  /\bgar[çc]on(agem|s)?\b/i,
  /\bgorjeta\b/i,
  /\bcouvert\b/i,
  /\bservice\s*charge\b/i,
  /\btip\b/i,
];

export function isServiceCharge(name: string | null | undefined): boolean {
  if (!name) return false;
  const s = String(name).trim();
  if (!s) return false;
  return PATTERNS.some((re) => re.test(s));
}
