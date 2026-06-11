export const brl = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number.isFinite(value) ? value : 0,
  );

export const brlCompact = (value: number) => {
  const v = Number.isFinite(value) ? value : 0;
  if (Math.abs(v) >= 1000) {
    return `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
  }
  return brl(v);
};

export const fmtDate = (date: string | Date) =>
  new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

export const fmtDateTime = (date: string | Date) =>
  new Date(date).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export const paymentLabel: Record<string, string> = {
  pix: "PIX",
  credito: "Crédito",
  debito: "Débito",
  dinheiro: "Dinheiro",
  vale_alimentacao: "Vale Alimentação",
  vale_refeicao: "Vale Refeição",
  outros: "Outros",
};
