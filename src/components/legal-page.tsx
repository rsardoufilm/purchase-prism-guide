import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { LEGAL } from "@/lib/legal-info";

interface Props {
  eyebrow: string;
  title: string;
  children: ReactNode;
}

/**
 * Layout público para páginas legais (Política de Privacidade, Termos de Uso, etc.).
 * Não exige autenticação — revisores de Google Play e Apple App Store precisam
 * acessar sem login.
 */
export function LegalPage({ eyebrow, title, children }: Props) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-3xl px-5 py-4 flex items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" /> Voltar
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-8">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {eyebrow}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">{title}</h1>
        <p className="mt-2 text-xs text-muted-foreground">
          Última atualização: {LEGAL.lastUpdate} · Mantido por {LEGAL.owner} ({LEGAL.ownerCity}).
        </p>

        <div className="mt-6 space-y-6 text-sm leading-relaxed text-foreground/90 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-6 [&_h2]:mb-2 [&_p]:text-foreground/80 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ul]:text-foreground/80 [&_a]:text-primary [&_a]:underline">
          {children}
        </div>

        <footer className="mt-10 pt-6 border-t border-border text-xs text-muted-foreground space-y-1">
          <p>
            Este documento é uma declaração do responsável pelo app ({LEGAL.owner}) e
            não constitui certificação independente.
          </p>
          <p>
            Dúvidas? Fale com <a href={`mailto:${LEGAL.contactEmail}`} className="text-primary underline">{LEGAL.contactEmail}</a>.
          </p>
        </footer>
      </main>
    </div>
  );
}
