import type { TourStep } from "@/components/tour-guide";

export const TOURS: Record<string, TourStep[]> = {
  dashboard: [
    {
      title: "Bem-vindo ao AURA Consumo",
      body: "Este é o seu painel. Aqui você vê em um relance quanto gastou no mês, suas categorias principais e o que vence em breve.",
    },
    {
      title: "Tudo começa pelo botão central (+)",
      body: "Na barra inferior, o botão azul abre o cadastro de uma nova despesa. Você pode escanear a nota com a câmera ou digitar à mão.",
    },
    {
      title: "Navegação rápida",
      body: "Use a barra inferior para alternar entre Dashboard, Despesas, Consumo e Chat IA. No avatar (canto superior direito) você acessa Configurações, Ajuda e ativa avisos.",
    },
  ],

  despesas: [
    {
      title: "Suas despesas em um só lugar",
      body: "Aqui ficam todos os lançamentos do período selecionado. Use o filtro de período no topo para ver dia, semana, mês ou ano.",
    },
    {
      title: "Assinaturas previstas",
      body: "A seção \"Assinaturas previstas\" projeta automaticamente os próximos lançamentos das suas assinaturas para os próximos 8 meses, ajudando no planejamento.",
    },
    {
      title: "Submenu Assinaturas",
      body: "Use o submenu no topo para alternar entre lançamentos avulsos e a lista de assinaturas cadastradas, onde você pode excluir as que cancelou.",
    },
  ],

  assinaturas: [
    {
      title: "Gerencie suas assinaturas",
      body: "Cadastre serviços recorrentes (Netflix, academia, streaming) com valor, frequência e próxima data de cobrança.",
    },
    {
      title: "Projeção de 8 meses",
      body: "O app projeta automaticamente os próximos lançamentos para você ter visibilidade do que vai pesar nos próximos meses, mesmo antes da cobrança real.",
    },
    {
      title: "Cancelou? Apague",
      body: "Cada assinatura tem um ícone de lixeira ao lado. Use-o se cadastrou errado ou se cancelou o serviço. As projeções futuras somem junto.",
    },
    {
      title: "Lembrete antes de vencer",
      body: "Você recebe notificação no sino do app quando faltam 3 dias ou menos para a próxima cobrança.",
    },
  ],

  recorrentes: [
    {
      title: "Contas que se repetem",
      body: "Cadastre aqui contas como luz, água, internet, condomínio. Diferente de assinaturas, o valor costuma variar a cada mês.",
    },
    {
      title: "Alertas automáticos",
      body: "Receba um lembrete quando a data de vencimento se aproximar, para nunca pagar juros por esquecimento.",
    },
  ],

  consumo: [
    {
      title: "O que você mais consome",
      body: "Veja os produtos que aparecem com mais frequência nas suas notas, preço médio e variação de preço entre estabelecimentos.",
    },
    {
      title: "Produtos agrupados",
      body: "Nomes parecidos (\"Coca 2L\" e \"Coca Cola 2 Litros\") são normalizados automaticamente para uma análise consolidada.",
    },
    {
      title: "Como é a ordenação",
      body: "\"Mais consumidos\" tem duas listas separadas: por peso (kg, com g convertido automaticamente) e por unidade (un, pct, cx). A ordem é sempre pela quantidade física acumulada — nunca pelo valor em R$, que aparece só como informação secundária.",
    },
    {
      title: "Insights de saúde",
      body: "O app destaca itens com alto teor de gordura saturada e açúcar, ajudando você a perceber padrões de consumo.",
    },
  ],

  "despesas-nova": [
    {
      title: "Como cadastrar uma despesa",
      body: "Você tem duas opções: escanear a nota fiscal pela câmera (OCR automático) ou preencher os campos manualmente.",
    },
    {
      title: "OCR de cupons fiscais",
      body: "Aponte a câmera para o cupom. O app extrai data, valor total, estabelecimento e itens. Você pode revisar e corrigir antes de salvar.",
    },
    {
      title: "Categorize sempre",
      body: "Escolher a categoria correta (alimentação, transporte, lazer…) é o que permite gerar análises por categoria no Dashboard e no Chat IA.",
    },
  ],

  chat: [
    {
      title: "Pergunte sobre seus gastos",
      body: "Pergunte em linguagem natural: \"quanto gastei com comida em outubro?\", \"qual mercado frequento mais?\", \"estou gastando mais que mês passado?\".",
    },
    {
      title: "Respostas baseadas nos seus dados",
      body: "A IA usa apenas seus lançamentos reais. Se a informação não estiver registrada, ela avisa em vez de inventar.",
    },
  ],

  configuracoes: [
    {
      title: "Personalize sua conta",
      body: "Atualize nome de exibição, foto e preferências de notificação. Suas alterações se aplicam imediatamente.",
    },
    {
      title: "Notificações granulares",
      body: "Escolha quais tipos de aviso quer receber: vencimentos, resumos diários/semanais ou alertas de consumo.",
    },
    {
      title: "Privacidade",
      body: "Seus dados são isolados por usuário no banco (RLS). Nenhum outro usuário consegue acessar suas notas ou despesas.",
    },
  ],
};
