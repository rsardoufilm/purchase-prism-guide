# Gerar APK do AURA Consumo

O projeto usa **TanStack Start (SSR)**, então o APK é um _wrapper_ nativo que carrega o app publicado em `https://purchase-prism-guide.lovable.app` via webview do Capacitor.

## Pré-requisitos

- Android Studio + Android SDK (API 34+)
- JDK 21
- Node 20+ ou Bun

## Passos (executar localmente, no seu Mac/PC)

### 1. Clonar o projeto do GitHub

Use o botão **GitHub → Connect** no Lovable para sincronizar e clonar o repo.

```bash
git clone <seu-repo>
cd <seu-repo>
bun install
```

### 2. Criar pasta `dist` mínima (placeholder, exigido pelo Capacitor)

```bash
mkdir -p dist && echo "<!DOCTYPE html><title>AURA</title>" > dist/index.html
```

### 3. Adicionar a plataforma Android

```bash
npx cap add android
npx cap sync android
```

### 4. Copiar ícones (opcional, recomendado)

Use os PNGs em `public/icon-512.png` para gerar os mipmaps em
`android/app/src/main/res/mipmap-*/ic_launcher.png` (Android Studio →
`File → New → Image Asset`).

### 5. Abrir no Android Studio

```bash
npx cap open android
```

### 6. Gerar APK

No Android Studio:

- **Build → Build Bundle(s)/APK(s) → Build APK(s)**
- APK gerado em `android/app/build/outputs/apk/debug/app-debug.apk`

Para APK assinado de produção:

- **Build → Generate Signed Bundle/APK → APK**
- Crie ou selecione uma keystore, escolha `release`.

## Atualizar o conteúdo do app

Como o webview carrega a URL publicada, basta **publicar uma nova versão no
Lovable** — não é preciso recompilar o APK.

## Versão totalmente offline (opcional, futura)

Requer migrar para SPA pura (sem SSR). Avise se quiser essa refatoração.
