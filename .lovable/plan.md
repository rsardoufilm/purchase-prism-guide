# Plano de implementação

## 1. Relatório de correções
Criar painel expansível na tela de nova despesa que exibe, após o OCR, as correções aplicadas automaticamente:
- itens cujo `raw_name` foi normalizado (`normalized_name` divergente);
- categorias inferidas para itens sem categoria;
- categoria geral da nota inferida pelo conteúdo;
- valores reconciliados (quando o 2º passe corrigiu diferenças);
- itens omitidos por ilegibilidade.
O relatório é informativo, não bloqueia o salvamento e ajuda a auditar o OCR.

## 2. Status de leitura
Aproveitar o stepper existente (`steps`) e enriquecê-lo:
- mostrar contagens (bytes recebidos, itens encontrados, correções aplicadas);
- substituir labels genéricas por descrições do que acabou de acontecer;
- manter estados visuais `pending|running|done|error` com ícones e cores dos tokens semânticos;
- exibir tempo decorrido e mensagem de erro por etapa.

## 3. Pós-processamento OCR
Criar server function `postProcessOcr` (ou estender `ocrReceipt`) que, após a resposta do modelo, aplica um dicionário de correções baseado na tabela `product_normalization`:
- buscar normalizações já conhecidas para `raw_name`;
- corrigir `normalized_name` e `category` quando houver correspondência confiável;
- manter a edição manual como soberana (não sobrescrever valores já editados pelo usuário);
- registrar no relatório de correções o que foi ajustado.
Isso reduz alucinações recorrentes sem depender de nova chamada de IA.

## 4. Aprimorar aviso de escaneamento
Melhorar o aviso recém-adicionado no botão "Escanear com a câmera":
- destaque visual (badge/info compacto) dentro do botão;
- mensagem curta: "Para maior precisão, envie o arquivo.";
- adicionar o mesmo aviso dentro do modal da câmera (`CameraCapture`), logo acima do viewfinder;
- usar tokens semânticos (`text-primary`, `bg-primary-soft`) em vez de cor hardcoded.

## 5. Criar fluxo de envio de arquivo
Substituir o botão simples "Enviar arquivo" por um fluxo completo na própria tela:
- área de drop com drag-and-drop ativo;
- preview da imagem/PDF selecionado com opção de remover;
- validação de tipo e tamanho antes de iniciar upload;
- indicador de progresso durante upload + OCR;
- mensagem de sucesso com resumo.
O fluxo não cria nova rota — permanece em `/despesas/nova`.

---

# Detalhes técnicos

- Novos arquivos: `src/components/ocr-correction-report.tsx`, `src/lib/post-process.functions.ts`.
- Arquivos alterados: `src/routes/_authenticated/despesas.nova.tsx`, `src/components/camera-capture.tsx`, `src/lib/ocr.functions.ts`.
- Nenhuma mudança de schema/banco; usa a tabela `product_normalization` existente (leitura apenas).
- Tokens semânticos do Tailwind/shadcn em toda UI; sem cores hardcoded.
- Server function com `requireSupabaseAuth`; env `LOVABLE_API_KEY` continua server-side.
- Build/typecheck executados ao final.