## Objetivo
Tornar o classificador aprendido por usuário visível, auditável e expansível, cobrindo também a categoria da despesa (não só dos itens).

## 1. Registrar feedback do usuário
Quando o usuário edita manualmente a categoria de um item (ou da despesa) que veio sugerida pela IA/histórico, registrar isso como sinal forte de aprendizado.

- Em `ItemsEditor` (`despesas.nova.tsx`), ao alterar `category` de um item, marcar `item._userEdited = true` (campo runtime, não persistido no banco).
- Ao salvar a despesa, os itens com `_userEdited` já vão para `expense_items` como categoria final — o `loadUserCategoryMap` da próxima sessão capta automaticamente (priorizando registros mais recentes via `order created_at desc`, que já existe).
- Adicionar peso extra: itens recentes (últimos 30 dias) com edição manual contam dobrado na contagem de moda → reforça aprendizado rápido.

Não cria tabela nova — usa `expense_items` existente. O "feedback" é implícito: editou = ensinou.

## 2. Gerenciar mapeamentos aprendidos
Criar nova rota `src/routes/_authenticated/aprendizado.tsx` com tabela de associações:

- Coluna: Produto (raw_name normalizado) | Categoria aprendida | Frequência | Última ocorrência | Ação (remover/redefinir).
- "Remover" abre dialog: oferece (a) definir nova categoria padrão ou (b) limpar a associação atualizando os `expense_items` correspondentes para `category = null` (apaga o sinal de aprendizado).
- Link no menu lateral (`app-shell.tsx`) com ícone `Brain` ou `Sparkles`.

Carrega via `loadUserCategoryMap` reformulado para devolver também `count` e `last_seen` por chave.

## 3. Mostrar badge de aprendizado
Em `ItemsEditor`, quando a categoria de um item foi sugerida pelo histórico do usuário (e não por regra determinística nem pelo OCR), exibir um pequeno badge ao lado do select:

- Badge: `<Sparkles className="size-3" /> Aprendido` com `bg-primary-soft text-primary`.
- Tooltip: "Categoria sugerida pelo seu histórico de compras".
- Quando o usuário edita manualmente, badge muda para `Personalizado` com cor `secondary`.
- Necessário rastrear origem da categoria por item: estender o item runtime com `_categorySource: 'ocr' | 'learned' | 'rule' | 'user' | null` setado no pipeline pós-OCR.

## 4. Aprender na categoria da despesa
Espelhar o sistema para o campo `expenses.category`:

- Novo arquivo `src/lib/user-classifier-expense.ts` com `loadUserExpenseCategoryMap()` e `suggestExpenseCategory(merchantName)` — chave: `merchant_name` normalizado.
- Em `despesas.nova.tsx`, após OCR, se a despesa não tem categoria mas o `merchant_name` aparece no histórico, sugerir.
- Mesmo badge "Aprendido" no select de categoria da despesa.
- Lista de gerenciamento em `aprendizado.tsx` ganha segunda aba "Estabelecimentos → Categoria".

---

## Detalhes técnicos
- Arquivos novos: `src/lib/user-classifier-expense.ts`, `src/routes/_authenticated/aprendizado.tsx`.
- Editados: `src/lib/user-classifier.ts` (devolver metadados de count/last_seen + helper `clearLearning`), `src/routes/_authenticated/despesas.nova.tsx` (badges, rastreio de origem, sugestão de categoria de despesa), `src/components/app-shell.tsx` (link de menu).
- Sem mudanças de schema. Reaproveita `expense_items.category` e `expenses.category` existentes.
- Tokens semânticos (`bg-primary-soft`, `text-primary`, `bg-secondary`); zero cor hardcoded.
- Build/typecheck ao final.
