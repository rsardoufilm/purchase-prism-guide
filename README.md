# AURA Consumo

[![CI](https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/OWNER/REPO/actions/workflows/ci.yml)

> **Nota:** substitua `OWNER/REPO` acima pelo caminho real do seu repositório no GitHub (ex.: `seu-usuario/aura-consumo`). O badge fica verde quando o Quality Gate passa no `main`.

## Quality Gate

O workflow `.github/workflows/ci.yml` roda em todo push/PR:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run verify:all` (rotas, câmera, convite, ranking, recorrentes, taxa de serviço)

### Tornar obrigatório no `main` (configuração recomendada)

1. GitHub → **Settings** → **Branches** → **Branch protection rules** → **Add rule** (ou **Edit** se já existir)
2. Branch name pattern: `main`
3. Marque:
   - ✅ **Require a pull request before merging** (com **1 aprovação**)
   - ✅ **Require status checks to pass before merging**
     - Status check obrigatório: **Quality Gate**
   - ✅ **Require branches to be up to date before merging**
   - ✅ **Do not allow bypassing the above settings**
   - ⚪ **Require linear history** (opcional — exige rebase em vez de merge commits)
4. Desmarque (não são necessários agora): *Require signed commits*, *Lock branch*, *Allow force pushes*, *Allow deletions*
5. **Save changes**

A partir daí, nenhum commit entra no `main` sem PR + Quality Gate verde + aprovação.

### Como testar a proteção com um PR

1. Faça qualquer pequena alteração pelo Lovable (ex.: ajuste de texto)
2. O Lovable sincroniza com o GitHub e abre/atualiza um Pull Request automaticamente
3. Na aba **Checks** do PR, acompanhe o **Quality Gate** rodar
4. Se falhar 🔴 → o botão de merge fica bloqueado (proteção funcionando)
5. Se passar 🟢 → aprove o próprio PR e clique **Merge pull request**


## Testar manualmente as novas features

### Alerta de recorrente (5 dias antes do vencimento)

1. Vá em **Despesas → Recorrentes → Nova**
2. Crie um recorrente com `próximo vencimento` daqui a 3-5 dias
3. Volte ao Dashboard/Despesas — o card `[nome] vence em X dias. O valor continua R$ ...?` aparece
4. Clique **Confirmar valor** ou **Corrigir** — a correção vale só para o ciclo atual

### Lançamentos retroativos

1. Vá em **Despesas → Recorrentes → Nova**
2. Preencha nome, valor, frequência mensal
3. Em `data de início`, escolha um mês passado (ex.: 3 meses atrás)
4. Ao salvar, o diálogo pergunta: *"Identificamos que [nome] tem 3 parcelas não registradas desde [mês/ano]. Deseja lançar retroativamente?"*
5. Confirme — os 3 lançamentos aparecem no histórico com as datas corretas

Testes automatizados equivalentes já rodam via `npm run verify:recurring`.
