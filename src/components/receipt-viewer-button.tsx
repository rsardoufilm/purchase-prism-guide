import { useState } from "react";
import { Receipt, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";

interface ReceiptViewerButtonProps {
  storagePath: string;
  merchantName?: string;
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

  const handleOpen = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from("receipts")
        .createSignedUrl(storagePath, 60);
      if (error || !data?.signedUrl) throw error ?? new Error("Falha ao gerar URL");
      setUrl(data.signedUrl);
      setIsPdf(storagePath.toLowerCase().endsWith(".pdf"));
      setOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível abrir a nota.");
    } finally {
      setLoading(false);
    }
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
