import { useEffect, useRef, useState } from "react";
import { Camera, X, RotateCcw, Loader2, Check } from "lucide-react";
import { logFailure } from "@/lib/failure-log";

interface CameraCaptureProps {
  open: boolean;
  onCapture: (file: File) => void;
  onClose: () => void;
}

/**
 * Dicas curtas que rotacionam enquanto o usuário enquadra a nota.
 * Mantemos textos pequenos para não competir com o guia visual.
 */
const TIPS = [
  "Apoie a nota em uma superfície plana",
  "Evite sombras e reflexos",
  "Aproxime até preencher o quadro",
  "Mantenha o celular paralelo à nota",
  "Iluminação uniforme melhora a leitura",
] as const;

type FrameStatus = "searching" | "adjust" | "hold" | "ready";

const STATUS_LABEL: Record<FrameStatus, string> = {
  searching: "Posicione a nota dentro do quadro",
  adjust: "Aproxime ou centralize a nota",
  hold: "Segure firme…",
  ready: "Pronto! Capturando…",
};

const STATUS_COLOR: Record<FrameStatus, string> = {
  searching: "border-white/60",
  adjust: "border-amber-400",
  hold: "border-sky-400",
  ready: "border-emerald-400",
};

/**
 * Captura nativa via getUserMedia — força câmera traseira (facingMode:
 * "environment") e solicita permissão explicitamente na primeira vez.
 *
 * Inclui guia visual de enquadramento, dicas rotativas e uma detecção
 * leve de borda (variância/densidade de gradientes dentro do quadro)
 * que dispara auto-captura quando a nota fica estável por ~1,2 s.
 */
