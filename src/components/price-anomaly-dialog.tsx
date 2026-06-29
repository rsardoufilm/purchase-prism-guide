import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";
import { brl } from "@/lib/format";
import type { PriceAnomaly } from "@/lib/price-anomaly";

interface Props {
  anomaly: PriceAnomaly | null;
  open: boolean;
  onConfirm: () => void;
  onCorrect: (newPrice: number) => void;
  onCancel: () => void;
}

/**
 * Modal de validação de preço fora do padrão.
 * Aparece quando o OCR (ou edição manual) traz um preço com variação >200% acima
 * da média histórica do produto para aquele usuário.
 */
export function PriceAnomalyDialog({ anomaly, open, onConfirm, onCorrect, onCancel }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  useEffect(() => {
    if (open && anomaly) {
      setEditing(false);
      setValue(String(anomaly.unitPrice ?? ""));
    }
  }, [open, anomaly]);

  if (!anomaly) return null;

  const handleCorrect = () => {
    const n = Number(value.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) return;
    onCorrect(n);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
    >
      <DialogContent className="rounded-3xl bg-card max-w-sm">
        <DialogHeader>
          <div className="size-12 rounded-2xl bg-primary-soft grid place-items-center text-primary mx-auto mb-1">
            <AlertTriangle className="size-6" />
          </div>
          <DialogTitle className="text-center text-lg">Variação incomum de preço</DialogTitle>
          <DialogDescription className="text-center text-sm text-muted-foreground">
            Encontramos uma variação incomum. O preço de{" "}
            <strong className="text-foreground">{anomaly.rawName}</strong> por{" "}
            <strong className="text-foreground">{brl(anomaly.unitPrice)}</strong> está correto?
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/50 rounded-2xl p-3 text-[11px] text-muted-foreground text-center">
          Média histórica: <strong className="text-foreground">{brl(anomaly.averagePrice)}</strong>{" "}
          ({anomaly.historyCount}{" "}
          {anomaly.historyCount === 1 ? "compra anterior" : "compras anteriores"})
        </div>

        {editing && (
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Valor correto (unitário)
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="rounded-xl"
              autoFocus
            />
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {!editing ? (
            <>
              <Button
                onClick={onConfirm}
                className="w-full h-11 rounded-2xl bg-primary text-primary-foreground font-semibold"
              >
                Sim, está correto
              </Button>
              <Button
                variant="outline"
                onClick={() => setEditing(true)}
                className="w-full h-11 rounded-2xl"
              >
                Corrigir valor
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={handleCorrect}
                className="w-full h-11 rounded-2xl bg-primary text-primary-foreground font-semibold"
              >
                Salvar valor corrigido
              </Button>
              <Button
                variant="outline"
                onClick={() => setEditing(false)}
                className="w-full h-11 rounded-2xl"
              >
                Voltar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
