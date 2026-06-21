import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/legal-page";
import { LEGAL } from "@/lib/legal-info";

export const Route = createFileRoute("/legal/termos")({
  component: TermosPage,
  head: () => ({
    meta: [
      { title: "Termos de Uso — AURA Consumo" },
      {
        name: "description",
        content: "Regras de uso do aplicativo AURA Consumo, oferecido por Aura R Sistemas.",
      },
    ],
  }),
});

function TermosPage() {
  return (
    <LegalPage eyebrow="Aviso legal" title="Termos de Uso">
      <p>
        Estes Termos regulam o uso do aplicativo {LEGAL.appName} (“app”), oferecido por{" "}
        {LEGAL.owner}, com sede em {LEGAL.ownerCity}. Ao criar uma conta ou usar o app,
        você concorda integralmente com estes Termos e com a{" "}
        <a href="/legal/privacidade">Política de Privacidade</a>.
      </p>

      <h2>1. Objeto</h2>
      <p>
        O {LEGAL.appName} é um aplicativo de organização financeira pessoal que permite
        registrar despesas manualmente, por leitura de notas fiscais (OCR) e por upload de
        arquivos, gerando relatórios, classificações e detecção de contas recorrentes para
        uso individual.
      </p>

      <h2>2. Cadastro e conta</h2>
      <ul>
        <li>É necessário ter 18 anos ou mais para criar uma conta.</li>
        <li>
          Você é responsável pela exatidão das informações fornecidas e pela guarda da sua
          senha.
        </li>
        <li>
          Notifique-nos imediatamente em caso de uso não autorizado da sua conta pelo
          e-mail <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
        </li>
      </ul>

      <h2>3. Uso aceitável</h2>
      <p>Ao usar o app, você concorda em não:</p>
      <ul>
        <li>Violar leis aplicáveis ou direitos de terceiros;</li>
        <li>
          Enviar conteúdo ilícito, ofensivo, fraudulento ou que não seja de sua titularidade;
        </li>
        <li>
          Tentar acessar dados de outros usuários, contornar a autenticação ou explorar
          vulnerabilidades;
        </li>
        <li>
          Utilizar engenharia reversa, raspagem automatizada ou qualquer meio para extrair
          dados do app além do uso pessoal previsto;
        </li>
        <li>Utilizar o app para atividades que violem normas das lojas de aplicativos.</li>
      </ul>

      <h2>4. Conteúdo do usuário</h2>
      <p>
        As notas, imagens e informações financeiras que você envia continuam sendo suas. Você
        concede a {LEGAL.owner} licença limitada, não exclusiva e revogável, estritamente
        necessária para armazenar, processar e exibir esses dados a você no próprio app —
        inclusive submetê-los ao mecanismo de OCR para extração de itens.
      </p>

      <h2>5. Disponibilidade do serviço</h2>
      <p>
        Buscamos manter o app disponível, mas ele é fornecido “no estado em que se
        encontra”. Podemos realizar manutenções, atualizar funcionalidades ou descontinuar
        recursos a qualquer momento, com aviso razoável quando possível.
      </p>

      <h2>6. Limitação de responsabilidade</h2>
      <p>
        Dentro dos limites permitidos pela legislação, {LEGAL.owner} não se responsabiliza
        por: (i) decisões financeiras tomadas com base nas informações exibidas, (ii) erros
        na leitura automática de notas (OCR), (iii) indisponibilidade temporária e (iv)
        perdas decorrentes de uso indevido da conta pelo próprio usuário. O OCR é uma
        ferramenta de apoio e seus resultados devem ser conferidos antes de serem salvos.
      </p>

      <h2>7. Propriedade intelectual</h2>
      <p>
        A marca {LEGAL.appName}, o código, os layouts e demais elementos do app pertencem a{" "}
        {LEGAL.owner}. Nenhuma parte destes Termos transfere a você titularidade sobre eles.
      </p>

      <h2>8. Rescisão e exclusão</h2>
      <p>
        Você pode encerrar sua conta a qualquer momento — veja a{" "}
        <a href="/legal/exclusao-conta">Política de Exclusão de Conta</a>. Podemos
        suspender ou encerrar contas que violem estes Termos, mediante notificação prévia
        quando possível.
      </p>

      <h2>9. Alterações dos Termos</h2>
      <p>
        Podemos alterar estes Termos. Mudanças relevantes serão informadas pelo app ou pelo
        e-mail cadastrado. O uso continuado após a alteração indica aceitação.
      </p>

      <h2>10. Lei aplicável e foro</h2>
      <p>
        Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o{" "}
        {LEGAL.jurisdiction}, para dirimir quaisquer questões deles decorrentes.
      </p>
    </LegalPage>
  );
}
