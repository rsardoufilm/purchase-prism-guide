import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { TourGuide } from "@/components/tour-guide";
import { TOURS } from "@/lib/tours";
import { PeriodFilter } from "@/components/period-filter";
import { periodRange, type PeriodKey } from "@/lib/period";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/format";
import { askAura } from "@/lib/chat.functions";
import { Sparkles, TrendingUp, TrendingDown, Store, Loader2, Send, Tag, ArrowUp, ArrowDown, Scale } from "lucide-react";
import { toast } from "sonner";
import { useSharedPeriod } from "@/hooks/use-shared-period";

export const Route = createFileRoute("/_authenticated/insights")({
  component: Insights,
  head: () => ({ meta: [{ title: "Insights — AURA Consumo" }] }),
});

interface E {
  id: string;
  merchant_name: string;
  total_amount: number;
  category: string | null;
  expense_date: string;
}
interface I {
  normalized_name: string | null;
  raw_name: string;
  total_price: number;
  category: string | null;
  expense_id: string;
}
interface P {
  normalized_name: string;
  merchant_name: string;
  unit_price: number;
  quantity: number | null;
  unit: string | null;
  purchase_date: string;
}
interface Msg {
  role: "user" | "aura";
  text: string;
}

const SUGGESTIONS = [
  "Quanto gastei este mês?",
  "Qual minha categoria que mais consome?",
  "Onde eu pago mais caro pelo arroz?",
  "Onde posso economizar?",
];

function isoDate(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : null;
}