export function CameraCapture({ open, onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const stableSinceRef = useRef<number | null>(null);
  const capturedRef = useRef(false);

  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [shooting, setShooting] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [frameStatus, setFrameStatus] = useState<FrameStatus>("searching");
  const [autoCapture, setAutoCapture] = useState(true);

  // Rotaciona dicas a cada 3,5 s.
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setTipIndex((i) => (i + 1) % TIPS.length), 3500);
    return () => clearInterval(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function start() {
      setStatus("loading");
      setErrorMsg("");
      capturedRef.current = false;
      stableSinceRef.current = null;
      setFrameStatus("searching");

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
          /* alguns navegadores exigem gesto adicional */
        }
      }
      setStatus("ready");
    }

    start();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open]);

  // Loop de análise de borda — roda só quando o vídeo está pronto.
  useEffect(() => {
    if (status !== "ready") return;
    const video = videoRef.current;
    if (!video) return;

    if (!analysisCanvasRef.current) {
      analysisCanvasRef.current = document.createElement("canvas");
    }
    const canvas = analysisCanvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    // Resolução baixa: rápido e suficiente p/ detectar variação de borda.
    const SAMPLE_W = 80;
    const SAMPLE_H = 120;
    canvas.width = SAMPLE_W;
    canvas.height = SAMPLE_H;

    let lastRun = 0;

    const tick = (now: number) => {
      rafRef.current = requestAnimationFrame(tick);
      if (capturedRef.current) return;
      if (now - lastRun < 200) return; // ~5 fps de análise
      lastRun = now;
      if (video.videoWidth === 0) return;

      try {
        ctx.drawImage(video, 0, 0, SAMPLE_W, SAMPLE_H);
        const { data } = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H);

        // Região central (onde fica o guia ~ 80% w x 70% h)
        const x0 = Math.floor(SAMPLE_W * 0.1);
        const x1 = Math.floor(SAMPLE_W * 0.9);
        const y0 = Math.floor(SAMPLE_H * 0.15);
        const y1 = Math.floor(SAMPLE_H * 0.85);

        let sum = 0;
        let sumSq = 0;
        let edge = 0;
        let count = 0;
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const i = (y * SAMPLE_W + x) * 4;
            const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            sum += lum;
            sumSq += lum * lum;
            // gradiente horizontal simples (Sobel reduzido)
            if (x + 1 < x1) {
              const j = (y * SAMPLE_W + (x + 1)) * 4;
              const lum2 = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2];
              edge += Math.abs(lum - lum2);
            }
            count++;
          }
        }
        const mean = sum / count;
        const variance = sumSq / count - mean * mean;
        const edgeDensity = edge / count;

        // Heurísticas calibradas para nota fiscal (papel claro com texto):
        // - variance alta = há conteúdo (não é parede vazia)
        // - edgeDensity moderada/alta = bordas nítidas (foco ok)
        // - mean entre 60-220 = exposição razoável
        const hasContent = variance > 350 && edgeDensity > 6;
        const wellExposed = mean > 55 && mean < 225;
        const sharp = edgeDensity > 10;

        let next: FrameStatus;
        if (!hasContent || !wellExposed) {
          next = "searching";
        } else if (!sharp) {
          next = "adjust";
        } else {
          next = "hold";
        }

        setFrameStatus((prev) => (prev === "ready" ? prev : next));

        if (next === "hold") {
          if (stableSinceRef.current == null) stableSinceRef.current = now;
          else if (autoCapture && now - stableSinceRef.current > 1200 && !capturedRef.current) {
            capturedRef.current = true;
            setFrameStatus("ready");
            // pequena espera para feedback visual antes do disparo
            setTimeout(() => {
              void handleShoot();
            }, 150);
          }
        } else {
          stableSinceRef.current = null;
        }
      } catch {
        /* getImageData pode falhar se o vídeo ainda não decodificou */
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, autoCapture]);

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

  const borderColor = STATUS_COLOR[frameStatus];

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
        <button
          type="button"
          onClick={() => setAutoCapture((v) => !v)}
          className={`text-[11px] px-2.5 py-1 rounded-full border ${
            autoCapture ? "border-emerald-400/70 text-emerald-300" : "border-white/30 text-white/70"
          }`}
          aria-pressed={autoCapture}
          aria-label="Alternar captura automática"
        >
          Auto {autoCapture ? "on" : "off"}
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Guia de enquadramento: máscara escura + retângulo central com cantos */}
        {status === "ready" && (
          <div className="pointer-events-none absolute inset-0">
            {/* máscara escurecida ao redor do quadro (80% x 70%) */}
            <div className="absolute inset-0 bg-black/45" />
            <div
              className={`absolute left-[10%] right-[10%] top-[15%] bottom-[15%] rounded-2xl border-2 transition-colors duration-200 ${borderColor}`}
              style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)" }}
            >
              {/* cantos destacados */}
              <span className={`absolute -top-0.5 -left-0.5 w-6 h-6 border-t-4 border-l-4 rounded-tl-2xl ${borderColor}`} />
              <span className={`absolute -top-0.5 -right-0.5 w-6 h-6 border-t-4 border-r-4 rounded-tr-2xl ${borderColor}`} />
              <span className={`absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-4 border-l-4 rounded-bl-2xl ${borderColor}`} />
              <span className={`absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-4 border-r-4 rounded-br-2xl ${borderColor}`} />
            </div>

            {/* status flutuante no topo do quadro */}
            <div className="absolute left-1/2 -translate-x-1/2 top-[6%] flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 text-white text-xs backdrop-blur-sm">
              {frameStatus === "ready" ? (
                <Check className="size-3.5 text-emerald-400" />
              ) : (
                <span
                  className={`size-2 rounded-full ${
                    frameStatus === "hold"
                      ? "bg-sky-400 animate-pulse"
                      : frameStatus === "adjust"
                        ? "bg-amber-400"
                        : "bg-white/70"
                  }`}
                />
              )}
              <span>{STATUS_LABEL[frameStatus]}</span>
            </div>

            {/* dica rotativa abaixo do quadro */}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-[6%] max-w-[80%]">
              <p
                key={tipIndex}
                className="text-center text-[11px] text-white/90 bg-black/55 backdrop-blur-sm px-3 py-1.5 rounded-full animate-in fade-in duration-500"
              >
                💡 {TIPS[tipIndex]}
              </p>
            </div>
          </div>
        )}

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
                  onClick={onClose}
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
