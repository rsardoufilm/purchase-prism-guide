import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GitMerge } from "lucide-react";
import type { AliasCandidate } from "@/lib/product-aliases";

interface Props {
  candidate: AliasCandidate | null;
  open: boolean;
  /** Sim, é o mesmo produto — unificar sob `existingName`. */
  onSame: () => void;
  /** Não, são produtos diferentes — manter separados (não perguntar de novo). */
  onDifferent: () => void;
  /** Pular sem registrar resposta. */
  onSkip: () => void;
}

/**
 * Pergunta ao usuário se dois nomes parecidos devem ser tratados como
 * o mesmo produto. A resposta é persistida para que o sistema aprenda
 * e não pergunte de novo.
 */
export function ProductAliasDialog({
  candidate,
  open,
  onSame,
  onDifferent,
  onSkip,
}: Props) {
  if (!candidate) return null;

  const pct = Math.round(candidate.similarity * 100);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onSkip();
      }}
    >
      <DialogContent className="rounded-3xl bg-card max-w-sm">
        <DialogHeader>
          <div className="size-12 rounded-2xl bg-primary-soft grid place-items-center text-primary mx-auto mb-1">
            <GitMerge className="size-6" />
          </div>
          <DialogTitle className="text-center text-lg">
            É o mesmo produto?
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-muted-foreground">
            Encontramos um produto parecido no seu histórico ({pct}% de
            similaridade). Eles são o mesmo item?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="bg-muted/50 rounded-2xl p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
              Nesta nota
            </p>
            <p className="text-sm font-semibold text-foreground">
              {candidate.newName}
            </p>
          </div>
          <div className="bg-muted/50 rounded-2xl p-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
              Já existe no histórico
            </p>
            <p className="text-sm font-semibold text-foreground">
              {candidate.existingName}
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            onClick={onSame}
            className="w-full h-11 rounded-2xl bg-primary text-primary-foreground font-semibold"
          >
            Sim, é o mesmo
          </Button>
          <Button
            variant="outline"
            onClick={onDifferent}
            className="w-full h-11 rounded-2xl"
          >
            Não, são diferentes
          </Button>
          <Button
            variant="ghost"
            onClick={onSkip}
            className="w-full h-10 rounded-2xl text-xs text-muted-foreground"
          >
            Pular por agora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
