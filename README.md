# AURA Consumo

[![CI](https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/OWNER/REPO/actions/workflows/ci.yml)

> **Nota:** substitua `OWNER/REPO` acima pelo caminho real do seu repositório no GitHub (ex.: `seu-usuario/aura-consumo`). O badge fica verde quando o Quality Gate passa no `main`.

## Quality Gate

O workflow `.github/workflows/ci.yml` roda em todo push/PR:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run verify:all` (rotas, câmera, convite, ranking, recorrentes, taxa de serviço)

### Tornar obrigatório no `main`

1. GitHub → **Settings** → **Branches** → **Branch protection rules** → **Add rule**
2. Branch name pattern: `main`
3. Marque **Require status checks to pass before merging**
4. Selecione o check **CI / quality-gate** (aparece após o primeiro run)
5. Salve

A partir daí, nenhum PR entra no `main` sem o CI verde.

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