function Insights() {
  const [period, setPeriod] = useSharedPeriod();

  const [allExpenses, setAllExpenses] = useState<E[]>([]);
  const [allItems, setAllItems] = useState<I[]>([]);
  const [prices, setPrices] = useState<P[]>([]);

  useEffect(() => {
    const load = () => {
      supabase
        .from("expenses")
        .select("id,merchant_name,total_amount,category,expense_date")
        .then(({ data }) => setAllExpenses((data ?? []) as E[]));
      supabase
        .from("expense_items")
        .select("normalized_name,raw_name,total_price,category,expense_id")
        .then(({ data }) => setAllItems((data ?? []) as I[]));
      supabase
        .from("product_prices")
        .select("normalized_name,merchant_name,unit_price,quantity,unit,purchase_date")
        .order("purchase_date", { ascending: true })
        .then(({ data }) => setPrices((data ?? []) as P[]));
    };
    load();
    window.addEventListener("aura:data-changed", load);
    return () => window.removeEventListener("aura:data-changed", load);
  }, []);

  // Filtra por período (expenses + items vinculados)
  const { expenses, items } = useMemo(() => {
    const { start, end } = periodRange(period);
    const s = isoDate(start);
    const e = isoDate(end);
    const filteredExp = allExpenses.filter((r) => {
      if (s && r.expense_date < s) return false;
      if (e && r.expense_date > e) return false;
      return true;
    });
    const ids = new Set(filteredExp.map((x) => x.id));
    const filteredItems = allItems.filter((it) => ids.has(it.expense_id));
    return { expenses: filteredExp, items: filteredItems };
  }, [allExpenses, allItems, period]);

  const generalInsights = useMemo(() => {
    const out: { icon: React.ReactNode; title: string; desc: string }[] = [];
    if (expenses.length === 0) {
      return [
        {
          icon: <Sparkles className="size-5" />,
          title: "Comece a registrar",
          desc: "Adicione suas primeiras notas fiscais para que a AURA descubra padrões e oportunidades de economia.",
        },
      ];
    }
    const byCat = new Map<string, number>();
    for (const r of expenses) {
      const k = r.category || "Sem categoria";
      byCat.set(k, (byCat.get(k) ?? 0) + Number(r.total_amount));
    }
    const top = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top)
      out.push({
        icon: <Sparkles className="size-5" />,
        title: `${top[0]} é sua maior categoria`,
        desc: `${brl(top[1])} no total registrado.`,
      });

    const byStore = new Map<string, { sum: number; count: number }>();
    for (const r of expenses) {
      const v = byStore.get(r.merchant_name) ?? { sum: 0, count: 0 };
      v.sum += Number(r.total_amount);
      v.count++;
      byStore.set(r.merchant_name, v);
    }
    const stores = [...byStore.entries()]
      .filter(([_, v]) => v.count >= 2)
      .map(([n, v]) => ({ n, avg: v.sum / v.count }))
      .sort((a, b) => a.avg - b.avg);
    if (stores.length >= 1)
      out.push({
        icon: <Store className="size-5" />,
        title: `${stores[0].n} é seu estabelecimento mais barato`,
        desc: `Ticket médio de ${brl(stores[0].avg)}.`,
      });
    if (stores.length >= 2) {
      const exp = stores[stores.length - 1];
      out.push({
        icon: <TrendingUp className="size-5" />,
        title: `${exp.n} tem o ticket médio mais alto`,
        desc: `Cada visita custa em média ${brl(exp.avg)}.`,
      });
    }

    const prodPrices = new Map<string, P[]>();
    for (const p of prices) {
      const arr = prodPrices.get(p.normalized_name) ?? [];
      arr.push(p);
      prodPrices.set(p.normalized_name, arr);
    }
    let biggestSwing: {
      name: string;
      min: number;
      max: number;
      minStore: string;
      maxStore: string;
    } | null = null;
    let priceUp: { name: string; first: number; last: number; pct: number } | null = null;
    for (const [name, arr] of prodPrices) {
      if (arr.length < 2) continue;
      const sorted = [...arr].sort((a, b) => Number(a.unit_price) - Number(b.unit_price));
      const min = sorted[0];
      const max = sorted[sorted.length - 1];
      if (
        !biggestSwing ||
        Number(max.unit_price) - Number(min.unit_price) > biggestSwing.max - biggestSwing.min
      ) {
        biggestSwing = {
          name,
          min: Number(min.unit_price),
          max: Number(max.unit_price),
          minStore: min.merchant_name,
          maxStore: max.merchant_name,
        };
      }
      const byDate = [...arr].sort((a, b) => a.purchase_date.localeCompare(b.purchase_date));
      const first = Number(byDate[0].unit_price);
      const last = Number(byDate[byDate.length - 1].unit_price);
      if (first > 0 && last > first) {
        const pct = ((last - first) / first) * 100;
        if (!priceUp || pct > priceUp.pct) priceUp = { name, first, last, pct };
      }
    }
    if (biggestSwing) {
      const pct = ((biggestSwing.max - biggestSwing.min) / biggestSwing.min) * 100;
      out.push({
        icon: <TrendingDown className="size-5" />,
        title: `${biggestSwing.name} varia ${pct.toFixed(0)}% entre lojas`,
        desc: `${brl(biggestSwing.min)} em ${biggestSwing.minStore} vs ${brl(biggestSwing.max)} em ${biggestSwing.maxStore}.`,
      });
    }
    if (priceUp)
      out.push({
        icon: <TrendingUp className="size-5" />,
        title: `${priceUp.name} subiu ${priceUp.pct.toFixed(0)}%`,
        desc: `De ${brl(priceUp.first)} para ${brl(priceUp.last)} no histórico.`,
      });
    return out;
  }, [expenses, prices]);

  // Insights por categoria
  const categoryInsights = useMemo(() => {
    const expByCat = new Map<
      string,
      { total: number; count: number; merchants: Map<string, number> }
    >();
    for (const r of expenses) {
      const k = r.category || "Sem categoria";
      const v = expByCat.get(k) ?? { total: 0, count: 0, merchants: new Map() };
      v.total += Number(r.total_amount);
      v.count += 1;
      v.merchants.set(
        r.merchant_name,
        (v.merchants.get(r.merchant_name) ?? 0) + Number(r.total_amount),
      );
      expByCat.set(k, v);
    }

    // Top produto por categoria de produto
    const itemsByCat = new Map<string, Map<string, number>>();
    for (const it of items) {
      const k = it.category || "Outros";
      const prodMap = itemsByCat.get(k) ?? new Map<string, number>();
      const name = it.normalized_name || it.raw_name;
      prodMap.set(name, (prodMap.get(name) ?? 0) + Number(it.total_price ?? 0));
      itemsByCat.set(k, prodMap);
    }

    const all: Array<{
      category: string;
      total: number;
      count: number;
      topMerchant?: [string, number];
      topProduct?: [string, number];
    }> = [];
    for (const [cat, v] of expByCat) {
      const topMerchant = [...v.merchants.entries()].sort((a, b) => b[1] - a[1])[0];
      const prods = itemsByCat.get(cat);
      const topProduct = prods ? [...prods.entries()].sort((a, b) => b[1] - a[1])[0] : undefined;
      all.push({ category: cat, total: v.total, count: v.count, topMerchant, topProduct });
    }
    return all.sort((a, b) => b.total - a.total);
  }, [expenses, items]);

  // Comparativo de mercados — INTELIGENTE
  //
  // Princípios:
  //  1. Compara só o MESMO produto (mesmo normalized_name) em ≥ 2 mercados.
  //  2. Usa "preço por unidade base" (R$/kg, R$/L ou R$/un) para que
  //     embalagens diferentes (500g x 1kg, 1L x 350ml) não distorçam.
  //  3. Só compara linhas que compartilham a mesma unidade base —
  //     misturar "por kg" com "por unidade" é maçãs com laranjas.
  //  4. Exibe a média do produto e quanto cada extremo se desvia dela.
  const marketCompare = useMemo(() => {
    // Converte (unit, quantity, unit_price) em (basePrice, baseUnit).
    // unit_price na base é o "preço por unidade de embalagem" (ex.: por kg quando vendido a kg).
    // Quando a unidade é g/ml, convertemos para kg/L para padronizar.
    const toBase = (
      unitPrice: number,
      qtyRaw: number | null,
      unitRaw: string | null,
    ): { basePrice: number; baseUnit: "kg" | "L" | "un" } | null => {
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) return null;
      const u = (unitRaw ?? "").trim().toLowerCase();
      const qty = Number(qtyRaw);
      // Casos vendidos a granel — unit_price JÁ é por kg/L.
      if (u === "kg" || u === "quilo" || u === "kilo") return { basePrice: unitPrice, baseUnit: "kg" };
      if (u === "l" || u === "lt" || u === "litro") return { basePrice: unitPrice, baseUnit: "L" };
      // Embalagens em gramas/ml: extrapola para a unidade base padrão.
      if ((u === "g" || u === "grama") && Number.isFinite(qty) && qty > 0) {
        return { basePrice: (unitPrice * 1000) / qty, baseUnit: "kg" };
      }
      if ((u === "ml" || u === "mililitro") && Number.isFinite(qty) && qty > 0) {
        return { basePrice: (unitPrice * 1000) / qty, baseUnit: "L" };
      }
      // Por unidade (un, pct, cx, etc.): mantém preço da embalagem.
      return { basePrice: unitPrice, baseUnit: "un" };
    };

    // produto → unidade base → mercado → { sum, n } (média de preço/unidade base).
    type Agg = { sum: number; n: number };
    const byProduct = new Map<string, Map<"kg" | "L" | "un", Map<string, Agg>>>();
    for (const p of prices) {
      if (!p.normalized_name || !p.merchant_name) continue;
      const base = toBase(Number(p.unit_price), p.quantity, p.unit);
      if (!base) continue;
      const byUnit = byProduct.get(p.normalized_name) ?? new Map();
      const byStore = byUnit.get(base.baseUnit) ?? new Map<string, Agg>();
      const cur = byStore.get(p.merchant_name) ?? { sum: 0, n: 0 };
      cur.sum += base.basePrice;
      cur.n += 1;
      byStore.set(p.merchant_name, cur);
      byUnit.set(base.baseUnit, byStore);
      byProduct.set(p.normalized_name, byUnit);
    }

    const rows: Array<{
      product: string;
      baseUnit: "kg" | "L" | "un";
      cheapestStore: string;
      cheapestPrice: number; // por base unit
      priciestStore: string;
      priciestPrice: number;
      avgPrice: number; // média entre mercados
      diffPct: number; // (max-min)/min * 100
      savingsPct: number; // economia vs média se sempre comprar no mais barato
      stores: number;
    }> = [];

    for (const [product, byUnit] of byProduct) {
      for (const [baseUnit, byStore] of byUnit) {
        // Precisa de pelo menos 2 mercados COM A MESMA unidade base.
        if (byStore.size < 2) continue;
        const avgs = [...byStore.entries()]
          .map(([store, v]) => ({ store, avg: v.sum / v.n }))
          .sort((a, b) => a.avg - b.avg);
        const min = avgs[0];
        const max = avgs[avgs.length - 1];
        if (min.avg <= 0) continue;
        const meanOfMeans = avgs.reduce((s, x) => s + x.avg, 0) / avgs.length;
        rows.push({
          product,
          baseUnit,
          cheapestStore: min.store,
          cheapestPrice: min.avg,
          priciestStore: max.store,
          priciestPrice: max.avg,
          avgPrice: meanOfMeans,
          diffPct: ((max.avg - min.avg) / min.avg) * 100,
          savingsPct: meanOfMeans > 0 ? ((meanOfMeans - min.avg) / meanOfMeans) * 100 : 0,
          stores: byStore.size,
        });
      }
    }

    // Ordena por % de diferença DECRESCENTE — destaca as maiores oportunidades.
    return rows.sort((a, b) => b.diffPct - a.diffPct);
  }, [prices]);

  /** Formata "R$ 12,90/kg" — sempre mostra a unidade base do comparativo. */
  const brlPerUnit = (value: number, unit: "kg" | "L" | "un") =>
    `${brl(value)}/${unit}`;

  // Chat
  const ask = useServerFn(askAura);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

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
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Insights" title="Sua inteligência" tourKey="chat" />
      <TourGuide tourKey="chat" steps={TOURS.chat} />

      <div className="mb-4">
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>

      <section className="mb-5 space-y-3">
        {generalInsights.map((ins, i) => (
          <div
            key={i}
            className="bg-card border border-border rounded-3xl p-4 sm:p-5 grid grid-cols-[auto_minmax(0,1fr)] gap-3 sm:gap-4"
          >
            <div className="size-10 sm:size-11 shrink-0 rounded-2xl bg-primary-soft text-primary grid place-items-center">
              {ins.icon}
            </div>
            <div className="min-w-0">
              <p className="font-display font-semibold text-sm sm:text-base text-balance">
                {ins.title}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 text-pretty">
                {ins.desc}
              </p>
            </div>
          </div>
        ))}
      </section>

      {categoryInsights.length > 0 && (
        <section className="mb-5">
          <h2 className="font-display font-semibold text-sm mb-2 flex items-center gap-2">
            <Tag className="size-4 text-primary" /> Por categoria
          </h2>
          <div className="space-y-2">
            {categoryInsights.slice(0, 8).map((c) => (
              <div key={c.category} className="bg-card border border-border rounded-2xl p-3 sm:p-4">
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <p className="text-sm font-semibold truncate">{c.category}</p>
                  <p className="text-sm font-bold whitespace-nowrap">{brl(c.total)}</p>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {c.count} {c.count === 1 ? "despesa" : "despesas"}
                  {c.topMerchant ? ` • Mais usado: ${c.topMerchant[0]}` : ""}
                </p>
                {c.topProduct && (
                  <p className="text-[11px] text-muted-foreground">
                    Produto top:{" "}
                    <span className="text-foreground font-medium">{c.topProduct[0]}</span> (
                    {brl(c.topProduct[1])})
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-5">
        <h2 className="font-display font-semibold text-sm mb-2 flex items-center gap-2">
          <Scale className="size-4 text-primary" /> Comparativo de mercados
        </h2>
        {marketCompare.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 text-center">
            <p className="text-sm text-muted-foreground text-pretty">
              Compre o mesmo produto em mais de um mercado para ver comparativos aqui.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {marketCompare.slice(0, 12).map((row) => (
              <div
                key={row.product}
                className="bg-card border border-border rounded-2xl p-3 sm:p-4"
              >
                <div className="flex items-baseline justify-between gap-2 mb-2">
                  <p className="text-sm font-semibold truncate">{row.product}</p>
                  <span className="text-xs font-bold whitespace-nowrap px-2 py-0.5 rounded-full bg-primary-soft text-primary">
                    {row.diffPct.toFixed(0)}% de diferença
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <ArrowDown className="size-4 text-emerald-600 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase tracking-wide text-emerald-700 font-semibold">
                        Mais barato
                      </p>
                      <p className="text-xs font-medium truncate text-emerald-900">
                        {row.cheapestStore}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-emerald-700 whitespace-nowrap">
                      {brl(row.cheapestPrice)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
                    <ArrowUp className="size-4 text-red-600 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase tracking-wide text-red-700 font-semibold">
                        Mais caro
                      </p>
                      <p className="text-xs font-medium truncate text-red-900">
                        {row.priciestStore}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-red-700 whitespace-nowrap">
                      {brl(row.priciestPrice)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>



      <section className="mb-3">
        <h2 className="font-display font-semibold text-sm mb-2 flex items-center gap-2">
          <Sparkles className="size-4 text-primary" /> Pergunte ao AURA Consumo
        </h2>

        {msgs.length === 0 && (
          <div className="grid gap-2 mb-3">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="text-left text-sm bg-card hover:bg-muted border border-border rounded-2xl px-4 py-3 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-3 mb-3">
          {msgs.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2.5 max-w-[85%] text-sm"
                    : "bg-card border border-border rounded-2xl rounded-bl-md px-4 py-2.5 max-w-[90%] text-sm whitespace-pre-wrap"
                }
              >
                {m.text}
              </div>
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
          onSubmit={(e) => {
            e.preventDefault();
            send(q);
          }}
          className="sticky bottom-24 md:bottom-4 bg-background/80 backdrop-blur-xl flex gap-2"
        >
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pergunte ao AURA Consumo…"
            className="h-12 rounded-2xl"
            disabled={busy}
          />
          <Button
            type="submit"
            disabled={busy || !q.trim()}
            className="h-12 px-4 rounded-2xl bg-primary text-primary-foreground"
          >
            <Send className="size-4" />
          </Button>
        </form>
      </section>
    </>
  );
}
