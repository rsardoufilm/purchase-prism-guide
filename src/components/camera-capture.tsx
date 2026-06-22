import { useEffect, useRef, useState } from "react";
import { Camera, X, RotateCcw, Loader2 } from "lucide-react";
import { logFailure } from "@/lib/failure-log";

interface CameraCaptureProps {
  open: boolean;
  onCapture: (file: File) => void;
  onClose: () => void;
}

/**
 * Captura nativa via getUserMedia — força câmera traseira (facingMode:
 * "environment") e solicita permissão explicitamente na primeira vez.
 * Substitui o <input capture="environment">, que no Android costuma
 * abrir a galeria quando a permissão ainda não foi concedida.
 */
export function CameraCapture({ open, onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [shooting, setShooting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function start() {
      setStatus("loading");
      setErrorMsg("");

      if (typeof window === "undefined" || !window.isSecureContext) {
        setStatus("error");
        setErrorMsg("Câmera requer HTTPS. Abra o app pelo link publicado.");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("error");
        setErrorMsg("Este navegador não suporta câmera. Use 'Enviar arquivo'.");
        return;
      }

      // Tenta primeiro com "exact" (força traseira); se falhar, cai para "ideal".
      const constraintsAttempts: MediaStreamConstraints[] = [
        { video: { facingMode: { exact: "environment" } }, audio: false },
        { video: { facingMode: { ideal: "environment" } }, audio: false },
        { video: true, audio: false },
      ];

      let stream: MediaStream | null = null;
      let lastErr: unknown = null;
      for (const c of constraintsAttempts) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(c);
          break;
        } catch (e) {
          lastErr = e;
        }
      }

      if (cancelled) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }

      if (!stream) {
        const err = lastErr as DOMException | undefined;
        const name = err?.name ?? "Error";
        let msg = err?.message ?? "Não foi possível acessar a câmera.";
        if (name === "NotAllowedError" || name === "SecurityError") {
          msg = "Permissão negada. Habilite a câmera nas configurações do navegador.";
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          msg = "Nenhuma câmera traseira disponível neste dispositivo.";
        }
        logFailure("camera_open", msg, { name });
        setStatus("error");
        setErrorMsg(msg);
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch {
          /* alguns navegadores exigem gesto adicional, mas o stream já está pronto */
        }
      }
      setStatus("ready");
    }

    start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open]);

  const handleShoot = async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    setShooting(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas sem contexto 2D.");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92),
      );
      if (!blob) throw new Error("Falha ao gerar imagem.");
      const file = new File([blob], `nota-${Date.now()}.jpg`, { type: "image/jpeg" });
      onCapture(file);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao capturar foto.";
      logFailure("camera_shoot", msg);
      setErrorMsg(msg);
      setStatus("error");
    } finally {
      setShooting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar câmera"
          className="size-10 grid place-items-center rounded-full bg-white/10 hover:bg-white/20"
        >
          <X className="size-5" />
        </button>
        <p className="text-sm font-medium">Escanear nota</p>
        <div className="size-10" aria-hidden />
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="absolute inset-0 w-full h-full object-cover"
        />

        {status === "loading" && (
          <div className="absolute inset-0 grid place-items-center text-white/80">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="size-6 animate-spin" />
              <p className="text-sm">Solicitando permissão da câmera…</p>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <div className="bg-card text-card-foreground rounded-2xl p-5 max-w-sm space-y-3">
              <p className="text-sm font-semibold">Câmera indisponível</p>
              <p className="text-xs text-muted-foreground">{errorMsg}</p>
              <div className="flex gap-2 justify-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setStatus("idle");
                    setTimeout(() => setStatus("loading"), 0);
                    // re-trigger effect by closing/reopening would be cleaner;
                    // aqui forçamos uma nova tentativa.
                    const event = new Event("retry");
                    window.dispatchEvent(event);
                    // simples: feche e o usuário reabre.
                    onClose();
                  }}
                  className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-muted"
                >
                  <RotateCcw className="size-3.5 inline mr-1" />
                  Fechar e tentar novamente
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="pb-8 pt-4 grid place-items-center bg-black">
        <button
          type="button"
          onClick={handleShoot}
          disabled={status !== "ready" || shooting}
          aria-label="Capturar foto"
          className="size-16 rounded-full bg-white grid place-items-center disabled:opacity-40 active:scale-95 transition-transform ring-4 ring-white/30"
        >
          {shooting ? (
            <Loader2 className="size-6 animate-spin text-black" />
          ) : (
            <Camera className="size-7 text-black" />
          )}
        </button>
      </div>
    </div>
  );
}
