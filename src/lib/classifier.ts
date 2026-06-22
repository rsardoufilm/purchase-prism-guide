// ConsumoClassifier — normalização determinística pós-OCR.
// Mapeia descrições comerciais (raw_name) para categorias padronizadas.
// Extensível: basta adicionar novas entradas em RULES.

export type ConsumoCategory =
  // Produtos de mercado
  | "Arroz"
  | "Feijão"
  | "Carne Bovina"
  | "Frango"
  | "Suínos"
  | "Peixes"
  | "Frios"
  | "Queijos"
  | "Laticínios"
  | "Leite"
  | "Iogurtes"
  | "Pães"
  | "Massas"
  | "Óleos"
  | "Açúcar"
  | "Café"
  | "Bebidas"
  | "Refrigerantes"
  | "Cervejas"
  | "Águas"
  | "Frutas"
  | "Verduras"
  | "Legumes"
  | "Higiene"
  | "Limpeza"
  | "Pet"
  | "Snacks"
  | "Doces"
  | "Congelados"
  // Tipos de estabelecimento / serviço
  | "Padaria"
  | "Farmácia"
  | "Combustível"
  | "Restaurantes"
  | "Hortifrutti"
  | "Mercado"
  | "Bebidas"
  | "Vestuário"
  | "Eletrônicos"
  | "Casa"
  | "Transporte"
  | "Outros";

/** Tipo de estabelecimento inferido para a despesa como um todo. */
export type MerchantCategory =
  | "Restaurantes"
  | "Padaria"
  | "Hortifrutti"
  | "Mercado"
  | "Farmácia"
  | "Combustível"
  | "Supermercado"
  | "Bebidas"
  | "Vestuário"
  | "Eletrônicos"
  | "Casa e Higiene"
  | "Transporte"
  | "Outros";

export const MERCHANT_CATEGORY_OPTIONS: MerchantCategory[] = [
  "Restaurantes",
  "Padaria",
  "Hortifrutti",
  "Mercado",
  "Supermercado",
  "Farmácia",
  "Combustível",
  "Bebidas",
  "Vestuário",
  "Eletrônicos",
  "Casa e Higiene",
  "Transporte",
  "Outros",
];

type Rule = { cat: ConsumoCategory; patterns: RegExp };

// ─── Regras de ITEM (produto) ────────────────────────────────────────────────

