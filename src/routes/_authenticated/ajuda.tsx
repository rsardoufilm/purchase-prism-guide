import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Receipt, ShoppingBasket, CreditCard, Bell, MessageCircle, Settings } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ajuda")({
  component: AjudaPage,
  head: () => ({ meta: [{ title: "Ajuda — AURA Consumo" }] }),
});

interface Section {
  id: string;
  icon: typeof Receipt;
  title: string;
  items: Array<{ q: string; a: string }>;
}

const SECTIONS: Section[] = [
  {
    id: "despesas",
    icon: Receipt,
    title: "Despesas",
    items: [
      {
        q: "Como registrar uma nova despesa?",
        a: "Toque no botão central (+) na barra inferior. Você pode escanear uma nota fiscal pela câmera ou digitar os dados manualmente.",
      },
      {
        q: "O OCR reconhece todas as notas?",
        a: "Reconhecemos a maioria dos cupons fiscais brasileiros. Caso algum campo venha errado, você pode editar antes de salvar.",
      },
      {
        q: "Posso anexar a foto da nota?",
        a: "Sim. A imagem fica armazenada com segurança e você pode consultá-la depois.",
      },
    ],
  },
  {
    id: "consumo",
    icon: ShoppingBasket,
    title: "Consumo & Produtos",
    items: [
      {
        q: "Como ver o que mais consumo?",
        a: "Acesse Consumo e Produtos para ver itens recorrentes, preços médios e variação de gastos por categoria.",
      },
      {
        q: "Por que alguns produtos são agrupados?",
        a: "Nomes parecidos (ex: 'Coca 2L' e 'Coca Cola 2 Litros') são normalizados para mostrar uma análise consolidada.",
      },
    ],
  },
  {
    id: "assinaturas",
    icon: CreditCard,
    title: "Assinaturas & Recorrentes",
    items: [
      {
        q: "Qual a diferença entre assinatura e recorrente?",
        a: "Assinatura é um serviço fixo (Netflix, academia). Recorrente é uma conta que se repete (luz, água, internet). Os dois ajudam o app a prever seus gastos mensais.",
      },
      {
        q: "Recebo alerta antes de vencer?",
        a: "Sim. Você recebe uma notificação no sino do app quando faltam 3 dias ou menos.",
      },
    ],
  },
  {
    id: "notificacoes",
    icon: Bell,
    title: "Notificações",
    items: [
      {
        q: "Que tipos de notificação existem?",
        a: "Lembretes de assinaturas e contas a vencer, resumo diário e semanal de gastos e alertas de consumo de alimentos com alto teor de gordura saturada.",
      },
      {
        q: "Como ativar?",
        a: "Toque no avatar no canto superior direito e ative o interruptor de Notificações. O navegador pedirá permissão.",
      },
      {
        q: "Posso desativar a qualquer momento?",
        a: "Sim, no mesmo lugar. Você também pode marcar notificações como lidas no sino.",
      },
    ],
  },
  {
    id: "chat",
    icon: MessageCircle,
    title: "Pergunte à IA",
    items: [
      {
        q: "Que perguntas posso fazer?",
        a: "Qualquer coisa sobre seus gastos: 'quanto gastei com comida em outubro?', 'qual mercado mais frequento?', 'estou gastando mais que o mês passado?'.",
      },
      {
        q: "A IA inventa respostas?",
        a: "Não. Ela responde apenas com base nos seus dados reais. Se a informação não estiver registrada, ela diz.",
      },
    ],
  },
  {
    id: "ajustes",
    icon: Settings,
    title: "Conta & Ajustes",
    items: [
      {
        q: "Como mudar meu nome ou foto?",
        a: "Vá em Configurações. Você pode atualizar o nome de exibição e o avatar.",
      },
      {
        q: "Meus dados ficam protegidos?",
        a: "Sim. Cada usuário só vê seus próprios dados (RLS no banco). Suas notas e despesas não são compartilhadas.",
      },
    ],
  },
];

function AjudaPage() {
  return (
    <>
      <PageHeader eyebrow="Suporte" title="Central de ajuda" />
      <main>
        <p className="text-sm text-muted-foreground mb-6">
          Respostas rápidas para as dúvidas mais comuns. Não achou o que procurava?{" "}
          <Link to="/configuracoes" className="text-primary font-medium underline">
            Vá para Configurações
          </Link>
          .
        </p>

        <div className="space-y-6">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <section key={s.id} aria-labelledby={`sec-${s.id}`}>
                <h2
                  id={`sec-${s.id}`}
                  className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2"
                >
                  <Icon className="size-4 text-primary" aria-hidden />
                  {s.title}
                </h2>
                <Accordion
                  type="single"
                  collapsible
                  className="bg-card border border-border rounded-2xl px-4"
                >
                  {s.items.map((it, idx) => (
                    <AccordionItem
                      key={idx}
                      value={`${s.id}-${idx}`}
                      className="border-b last:border-b-0"
                    >
                      <AccordionTrigger className="text-sm font-medium text-left hover:no-underline">
                        {it.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground">
                        {it.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </section>
            );
          })}
        </div>

        <div className="mt-8 p-4 bg-primary-soft border border-primary/20 rounded-2xl text-center">
          <p className="text-sm font-semibold">Precisa de mais ajuda?</p>
          <p className="text-xs text-muted-foreground mt-1">
            Envie sua dúvida em{" "}
            <Link to="/configuracoes" className="text-primary underline">
              Configurações
            </Link>
            .
          </p>
        </div>
      </main>
    </>
  );
}
