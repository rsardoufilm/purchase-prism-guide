import { useEffect, useRef, useState } from "react";
import { Camera, X, RotateCcw, Loader2, Check, Zap, ZapOff, Sun, Moon } from "lucide-react";
import { logFailure } from "@/lib/failure-log";

/**
 * Detecta iOS (Safari/Chrome no iPhone/iPad). iOS expõe MUITO POUCO
 * controle de exposição/ISO via getCapabilities — não adianta tentar
 * `exposureCompensation`/`brightness`. Compensamos via pós-processamento
 * + flash da câmera (`torch`) quando disponível.
 */
function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
}

/**
 * Ajusta a câmera para o melhor equilíbrio de luz. Por padrão NÃO força
 * super-exposição (a regra anterior estourava a imagem em ambientes
 * normais). O modo "low-light" amplifica os ganhos sob demanda.
 */
async function tuneTrack(track: MediaStreamTrack, lowLight: boolean) {
  const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & {
    exposureMode?: string[];
    exposureCompensation?: { min: number; max: number; step: number };
    whiteBalanceMode?: string[];
    focusMode?: string[];
    brightness?: { min: number; max: number };
    contrast?: { min: number; max: number };
  };

  const tryApply = async (c: MediaTrackConstraints) => {
    try {
      await track.applyConstraints(c);
    } catch {
      /* capability não suportada */
    }
  };

  if (caps.exposureMode?.includes("continuous")) {
    await tryApply({ advanced: [{ exposureMode: "continuous" } as never] });
  }
  if (caps.whiteBalanceMode?.includes("continuous")) {
    await tryApply({ advanced: [{ whiteBalanceMode: "continuous" } as never] });
  }
  if (caps.focusMode?.includes("continuous")) {
    await tryApply({ advanced: [{ focusMode: "continuous" } as never] });
  }
  if (caps.exposureCompensation) {
    // Padrão: neutro (0). Low-light: +1.3 stops (sem estourar).
    const target = lowLight ? Math.min(caps.exposureCompensation.max, 1.3) : 0;
    await tryApply({ advanced: [{ exposureCompensation: target } as never] });
  }
  if (caps.brightness) {
    const ratio = lowLight ? 0.65 : 0.5;
    const target = caps.brightness.min + (caps.brightness.max - caps.brightness.min) * ratio;
    await tryApply({ advanced: [{ brightness: target } as never] });
  }
  if (caps.contrast) {
    const target = caps.contrast.min + (caps.contrast.max - caps.contrast.min) * 0.5;
    await tryApply({ advanced: [{ contrast: target } as never] });
  }
}

/** Esticamento de histograma + gamma. Só roda quando a foto está
 *  subexposta — evita estourar fotos já bem iluminadas. */
function brightenCanvasIfDark(ctx: CanvasRenderingContext2D, w: number, h: number) {
  try {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    let min = 255;
    let max = 0;
    let sum = 0;
    let n = 0;
    const step = 40;
    for (let i = 0; i < d.length; i += step * 4) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      if (lum < min) min = lum;
      if (lum > max) max = lum;
      sum += lum;
      n++;
    }
    const mean = sum / Math.max(1, n);
    // Imagem já bem exposta? Não mexe.
    if (mean > 130) return;

    const range = Math.max(40, max - min);
    // gamma adaptativo: mais agressivo quanto mais escura a cena.
    const gamma = mean < 70 ? 0.7 : mean < 100 ? 0.8 : 0.9;
    const lut = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) {
      const norm = Math.min(1, Math.max(0, (v - min) / range));
      lut[v] = Math.round(Math.pow(norm, gamma) * 255);
    }
    for (let i = 0; i < d.length; i += 4) {
      d[i] = lut[d[i]];
      d[i + 1] = lut[d[i + 1]];
      d[i + 2] = lut[d[i + 2]];
    }
    ctx.putImageData(img, 0, 0);
  } catch {
    /* segue sem ajuste */
  }
}

interface CameraCaptureProps {
  open: boolean;
  onCapture: (file: File) => void;
  onClose: () => void;
}

const TIPS = [
  "Apoie a nota em uma superfície plana",
  "Evite sombras e reflexos",
  "Aproxime até preencher o quadro",
  "Mantenha o celular paralelo à nota",
  "Iluminação uniforme melhora a leitura",
] as const;

type FrameStatus = "searching" | "adjust" | "dark" | "bright" | "hold" | "ready";

const STATUS_LABEL: Record<FrameStatus, string> = {
  searching: "Posicione a nota dentro do quadro",
  adjust: "Imagem borrada — segure firme e aguarde o foco",
  dark: "Pouca luz — ative o modo noturno ou a lanterna",
  bright: "Muita luz — afaste a fonte de luz ou reduza o brilho",
  hold: "Segure firme…",
  ready: "Pronto! Capturando…",
};

