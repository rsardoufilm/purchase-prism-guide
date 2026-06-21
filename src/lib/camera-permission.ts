// Solicita permissão de câmera antes de abrir o seletor nativo.
// Em iOS Safari e Android Chrome, o input file[capture] funciona sem
// getUserMedia, mas pedir explicitamente melhora a UX em PWAs e expõe
// erros claros (NotAllowedError, NotFoundError) para o diário de falhas.

import { logFailure } from "./failure-log";

export type CameraPermissionResult =
  | { ok: true }
  | { ok: false; reason: "denied" | "unavailable" | "insecure" | "unknown"; message: string };

export async function requestCameraPermission(): Promise<CameraPermissionResult> {
  if (typeof window === "undefined") {
    return { ok: false, reason: "unavailable", message: "Ambiente sem janela." };
  }
  if (!window.isSecureContext) {
    const msg = "Câmera requer HTTPS. Abra o app pelo link publicado.";
    logFailure("camera_permission", msg);
    return { ok: false, reason: "insecure", message: msg };
  }
  const md = navigator.mediaDevices;
  if (!md || typeof md.getUserMedia !== "function") {
    // Sem mediaDevices: ainda assim o input[capture] costuma funcionar.
    return { ok: true };
  }
  try {
    const stream = await md.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
    // Liberar imediatamente — só queríamos disparar o prompt nativo.
    stream.getTracks().forEach((t) => t.stop());
    return { ok: true };
  } catch (e) {
    const err = e as DOMException;
    const name = err?.name ?? "Error";
    if (name === "NotAllowedError" || name === "SecurityError") {
      const msg = "Permissão de câmera negada. Habilite nas configurações do navegador.";
      logFailure("camera_permission", msg, { name });
      return { ok: false, reason: "denied", message: msg };
    }
    if (name === "NotFoundError" || name === "OverconstrainedError") {
      const msg = "Nenhuma câmera disponível neste dispositivo.";
      logFailure("camera_permission", msg, { name });
      return { ok: false, reason: "unavailable", message: msg };
    }
    const msg = err?.message || "Falha ao acessar a câmera.";
    logFailure("camera_permission", msg, { name });
    return { ok: false, reason: "unknown", message: msg };
  }
}