// Ordem importa: regras mais específicas primeiro.
const ITEM_RULES: Rule[] = [
  // Alimentos básicos
  { cat: "Arroz", patterns: /\b(arroz|arrz)\b/i },
  { cat: "Feijão", patterns: /\b(feij[aã]o|feijao)\b/i },
  {
    cat: "Carne Bovina",
    patterns:
      /\b(patinho|alcatra|cox[aã]o|acem|fraldinha|picanha|m[uú]sculo|maminha|contra ?fil[eé]|file mignon|carne bovina|bovin[oa])\b/i,
  },
  {
    cat: "Frango",
    patterns: /\b(frango|peito de frango|coxa|sobrecoxa|asa de frango|file de frango)\b/i,
  },
  {
    cat: "Suínos",
    patterns: /\b(linguica|linguiça|bacon|lombo|pernil|costelinha|toucinho|salsicha)\b/i,
  },
  {
    cat: "Peixes",
    patterns: /\b(sardinha|atum|tilapia|tilápia|salm[aã]o|merluza|pescado|bacalhau)\b/i,
  },
  {
    cat: "Queijos",
    patterns: /\b(queijo|mussarela|muçarela|prato|minas|parmes[aã]o|provolone|requeij[aã]o)\b/i,
  },
  { cat: "Frios", patterns: /\b(presunto|peito de peru|mortadela|salame|apresuntado)\b/i },
  {
    cat: "Laticínios",
    patterns:
      /\b(latic[ií]nio|creme de leite|leite condensado|coalhada|creme de ricota|leite em p[oó]|leite fermentado|kefir|manteiga)\b/i,
  },
  { cat: "Leite", patterns: /\b(leite|itamb[eé]|italac|piracanjuba|parmalat|ninho)\b/i },
  { cat: "Iogurtes", patterns: /\b(iogurte|danone|activia|yopro|petit suisse|danoninho)\b/i },
  { cat: "Pães", patterns: /\b(p[aã]o|broa|bisnaga|baguete|rosca|pão de queijo|croissant)\b/i },
  { cat: "Massas", patterns: /\b(macarr[aã]o|espaguete|talharim|penne|lasanha|nhoque)\b/i },
  { cat: "Óleos", patterns: /\b([oó]leo|azeite|manteiga|margarina)\b/i },
  { cat: "Açúcar", patterns: /\b(a[cç][uú]car|adoçante|adocante)\b/i },
  { cat: "Café", patterns: /\b(caf[eé]|p[oó] de caf[eé]|3 cora[cç][oõ]es|melitta|pil[aã]o)\b/i },

  // Bebidas
  {
    cat: "Refrigerantes",
    patterns: /\b(coca[- ]?cola|guaran[aá]|fanta|sprite|pepsi|refrigerante|refri)\b/i,
  },
  {
    cat: "Cervejas",
    patterns: /\b(cerveja|skol|brahma|heineken|antarctica|amstel|stella|budweiser|corona)\b/i,
  },
  {
    cat: "Águas",
    patterns: /\b([aá]gua mineral|[aá]gua sem g[aá]s|[aá]gua com g[aá]s|crystal)\b/i,
  },
  {
    cat: "Bebidas",
    patterns:
      /\b(suco|n[eé]ctar|del valle|ades|vinho|whisky|vodka|energ[eé]tico|red bull|monster)\b/i,
  },

  // Frutas / Verduras / Legumes
  {
    cat: "Frutas",
    patterns:
      /\b(banana|ma[cç][aã]|mamao|mam[aã]o|melancia|melao|mel[aã]o|uva|laranja|limao|lim[aã]o|abacaxi|manga|pera|morango|abacate|kiwi|tangerina|mexerica|ameixa|goiaba|caju|acerola|pitanga)\b/i,
  },
  {
    cat: "Verduras",
    patterns:
      /\b(alface|rucula|rúcula|couve|espinafre|agriao|agri[aã]o|salsa|cebolinha|coentro|acelga|escarola|repolho)\b/i,
  },
  {
    cat: "Legumes",
    patterns:
      /\b(tomate|cebola|alho|batata|cenoura|abobrinha|abóbora|abobora|chuchu|piment[aã]o|brocolis|brócolis|couve[- ]flor|berinjela|pepino|mandioca|inhame|quiabo|vagem|ervilha|milho verde)\b/i,
  },

  // Higiene / Limpeza / Casa
  {
    cat: "Higiene",
    patterns:
      /\b(sabonete|shampoo|condicionador|creme dental|pasta de dente|fio dental|desodorante|absorvente|papel hig|fralda|escova dental|sabonete l[ií]quido|alcool gel)\b/i,
  },
  {
    cat: "Limpeza",
    patterns:
      /\b(detergente|sab[aã]o|amaciante|alvejante|[aá]gua sanit[aá]ria|veja|cif|lustra|desinfetante|pano de ch[aã]o|esponja|pano de prato|guardanapo|toalha de papel)\b/i,
  },
  {
    cat: "Casa",
    patterns:
      /\b(vela|pilha|l[aâ]mpada|extens[aã]o|lixeira|vassoura|rodo|saco de lixo|filamento|fita adesiva)\b/i,
  },

  // Pet / Snacks / Doces / Congelados
  {
    cat: "Pet",
    patterns:
      /\b(ra[cç][aã]o|petisco pet|areia higi|whiskas|pedigree|premier|golden|dog chow|cat chow)\b/i,
  },
  {
    cat: "Snacks",
    patterns:
      /\b(salgadinho|biscoito|bolacha|chips|pipoca|amendoim|chocolate|bombom|lacta|nestl[eé]|oreo|passatempo|recheado)\b/i,
  },
  {
    cat: "Doces",
    patterns:
      /\b(doce|brigadeiro|sorvete|gelat[oó]|pudim|leite condensado|creme de leite|goiabada|doce de leite|mousse|torta|bolo de)\b/i,
  },
  {
    cat: "Congelados",
    patterns:
      /\b(congelado|hamburguer|hambúrguer|nuggets|pizza congelad|lasanha congelad|pão de queijo congelad|batata congelad|peixe congelad)\b/i,
  },

  // PRATOS PRONTOS / RESTAURANTE (detecta itens típicos de nota de restaurante)
  {
    cat: "Restaurantes",
    patterns:
      /\b(prato|refei[cç][aã]o|executivo|self.service|marmita|marmitex|completo|combo|lanche|hamburguer artesanal|cheeseburger|x.burger|x.salada|x.bacon|pastel|esfiha|coxinha|kibe|salgado|risole|p[aã]o de queijo salgado|quentinho|buffet|quilo|por[cç][aã]o|porcao|entrada|sobremesa sobremesa|sushi|temaki|yakisoba|pizza (?:broto|m[eé]dia|grande)|calzone|esfirra|tapioca|crepe|panqueca|sopa|caldo)\b/i,
  },

  // PADARIA
  {
    cat: "Padaria",
    patterns:
      /\b(bolo de|pudim de|torta de|croissant|rosquinha|donut|muffin|cupcake|pão doce|p[aã]o de mel|pão de queijo de|sonho|bolinha de|carolina|brigadeiro de|beijinho|cajuzinho|trufa)\b/i,
  },

  // VESTUÁRIO
  {
    cat: "Vestuário",
    patterns:
      /\b(camisa|camiseta|calça|calca|bermuda|short|jaqueta|blusa|moletom|meia|cueca|sutiã|lingerie|sapato|tênis|chinelo|sandália|bone|boné|cinto)\b/i,
  },

  // ELETRÔNICOS
  {
    cat: "Eletrônicos",
    patterns:
      /\b(celular|fone|carregador|cabo usb|cabo hdmi|adaptador|pilha|bateria|mouse|teclado|pendrive|cart[aã]o de mem[oó]ria|protetor|screen|capinha)\b/i,
  },

  // TRANSPORTE
  {
    cat: "Transporte",
    patterns:
      /\b(corrida|uber|99pop|99 pop|taxi|táxi|transporte|passagem|pedágio|pedagio|estacionamento|estac|combust[íi]vel|gasolina|etanol|diesel|óleo lubrificante)\b/i,
  },
];

