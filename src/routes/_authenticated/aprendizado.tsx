import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sparkles, Trash2, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  loadUserCategoryMap,
  clearLearnedItem,
  relabelLearnedItem,
  type UserCategoryMap,
} from "@/lib/user-classifier";
import {
  loadUserExpenseCategoryMap,
  clearLearnedExpense,
  relabelLearnedExpense,
  type UserExpenseCategoryMap,
} from "@/lib/user-classifier-expense";
import { MERCHANT_CATEGORY_OPTIONS } from "@/lib/classifier";

export const Route = createFileRoute("/_authenticated/aprendizado")({
  component: AprendizadoPage,
  head: () => ({
    meta: [{ title: "Aprendizado — AURA Consumo" }],
  }),
});

const ITEM_CATEGORIES = [
  "Arroz", "Feijão", "Carne Bovina", "Frango", "Suínos", "Peixes",
  "Frios", "Queijos", "Laticínios", "Leite", "Iogurtes", "Pães", "Massas",
  "Óleos", "Açúcar", "Café", "Bebidas", "Refrigerantes", "Cervejas", "Águas",
  "Frutas", "Verduras", "Legumes", "Higiene", "Limpeza", "Pet",
  "Snacks", "Doces", "Congelados", "Outros",
];

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
}

type Row = {
  key: string;
  label: string;
  category: string;
  count: number;
  lastSeen: string;
};

function AprendizadoPage() {
  const [itemMap, setItemMap] = useState<UserCategoryMap>({
    byRaw: new Map(),
    byToken: new Map(),
  });
  const [expMap, setExpMap] = useState<UserExpenseCategoryMap>({ byMerchant: new Map() });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [tick, setTick] = useState(0);

  const [editing, setEditing] = useState<
    | { kind: "item" | "expense"; key: string; label: string; current: string; newCat: string }
    | null
  >(null);
  const [removing, setRemoving] = useState<
    | { kind: "item" | "expense"; key: string; label: string }
    | null
  >(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    Promise.all([loadUserCategoryMap(), loadUserExpenseCategoryMap()]).then(([im, em]) => {
      if (cancel) return;
      setItemMap(im);
      setExpMap(em);
      setLoading(false);
    });
    return () => {
      cancel = true;
    };
  }, [tick]);

  const itemRows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const [key, e] of itemMap.byRaw) {
      out.push({ key, label: e.sample, category: e.category, count: e.count, lastSeen: e.lastSeen });
    }
    out.sort((a, b) => b.count - a.count || (b.lastSeen > a.lastSeen ? 1 : -1));
    return out;
  }, [itemMap]);

  const expRows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const [key, e] of expMap.byMerchant) {
      out.push({ key, label: e.sample, category: e.category, count: e.count, lastSeen: e.lastSeen });
    }
    out.sort((a, b) => b.count - a.count || (b.lastSeen > a.lastSeen ? 1 : -1));
    return out;
  }, [expMap]);

  const filter = (rows: Row[]) => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.label.toLowerCase().includes(q) || r.category.toLowerCase().includes(q),
    );
  };

  const handleClear = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      const n =
        removing.kind === "item"
          ? await clearLearnedItem(removing.key)
          : await clearLearnedExpense(removing.key);
      toast.success(`Aprendizado removido (${n} ${n === 1 ? "registro" : "registros"}).`);
      setRemoving(null);
      setTick((t) => t + 1);
    } catch {
      toast.error("Falha ao remover.");
    } finally {
      setBusy(false);
    }
  };

  const handleRelabel = async () => {
    if (!editing || !editing.newCat || editing.newCat === editing.current) {
      setEditing(null);
      return;
    }
    setBusy(true);
    try {
      const n =
        editing.kind === "item"
          ? await relabelLearnedItem(editing.key, editing.newCat)
          : await relabelLearnedExpense(editing.key, editing.newCat);
      toast.success(`Reatribuído em ${n} ${n === 1 ? "registro" : "registros"}.`);
      setEditing(null);
      setTick((t) => t + 1);
    } catch {
      toast.error("Falha ao reatribuir.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Aprendizado"
        title="Mapeamentos do seu histórico"
      />
      <p className="text-xs text-muted-foreground mb-3">
        O AURA aprende com suas categorizações. Edite ou remova associações para refinar as sugestões automáticas.
      </p>

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar produto, estabelecimento ou categoria…"
        className="rounded-xl mb-3"
      />

      <Tabs defaultValue="items">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="items">Produtos ({itemRows.length})</TabsTrigger>
          <TabsTrigger value="expenses">Estabelecimentos ({expRows.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="mt-3">
          {loading ? (
            <SkeletonList />
          ) : (
            <RowsList
              rows={filter(itemRows)}
              emptyText="Nenhum aprendizado registrado ainda. Categorize itens em suas despesas para começar."
              onEdit={(r) =>
                setEditing({
                  kind: "item",
                  key: r.key,
                  label: r.label,
                  current: r.category,
                  newCat: r.category,
                })
              }
              onRemove={(r) => setRemoving({ kind: "item", key: r.key, label: r.label })}
            />
          )}
        </TabsContent>

        <TabsContent value="expenses" className="mt-3">
          {loading ? (
            <SkeletonList />
          ) : (
            <RowsList
              rows={filter(expRows)}
              emptyText="Nenhum estabelecimento aprendido ainda."
              onEdit={(r) =>
                setEditing({
                  kind: "expense",
                  key: r.key,
                  label: r.label,
                  current: r.category,
                  newCat: r.category,
                })
              }
              onRemove={(r) => setRemoving({ kind: "expense", key: r.key, label: r.label })}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Editar */}
      <AlertDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reatribuir categoria</AlertDialogTitle>
            <AlertDialogDescription>
              Atualizar todos os registros de <strong>{editing?.label}</strong> para a nova categoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {editing && (
            <Select
              value={editing.newCat}
              onValueChange={(v) => setEditing({ ...editing, newCat: v })}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(editing.kind === "item" ? ITEM_CATEGORIES : MERCHANT_CATEGORY_OPTIONS).map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRelabel} disabled={busy}>
              {busy && <Loader2 className="size-4 mr-2 animate-spin" />}
              Reatribuir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remover */}
      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover aprendizado</AlertDialogTitle>
            <AlertDialogDescription>
              A categoria dos registros de <strong>{removing?.label}</strong> será apagada. Você poderá categorizá-los novamente, ensinando o AURA do zero.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleClear} disabled={busy}>
              {busy && <Loader2 className="size-4 mr-2 animate-spin" />}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function RowsList({
  rows,
  emptyText,
  onEdit,
  onRemove,
}: {
  rows: Row[];
  emptyText: string;
  onEdit: (r: Row) => void;
  onRemove: (r: Row) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 text-center">
        <Sparkles className="size-6 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div
          key={r.key}
          className="bg-card border border-border rounded-2xl p-3 flex items-center gap-3"
        >
          <div className="size-9 shrink-0 rounded-xl bg-primary-soft text-primary grid place-items-center">
            <Sparkles className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate capitalize">{r.label}</p>
            <p className="text-[10px] text-muted-foreground">
              <span className="text-primary font-semibold">{r.category}</span> · {r.count}x · última {fmtDate(r.lastSeen)}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            onClick={() => onEdit(r)}
            aria-label="Reatribuir"
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive"
            onClick={() => onRemove(r)}
            aria-label="Remover"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="bg-card border border-border rounded-2xl p-3 h-16 animate-pulse" />
      ))}
    </div>
  );
}
