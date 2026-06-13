// ConsumoClassifier — normalização determinística pós-OCR.
// Mapeia descrições comerciais (raw_name) para categorias padronizadas.
// Extensível: basta adicionar novas entradas em RULES.

export type ConsumoCategory =
  | "Arroz" | "Feijão" | "Carne Bovina" | "Frango" | "Suínos"
  | "Peixes" | "Frios" | "Queijos" | "Leite" | "Iogurtes"
  | "Pães" | "Massas" | "Óleos" | "Açúcar" | "Café"
  | "Bebidas" | "Refrigerantes" | "Cervejas" | "Águas"
  | "Frutas" | "Verduras" | "Legumes"
  | "Higiene" | "Limpeza" | "Pet"
  | "Snacks" | "Doces" | "Congelados"
  | "Padaria" | "Farmácia" | "Combustível" | "Restaurantes"
  | "Outros";

type Rule = { cat: ConsumoCategory; patterns: RegExp };

// Ordem importa: regras mais específicas primeiro.
const RULES: Rule[] = [
  { cat: "Arroz", patterns: /\b(arroz|arrz)\b/i },
  { cat: "Feijão", patterns: /\b(feij[aã]o|feijao)\b/i },
  { cat: "Carne Bovina", patterns: /\b(patinho|alcatra|cox[aã]o|acem|fraldinha|picanha|m[uú]sculo|maminha|contra ?fil[eé]|file mignon|carne bovina|bovin[oa])\b/i },
  { cat: "Frango", patterns: /\b(frango|peito de frango|coxa|sobrecoxa|asa de frango|file de frango)\b/i },
  { cat: "Suínos", patterns: /\b(linguica|linguiça|bacon|lombo|pernil|costelinha|toucinho|salsicha)\b/i },
  { cat: "Peixes", patterns: /\b(sardinha|atum|tilapia|tilápia|salm[aã]o|merluza|pescado|bacalhau)\b/i },
  { cat: "Queijos", patterns: /\b(queijo|mussarela|muçarela|prato|minas|parmes[aã]o|provolone|requeij[aã]o)\b/i },
  { cat: "Frios", patterns: /\b(presunto|peito de peru|mortadela|salame|apresuntado)\b/i },
  { cat: "Leite", patterns: /\b(leite|itamb[eé]|italac|piracanjuba|parmalat|ninho)\b/i },
  { cat: "Iogurtes", patterns: /\b(iogurte|danone|activia|yopro|petit suisse|danoninho)\b/i },
  { cat: "Pães", patterns: /\b(p[aã]o|broa|bisnaga|baguete)\b/i },
  { cat: "Massas", patterns: /\b(macarr[aã]o|espaguete|talharim|penne|lasanha|nhoque)\b/i },
  { cat: "Óleos", patterns: /\b([oó]leo|azeite|manteiga|margarina)\b/i },
  { cat: "Açúcar", patterns: /\b(a[cç][uú]car|adoçante|adocante)\b/i },
  { cat: "Café", patterns: /\b(caf[eé]|p[oó] de caf[eé]|3 cora[cç][oõ]es|melitta|pil[aã]o)\b/i },
  { cat: "Refrigerantes", patterns: /\b(coca[- ]?cola|guaran[aá]|fanta|sprite|pepsi|refrigerante|refri)\b/i },
  { cat: "Cervejas", patterns: /\b(cerveja|skol|brahma|heineken|antarctica|amstel|stella|budweiser|corona)\b/i },
  { cat: "Águas", patterns: /\b([aá]gua mineral|[aá]gua sem g[aá]s|[aá]gua com g[aá]s|crystal)\b/i },
  { cat: "Bebidas", patterns: /\b(suco|n[eé]ctar|del valle|ades|vinho|whisky|vodka)\b/i },
  { cat: "Frutas", patterns: /\b(banana|ma[cç][aã]|mamao|mam[aã]o|melancia|melao|mel[aã]o|uva|laranja|limao|lim[aã]o|abacaxi|manga|pera|morango|abacate|kiwi|tangerina|mexerica)\b/i },
  { cat: "Verduras", patterns: /\b(alface|rucula|rúcula|couve|espinafre|agriao|agri[aã]o|salsa|cebolinha|coentro)\b/i },
  { cat: "Legumes", patterns: /\b(tomate|cebola|alho|batata|cenoura|abobrinha|abóbora|abobora|chuchu|piment[aã]o|brocolis|brócolis|couve[- ]flor|berinjela|pepino)\b/i },
  { cat: "Higiene", patterns: /\b(sabonete|shampoo|condicionador|creme dental|pasta de dente|fio dental|desodorante|absorvente|papel hig|fralda)\b/i },
  { cat: "Limpeza", patterns: /\b(detergente|sab[aã]o|amaciante|alvejante|[aá]gua sanit[aá]ria|veja|cif|lustra|desinfetante|pano de ch[aã]o|esponja)\b/i },
  { cat: "Pet", patterns: /\b(ra[cç][aã]o|petisco pet|areia higi)\b/i },
  { cat: "Snacks", patterns: /\b(salgadinho|biscoito|bolacha|chips|pipoca|amendoim|chocolate|bombom|lacta|nestl[eé])\b/i },
  { cat: "Doces", patterns: /\b(doce|brigadeiro|sorvete|gelat[oó]|pudim|leite condensado|creme de leite)\b/i },
  { cat: "Congelados", patterns: /\b(congelado|hamburguer|hambúrguer|nuggets|pizza congelad|lasanha congelad)\b/i },
];

export function classifyItem(rawName: string): ConsumoCategory | null {
  if (!rawName) return null;
  const text = rawName.toLowerCase();
  for (const r of RULES) if (r.patterns.test(text)) return r.cat;
  return null;
}

export function normalizeName(rawName: string): string {
  const cat = classifyItem(rawName);
  if (cat) return cat;
  // fallback: primeira palavra significativa em Title Case
  const first = rawName.replace(/[^a-zA-ZÀ-ÿ ]/g, " ").trim().split(/\s+/)[0] ?? rawName;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

// Categoria geral da despesa (estabelecimento)
export function classifyMerchant(merchantName: string): string | null {
  const t = merchantName.toLowerCase();
  if (/\b(restaurante|lanchonete|burger|pizzaria|hamb|sushi|temaki|food)\b/.test(t)) return "Restaurantes";
  if (/\b(padaria|panific)\b/.test(t)) return "Padaria";
  if (/\b(farm[aá]cia|drogaria|drogasil|raia|paguemenos|pacheco)\b/.test(t)) return "Farmácia";
  if (/\b(posto|shell|ipiranga|petrobras|combust)\b/.test(t)) return "Combustível";
  if (/\b(mercado|supermerc|atacad[aã]o|carrefour|extra|p[aã]o de a[cç][uú]car|assa[ií])\b/.test(t)) return "Supermercado";
  return null;
}