export function classifyItem(rawName: string): ConsumoCategory | null {
  if (!rawName) return null;
  const text = rawName.toLowerCase();
  for (const r of ITEM_RULES) if (r.patterns.test(text)) return r.cat;
  return null;
}

export function normalizeName(rawName: string): string {
  const cat = classifyItem(rawName);
  if (cat) return cat;
  // fallback: primeira palavra significativa em Title Case
  const first =
    rawName
      .replace(/[^a-zA-ZÀ-ÿ ]/g, " ")
      .trim()
      .split(/\s+/)[0] ?? rawName;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

// ─── Regras de ESTABELECIMENTO (merchant_name) ───────────────────────────────

interface MerchantRule {
  cat: MerchantCategory;
  patterns: RegExp;
}

const MERCHANT_RULES: MerchantRule[] = [
  {
    cat: "Restaurantes",
    patterns:
      /\b(restaurante|lanchonete|burger|pizzaria|hamb|sushi|temaki|food|churrascaria|bar e|bar do|bar da|comida|cozinha|gourmet|bistr[oô]|creperia|pastelaria|esfiharia|acai|açaí|caf[eé]teria|cafeteria|self.service|rodizio|rodízio|por.quilo|por kilo|buffet|delivery|ifood|pede\b)/i,
  },
  {
    cat: "Padaria",
    patterns:
      /\b(padaria|panificadora|forno|confeitaria|doçaria|pães e|pao e|fábrica de p[aã]o|fábrica de doces|doceira|bolos e)\b/i,
  },
  {
    cat: "Hortifrutti",
    patterns:
      /\b(hortifrutti|hortifruti|sacol[aã]o|quitanda|verduras e frutas|frutas e verduras|feira|feira livre|produtos naturais|org[aâ]nicos|organico)\b/i,
  },
  {
    cat: "Mercado",
    patterns:
      /\b(mercado|supermercado|mercadinho|atacad[aã]o|atacarejo|carrefour|walmart|extra|sonae|big|comper|condor|angeloni|sonda|fort|savegnago|tenda|pague menos|mercantil|bazar|armaz[eé]m)\b/i,
  },
  {
    cat: "Supermercado",
    patterns:
      /\b(p[aã]o de a[cç][uú]car|pão de açucar|assa[ií]|tamoio|lobão|lubrax|galmart|nacional)\b/i,
  },
  {
    cat: "Farmácia",
    patterns:
      /\b(farm[aá]cia|drogaria|drogasil|raia|pacheco|paguemenos| Extrafarma|santa cruz|a popular|farmacias)\b/i,
  },
  {
    cat: "Combustível",
    patterns:
      /\b(posto|shell|ipiranga|petrobras|combust|petro|br distribuidora|raizen|alesat|ale)\b/i,
  },
  {
    cat: "Bebidas",
    patterns:
      /\b(adega|distribuidora de bebidas|cervejaria|vinicola|vinícola|choperia|choperia|bar de|boteco|botequim|tabacaria|tabaqueria)\b/i,
  },
  {
    cat: "Vestuário",
    patterns:
      /\b(loja de roupa|moda|vestuário|calçados|sapataria|loja de|shopping|brech[oó]|bazar de|atelie|ateli[eê]|confec[cç][oõ]es)\b/i,
  },
  {
    cat: "Eletrônicos",
    patterns:
      /\b(informática|eletr[oô]nicos|celulares|acessórios de|games|game|loja de|assist[eê]ncia t[eé]cnica)\b/i,
  },
  {
    cat: "Casa e Higiene",
    patterns: /\b(utilidades|bazar|casa e|loja de|higiene|limpeza|drogaria de|perfumaria)\b/i,
  },
  {
    cat: "Transporte",
    patterns:
      /\b(uber|99|taxi|táxi|transporte|log[íi]stica|entrega|delivery moto|correios|sedex|pac)\b/i,
  },
];

export function classifyMerchant(merchantName: string): MerchantCategory | null {
  if (!merchantName) return null;
  const t = merchantName.toLowerCase();
  for (const r of MERCHANT_RULES) if (r.patterns.test(t)) return r.cat;
  return null;
}

// ─── Inferência por itens (fallback quando o merchant não é claro) ───────────

/** Heurística: se a nota tem itens típicos de restaurante, é Restaurante. */
export function inferExpenseCategory(
  items: Array<{ raw_name?: string; normalized_name?: string | null; category?: string | null }>,
  merchantName?: string,
): MerchantCategory {
  // 1. Tenta pelo nome do estabelecimento primeiro
  const merchantCat = classifyMerchant(merchantName ?? "");
  if (merchantCat) return merchantCat;

  if (!items || items.length === 0) return "Outros";

  const text = items
    .map((it) => `${it.raw_name ?? ""} ${it.normalized_name ?? ""} ${it.category ?? ""}`)
    .join(" ")
    .toLowerCase();

  // 2. Conta "votos" por categoria baseado nos itens
  const votes = new Map<MerchantCategory, number>();
  const addVote = (cat: MerchantCategory, weight = 1) =>
    votes.set(cat, (votes.get(cat) ?? 0) + weight);

  // Restaurante
  const restaurantSignals =
    /\b(prato|refei[cç][aã]o|executivo|self.service|marmita|marmitex|lanche|hamburguer|pastel|esfiha|coxinha|salgado|risole|kibe|quentinho|buffet|quilo|por[cç][aã]o|entrada|sobremesa|sushi|temaki|yakisoba|pizza|calzone|tapioca|crepe|panqueca|sopa|caldo|combo|completo|x\.salada|x\.bacon|x\.tudo|cheese|combo lanche)\b/g;
  let m;
  while ((m = restaurantSignals.exec(text)) !== null) addVote("Restaurantes");

  // Padaria
  const padariaSignals =
    /\b(p[aã]o|croissant|rosca|bolo|pudim|torta|sonho|beijinho|brigadeiro|carolina|trufa|p[aã]o de mel|p[aã]o doce|broa|rosquinha|donut|muffin|cupcake|bolinha|doce de)\b/g;
  while ((m = padariaSignals.exec(text)) !== null) addVote("Padaria");

  // Hortifrutti
  const hortiSignals =
    /\b(banana|ma[cç][aã]|mamao|mam[aã]o|melancia|melao|mel[aã]o|uva|laranja|limao|lim[aã]o|abacaxi|manga|pera|morango|abacate|kiwi|tangerina|mexerica|alface|rucula|couve|espinafre|tomate|cebola|alho|batata|cenoura|abobrinha|chuchu|piment[aã]o|brocolis|couve[- ]flor|berinjela|pepino|mandioca|inhame|vagem|ervilha|milho verde|goiaba|caju|ameixa|acerola|pitanga)\b/g;
  while ((m = hortiSignals.exec(text)) !== null) addVote("Hortifrutti");

  // Bebidas (somente bebidas alcoólicas/distribuidora — refrigerante/suco não conta)
  const bebidaSignals =
    /\b(cerveja|skol|brahma|heineken|antarctica|amstel|stella|budweiser|corona|vinho|whisky|vodka|cachaça|cachaca|gin|rum|tequila|absinto|champagne|espumante|sake|licor|conhaque|cervejaria|adega|distribuidora)\b/g;
  while ((m = bebidaSignals.exec(text)) !== null) addVote("Bebidas");

  // Farmácia
  const farmaciaSignals =
    /\b(rem[eé]dio|medicamento|gen[eé]rico|ibuprofeno|paracetamol|dipirona|aspirina|vitamina|antigripal|antibi[oó]tico|antial[eé]rgico|shampoo|condicionador|sabonete|creme dental|desodorante|absorvente|fralda)\b/g;
  while ((m = farmaciaSignals.exec(text)) !== null) addVote("Farmácia");

  // Combustível
  const combustivelSignals =
    /\b(gasolina|etanol|diesel|gas[óo]leo|gasoleo|aditivada|comum|premium|shell|ipiranga|posto|combust[ií]vel|óleo lubrificante|óleo para motor)\b/g;
  while ((m = combustivelSignals.exec(text)) !== null) addVote("Combustível");

  // Transporte
  const transporteSignals =
    /\b(corrida|uber|99pop|taxi|táxi|transporte|passagem|pedágio|estacionamento)\b/g;
  while ((m = transporteSignals.exec(text)) !== null) addVote("Transporte");

  // 3. Se a maioria clara dos itens são de mercado + padaria, é Mercado
  const mercadoCount =
    text.match(
      /\b(arroz|feij[aã]o|a[cç][uú]car|caf[eé]|macarr[aã]o|leite|iogurte|detergente|sab[aã]o|papel hig|arroz|azeite|manteiga|margarina|refrigerante|suco|biscoito|bolacha|chocolate)\b/g,
    )?.length ?? 0;
  if (mercadoCount > 3) addVote("Mercado", 2);

  // 4. Pega a categoria com mais votos
  let best: MerchantCategory = "Outros";
  let bestScore = 0;
  for (const [cat, score] of votes) {
    if (score > bestScore) {
      bestScore = score;
      best = cat;
    }
  }

  // Threshold mínimo para confiar na inferência
  if (bestScore >= 2) return best;
  return "Outros";
}