const STATUS_COLOR: Record<FrameStatus, string> = {
  searching: "border-white/60",
  adjust: "border-amber-400",
  dark: "border-indigo-400",
  bright: "border-orange-400",
  hold: "border-sky-400",
  ready: "border-emerald-400",
};

export function CameraCapture({ open, onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const stableSinceRef = useRef<number | null>(null);
  const capturedRef = useRef(false);
  const lowLightRef = useRef(false);

  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [shooting, setShooting] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [frameStatus, setFrameStatus] = useState<FrameStatus>("searching");
  const [autoCapture, setAutoCapture] = useState(true);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [lowLight, setLowLight] = useState(false);
  const [exposure, setExposure] = useState<number>(128); // luminância média 0-255
  const ios = useRef(isIOS());

  lowLightRef.current = lowLight;

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

      const hiRes = {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 },
      };
      const constraintsAttempts: MediaStreamConstraints[] = [
        { video: { facingMode: { exact: "environment" }, ...hiRes }, audio: false },
        { video: { facingMode: { ideal: "environment" }, ...hiRes }, audio: false },
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

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        await tuneTrack(videoTrack, lowLightRef.current);
        const caps = (videoTrack.getCapabilities?.() ?? {}) as MediaTrackCapabilities & {
          torch?: boolean;
        };
        setTorchAvailable(Boolean(caps.torch));
      }

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

  // Reaplica constraints quando o usuário troca modo noturno.
  useEffect(() => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (track && status === "ready") {
      void tuneTrack(track, lowLight);
    }
  }, [lowLight, status]);

  // Loop de análise: foco, exposição e auto-disparo.
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

    const SAMPLE_W = 80;
    const SAMPLE_H = 120;
    canvas.width = SAMPLE_W;
    canvas.height = SAMPLE_H;

    let lastRun = 0;

    const tick = (now: number) => {
      rafRef.current = requestAnimationFrame(tick);
      if (capturedRef.current) return;
      if (now - lastRun < 200) return;
      lastRun = now;
      if (video.videoWidth === 0) return;

      try {
        ctx.drawImage(video, 0, 0, SAMPLE_W, SAMPLE_H);
        const { data } = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H);

        const x0 = Math.floor(SAMPLE_W * 0.1);
        const x1 = Math.floor(SAMPLE_W * 0.9);
        const y0 = Math.floor(SAMPLE_H * 0.15);
        const y1 = Math.floor(SAMPLE_H * 0.85);

        let sum = 0;
        let sumSq = 0;
        let edgeAbs = 0;
        let edgeSq = 0;
        let count = 0;
        let edgeCount = 0;
        let bright = 0; // pixels > 245 (estouro)
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const i = (y * SAMPLE_W + x) * 4;
            const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            sum += lum;
            sumSq += lum * lum;
            if (lum > 245) bright++;
            if (x + 1 < x1) {
              const j = (y * SAMPLE_W + (x + 1)) * 4;
              const l2 = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2];
              const d = lum - l2;
              edgeAbs += Math.abs(d);
              edgeSq += d * d;
              edgeCount++;
            }
            if (y + 1 < y1) {
              const k = ((y + 1) * SAMPLE_W + x) * 4;
              const l3 = 0.299 * data[k] + 0.587 * data[k + 1] + 0.114 * data[k + 2];
              const d = lum - l3;
              edgeAbs += Math.abs(d);
              edgeSq += d * d;
              edgeCount++;
            }
            count++;
          }
        }
        const mean = sum / count;
        const variance = sumSq / count - mean * mean;
        const edgeDensity = edgeAbs / Math.max(1, edgeCount);
        const focusScore = edgeSq / Math.max(1, edgeCount);
        const blownRatio = bright / count;

        setExposure(Math.round(mean));

        // iOS costuma entregar imagem ~10% mais escura no preview;
        // afrouxamos o limiar mínimo nele.
        const minLum = ios.current ? 32 : 45;
        const maxLum = 225;

        const hasContent = variance > 220 && edgeDensity > 3.5;
        const tooDark = mean < minLum;
        const tooBright = mean > maxLum || blownRatio > 0.18;
        const sharp = focusScore > 95 && edgeDensity > 7;

        let next: FrameStatus;
        if (tooBright) next = "bright";
        else if (tooDark) next = "dark";
        else if (!hasContent) next = "searching";
        else if (!sharp) next = "adjust";
        else next = "hold";

        setFrameStatus((prev) => (prev === "ready" ? prev : next));

        if (next === "hold") {
          if (stableSinceRef.current == null) stableSinceRef.current = now;
          else if (autoCapture && now - stableSinceRef.current > 1200 && !capturedRef.current) {
            capturedRef.current = true;
            setFrameStatus("ready");
            setTimeout(() => {
              void handleShoot();
            }, 150);
          }
        } else {
          stableSinceRef.current = null;
        }
      } catch {
        /* getImageData pode falhar até o vídeo decodificar */
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
      // Só clareia se a foto estiver subexposta — assim não estoura cenas
      // já bem iluminadas (problema relatado: "luz muito clara").
      brightenCanvasIfDark(ctx, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.95),
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

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as never] });
      setTorchOn(next);
    } catch {
      setTorchAvailable(false);
    }
  };

  if (!open) return null;

  const borderColor = STATUS_COLOR[frameStatus];
  // Filtro CSS apenas em modo noturno (evita preview sempre estourado).
  const videoFilter = lowLight
    ? "brightness(1.18) contrast(1.1) saturate(1.05)"
    : "brightness(1.0) contrast(1.02)";

  // barra de exposição (0 = escuro, 1 = estourado)
  const exposureRatio = Math.min(1, Math.max(0, exposure / 255));
  const exposureColor =
    exposure < 45 ? "bg-indigo-400" : exposure > 225 ? "bg-orange-400" : "bg-emerald-400";

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
        <div className="flex items-center gap-2">
          {torchAvailable && (
            <button
              type="button"
              onClick={toggleTorch}
              className={`size-9 grid place-items-center rounded-full border ${
                torchOn
                  ? "bg-amber-300 text-black border-amber-200"
                  : "border-white/30 text-white/80"
              }`}
              aria-pressed={torchOn}
              aria-label="Alternar lanterna"
            >
              {torchOn ? <Zap className="size-4" /> : <ZapOff className="size-4" />}
            </button>
          )}
          <button
            type="button"
            onClick={() => setLowLight((v) => !v)}
            className={`size-9 grid place-items-center rounded-full border ${
              lowLight
                ? "bg-indigo-400 text-black border-indigo-200"
                : "border-white/30 text-white/80"
            }`}
            aria-pressed={lowLight}
            aria-label="Modo baixa luz"
            title={lowLight ? "Modo noturno ativo" : "Ativar modo noturno"}
          >
            {lowLight ? <Moon className="size-4" /> : <Sun className="size-4" />}
          </button>
          <button
            type="button"
            onClick={() => setAutoCapture((v) => !v)}
            className={`text-[11px] px-2.5 py-1 rounded-full border ${
              autoCapture
                ? "border-emerald-400/70 text-emerald-300"
                : "border-white/30 text-white/70"
            }`}
            aria-pressed={autoCapture}
            aria-label="Alternar captura automática"
          >
            Auto {autoCapture ? "on" : "off"}
          </button>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: videoFilter }}
        />

        {status === "ready" && (
          <div className="pointer-events-none absolute inset-0">
            <div
              className={`absolute left-[6%] right-[6%] top-[12%] bottom-[12%] rounded-2xl border-2 transition-colors duration-200 ${borderColor}`}
            >
              <span
                className={`absolute -top-0.5 -left-0.5 w-6 h-6 border-t-4 border-l-4 rounded-tl-2xl ${borderColor}`}
              />
              <span
                className={`absolute -top-0.5 -right-0.5 w-6 h-6 border-t-4 border-r-4 rounded-tr-2xl ${borderColor}`}
              />
              <span
                className={`absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-4 border-l-4 rounded-bl-2xl ${borderColor}`}
              />
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-4 border-r-4 rounded-br-2xl ${borderColor}`}
              />
            </div>

            <div className="absolute left-1/2 -translate-x-1/2 top-[6%] flex flex-col items-center gap-1.5">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 text-white text-xs backdrop-blur-sm">
                {frameStatus === "ready" ? (
                  <Check className="size-3.5 text-emerald-400" />
                ) : (
                  <span
                    className={`size-2 rounded-full ${
                      frameStatus === "hold"
                        ? "bg-sky-400 animate-pulse"
                        : frameStatus === "adjust"
                          ? "bg-amber-400"
                          : frameStatus === "dark"
                            ? "bg-indigo-400"
                            : frameStatus === "bright"
                              ? "bg-orange-400"
                              : "bg-white/70"
                    }`}
                  />
                )}
                <span>{STATUS_LABEL[frameStatus]}</span>
              </div>

              {/* barra de exposição */}
              <div className="w-40 h-1 rounded-full bg-white/20 overflow-hidden">
                <div
                  className={`h-full ${exposureColor} transition-all duration-200`}
                  style={{ width: `${exposureRatio * 100}%` }}
                />
              </div>
            </div>

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
