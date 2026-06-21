import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";
import { LEGAL } from "@/lib/legal-info";

export const Route = createFileRoute("/legal/exclusao-conta")({
  component: ExclusaoContaPage,
  head: () => ({
    meta: [
      { title: "Exclusão de conta — AURA Finance" },
      {
        name: "description",
        content:
          "Como solicitar a exclusão da sua conta AURA Finance e dos dados pessoais associados.",
      },
    ],
  }),
});

function ExclusaoContaPage() {
  return (
    <LegalPage eyebrow="Privacidade" title="Política de Exclusão de Conta">
      <p>
        Esta página atende às exigências de transparência da Google Play Store e da Apple
        App Store: descreve, em linguagem clara, como solicitar a exclusão da sua conta no
        {" "}{LEGAL.appName} e quais dados são removidos ou retidos.
      </p>

      <h2>Como solicitar a exclusão</h2>
      <ul>
        <li>
          <strong>Pelo próprio app:</strong> entre na sua conta, abra{" "}
          <em>Ajustes</em> e use a opção <em>Excluir minha conta</em> (quando disponível na
          sua versão).
        </li>
        <li>
          <strong>Por e-mail:</strong> envie um pedido para{" "}
          <a href={`mailto:${LEGAL.contactEmail}?subject=Exclus%C3%A3o%20de%20conta%20AURA%20Finance`}>
            {LEGAL.contactEmail}
          </a>
          {" "}a partir do e-mail cadastrado, com o assunto “Exclusão de conta”. Confirmamos
          o recebimento e processamos o pedido em até 7 dias úteis.
        </li>
      </ul>

      <h2>Dados que serão excluídos</h2>
      <ul>
        <li>Perfil (nome, foto de avatar);</li>
        <li>Despesas, itens de compra e categorias;</li>
        <li>Contas recorrentes e assinaturas cadastradas;</li>
        <li>Arquivos enviados (imagens e PDFs de notas fiscais);</li>
        <li>Histórico de preços de produtos vinculados à sua conta;</li>
        <li>Credenciais de autenticação.</li>
      </ul>

      <h2>Dados que podem ser retidos</h2>
      <p>
        Por obrigação legal ou para defesa em eventual processo, podemos reter por prazos
        limitados:
      </p>
      <ul>
        <li>
          Registros de acesso ao sistema por 6 meses (art. 15 do Marco Civil da Internet —
          Lei nº 12.965/2014);
        </li>
        <li>
          Dados estritamente necessários para cumprimento de ordem judicial ou de
          autoridade competente.
        </li>
      </ul>

      <h2>Prazo</h2>
      <p>
        A exclusão é concluída em até 30 dias corridos após a confirmação do pedido,
        respeitados os prazos legais de retenção descritos acima.
      </p>

      <h2>Reversibilidade</h2>
      <p>
        A exclusão é definitiva. Após o processo, os dados não podem ser recuperados. Caso
        deseje voltar a usar o app no futuro, será necessário criar uma nova conta.
      </p>

      <h2>Dúvidas</h2>
      <p>
        Fale com{" "}
        <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a> — responsável pelo
        tratamento: {LEGAL.owner}, {LEGAL.ownerCity}.
      </p>
    </LegalPage>
  );
}
