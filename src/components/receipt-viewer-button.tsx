import { useState } from "react";
import { Receipt, Loader2, X, AlertTriangle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";

interface ReceiptViewerButtonProps {
  storagePath: string;
  merchantName?: string;
}

type ErrorKind = "not_found" | "forbidden" | "network" | "unknown";

function classifyError(err: unknown): { kind: ErrorKind; message: string } {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const lower = raw.toLowerCase();
  if (lower.includes("not found") || lower.includes("404") || lower.includes("object")) {
    return {
      kind: "not_found",
      message: "Nota não encontrada no armazenamento. O arquivo pode ter sido removido.",
    };
  }
  if (lower.includes("permission") || lower.includes("denied") || lower.includes("unauthorized") || lower.includes("403")) {
    return {
      kind: "forbidden",
      message: "Sem permissão para visualizar esta nota.",
    };
  }
  if (lower.includes("network") || lower.includes("failed to fetch") || lower.includes("timeout")) {
    return {
      kind: "network",
      message: "Falha de conexão. Verifique sua internet e tente novamente.",
    };
  }
  return { kind: "unknown", message: raw || "Não foi possível abrir a nota." };
}

/**
 * Botão discreto para abrir a nota original em um lightbox.
 * Gera uma URL assinada temporária (60s) do bucket privado `receipts`.
 */
export function ReceiptViewerButton({ storagePath, merchantName }: ReceiptViewerButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [error, setError] = useState<{ kind: ErrorKind; message: string } | null>(null);

  const fetchSignedUrl = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: sbError } = await supabase.storage
        .from("receipts")
        .createSignedUrl(storagePath, 60);
      if (sbError) throw sbError;
      if (!data?.signedUrl) throw new Error("URL vazia retornada pelo servidor.");
      setUrl(data.signedUrl);
      setIsPdf(storagePath.toLowerCase().endsWith(".pdf"));
      return true;
    } catch (err) {
      const info = classifyError(err);
      setError(info);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = async () => {
    const ok = await fetchSignedUrl();
    if (ok) {
      setOpen(true);
    } else if (error) {
      toast.error(error.message);
    } else {
      // erro foi setado dentro do fetch; abre modal para mostrar detalhe + retry
      setOpen(true);
    }
  };

  const handleImageError = () => {
    setError({
      kind: "not_found",
      message: "Imagem indisponível. A URL pode ter expirado — clique em recarregar.",
    });
    setUrl(null);
  };


  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={loading}
        className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded"
        aria-label="Ver nota original"
      >
        {loading ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <Receipt className="size-3" />
        )}
        <span>Ver nota original</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-background">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border">
            <p className="text-xs font-semibold truncate">
              {merchantName ? `Nota — ${merchantName}` : "Nota original"}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar"
              className="size-7 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="bg-muted/30 max-h-[80vh] overflow-auto grid place-items-center">
            {url && (isPdf ? (
              <iframe
                src={url}
                title="Nota original"
                className="w-full h-[80vh] bg-white"
              />
            ) : (
              <img
                src={url}
                alt="Nota original"
                className="max-w-full max-h-[80vh] object-contain"
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
