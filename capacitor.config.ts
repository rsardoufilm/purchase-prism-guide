import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.auraconsumo",
  appName: "AURA Consumo",
  webDir: "dist",
  server: {
    // Carrega o app publicado no webview (TanStack Start é SSR).
    // Para rodar offline/local, remova `url` e gere um build estático.
    url: "https://purchase-prism-guide.lovable.app",
    cleartext: false,
  },
  android: {
    backgroundColor: "#0F0F12",
  },
};

export default config;
