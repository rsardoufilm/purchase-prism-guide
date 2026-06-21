import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";
import { LEGAL } from "@/lib/legal-info";

export const Route = createFileRoute("/legal/privacidade")({
  component: PrivacidadePage,
  head: () => ({
    meta: [
      { title: "Política de Privacidade — AURA Finance" },
      {
        name: "description",
        content:
          "Como o AURA Finance coleta, usa e protege seus dados pessoais, em conformidade com a LGPD.",
      },
    ],
  }),
});

function PrivacidadePage() {
  return (
    <LegalPage eyebrow="Aviso legal" title="Política de Privacidade">
      <p>
        Esta Política de Privacidade descreve como {LEGAL.owner} (“nós”) trata os dados
        pessoais coletados quando você usa o aplicativo {LEGAL.appName} (“app”). Ao usar o
        app, você concorda com as práticas aqui descritas. Esta política é elaborada de
        acordo com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD).
      </p>

      <h2>1. Controlador dos dados</h2>
      <p>
        Controlador: {LEGAL.owner}, sediada em {LEGAL.ownerCity}. Contato:{" "}
        <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
      </p>

      <h2>2. Dados que coletamos</h2>
      <ul>
        <li>
          <strong>Cadastro:</strong> e-mail e, opcionalmente, nome de exibição e foto de
          avatar fornecidos por você.
        </li>
        <li>
          <strong>Conteúdo enviado:</strong> imagens e PDFs de notas fiscais e cupons que
          você optar por carregar para leitura por OCR.
        </li>
        <li>
          <strong>Dados financeiros pessoais:</strong> despesas, itens de compra, valores,
          categorias, formas de pagamento, contas recorrentes e assinaturas que você
          registrar manualmente ou via OCR.
        </li>
        <li>
          <strong>Dados técnicos mínimos:</strong> identificador da sua sessão de
          autenticação e registros de acesso necessários ao funcionamento e à segurança.
        </li>
      </ul>
      <p>
        O app <strong>não coleta</strong> sua localização precisa, contatos, agenda,
        microfone, SMS ou histórico de navegação. A câmera só é usada quando você ativa,
        explicitamente, a função “Escanear com a câmera”.
      </p>

      <h2>3. Finalidades e bases legais</h2>
      <ul>
        <li>
          <strong>Execução do contrato</strong> (art. 7º, V, LGPD): permitir login,
          armazenar suas despesas, ler notas fiscais por OCR, gerar relatórios e
          recorrências.
        </li>
        <li>
          <strong>Legítimo interesse</strong> (art. 7º, IX): manter segurança da conta,
          prevenir fraudes e melhorar a qualidade do OCR e da classificação automática.
        </li>
        <li>
          <strong>Cumprimento de obrigação legal</strong> (art. 7º, II): atender solicitações
          de autoridades quando previsto em lei.
        </li>
      </ul>

      <h2>4. Compartilhamento com terceiros (operadores)</h2>
      <p>
        Para operar o app, contratamos operadores de tecnologia que processam dados em nosso
        nome, sob obrigação contratual de confidencialidade e segurança:
      </p>
      <ul>
        <li>
          <strong>Provedor de infraestrutura (banco de dados, autenticação e armazenamento):</strong>{" "}
          hospedagem das suas despesas, perfil e arquivos enviados.
        </li>
        <li>
          <strong>Provedor de IA</strong> para a leitura de notas fiscais (OCR): a imagem
          enviada é processada para extrair texto e itens. O conteúdo não é utilizado para
          treinar modelos públicos.
        </li>
      </ul>
      <p>
        Não vendemos nem alugamos seus dados pessoais. Não compartilhamos com anunciantes.
      </p>

      <h2>5. Retenção e exclusão</h2>
      <p>
        Mantemos seus dados enquanto sua conta estiver ativa. Você pode solicitar a
        exclusão a qualquer momento — veja a{" "}
        <a href="/legal/exclusao-conta">Política de Exclusão de Conta</a>. Após a exclusão,
        os dados são removidos em até 30 dias, salvo quando a lei exigir retenção (ex.:
        registros de acesso por 6 meses, conforme art. 15 do Marco Civil da Internet).
      </p>

      <h2>6. Segurança</h2>
      <p>
        Adotamos medidas técnicas e administrativas razoáveis para proteger seus dados,
        incluindo: criptografia em trânsito (HTTPS), isolamento por usuário no banco de
        dados (Row Level Security), autenticação por senha com requisitos mínimos e
        armazenamento privado dos arquivos enviados. Nenhuma medida é absoluta; em caso de
        incidente que possa gerar risco relevante, comunicaremos os titulares e a ANPD
        conforme a LGPD.
      </p>

      <h2>7. Seus direitos como titular (art. 18 da LGPD)</h2>
      <ul>
        <li>Confirmação da existência de tratamento;</li>
        <li>Acesso aos seus dados;</li>
        <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
        <li>Anonimização, bloqueio ou eliminação de dados desnecessários;</li>
        <li>Portabilidade;</li>
        <li>Eliminação dos dados tratados com base no consentimento;</li>
        <li>Informação sobre compartilhamento;</li>
        <li>Revogação do consentimento.</li>
      </ul>
      <p>
        Para exercer qualquer direito, escreva para{" "}
        <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>. Responderemos em
        até 15 dias.
      </p>

      <h2>8. Crianças e adolescentes</h2>
      <p>
        O app não é destinado a menores de 18 anos. Não coletamos intencionalmente dados de
        crianças ou adolescentes.
      </p>

      <h2>9. Cookies e tecnologias similares</h2>
      <p>
        Utilizamos apenas armazenamento local do navegador (localStorage) para manter sua
        sessão e suas preferências (tema claro/escuro). Não usamos cookies de publicidade
        nem rastreadores de terceiros.
      </p>

      <h2>10. Alterações</h2>
      <p>
        Podemos atualizar esta política a qualquer momento. Mudanças relevantes serão
        comunicadas pelo app ou pelo e-mail cadastrado. A data da última atualização consta
        no topo desta página.
      </p>

      <h2>11. Foro</h2>
      <p>Fica eleito o {LEGAL.jurisdiction}, para dirimir quaisquer dúvidas.</p>
    </LegalPage>
  );
}
