## Fase 1 — Críticos por sexo+idade (reuso de `valores_referencia`)

### Banco
Migration adicionando 2 colunas opcionais em `valores_referencia`:
- `critico_min text NULL`
- `critico_max text NULL`

Sem nova tabela. Sem RLS nova (herda as policies existentes).

### Resolver
`resolverReferencia()` em `src/data/valoresReferenciaStore.ts` passa a retornar também `criticoMin`/`criticoMax` (quando preenchidos na linha vencedora). Assinatura existente preservada — campos novos opcionais.

### Pipeline de crítico
`src/pages/ResultadoDetalhe/services/criticoPipeline.ts`:
1. Tenta `resolverReferencia(exame, parametro, sexo, idade)` → se vier `criticoMin/Max`, usa.
2. Fallback: `exame_parametros.critico_min/max` (comportamento atual).

Sem mudança em `criticoChecker.ts` (continua recebendo min/max numéricos).

### UI — `FiltrosDialog` (valores de referência)
Cada linha de VR ganha 2 inputs opcionais: **Crítico mín.** e **Crítico máx.**, ao lado de Valor mín./máx. Texto de ajuda: "Deixe em branco para usar o crítico padrão do parâmetro."

### Sem mudança nesta fase
- Sem flag `gestante` em `pacientes` (LGPD/estrutura — fase futura, só se pedido).
- Sem nova UI em `ParametrosDialog` (críticos padrão continuam ali).

---

## Redesign — Modal "Detalhes do exame"

Hoje: 3 cards abrem 3 modais aninhados → muito clique, sem contexto.

Novo: **modal único com abas internas**, sem aninhamento.

```text
┌─ FlaskConical  Nome do exame                    [Editar exame] [X] ─┐
│  mnemônico • setor                                                   │
├──────────────────────────────────────────────────────────────────────┤
│ [ Layouts ] [ Parâmetros ] [ Valores de referência ]                │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  (conteúdo da aba ativa, inline — sem novo modal)                   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Mudanças
- `DetalhesExameDialog.tsx`: substituir os 3 quick-action cards + lista de layouts por um `Tabs` (shadcn) com 3 abas. Header e botão "Editar exame" permanecem.
- **Aba Layouts**: a lista atual + botão "Adicionar". Editar/duplicar/remover continuam disparando ações inline; o editor de layout (`LayoutDialog`) **continua sendo dialog separado** porque é um editor pesado em tela cheia (CKEditor) — não cabe inline. Justificativa: editor full-screen ≠ navegação.
- **Aba Parâmetros**: renderiza o conteúdo de `ParametrosDialog` inline. Refatorar `ParametrosDialog` para extrair o corpo (`ParametrosPanel`) reaproveitável; o dialog antigo continua existindo como wrapper para outros usos (se houver), mas o `DetalhesExameDialog` usa o painel direto.
- **Aba Valores de referência**: idem — extrair `FiltrosPanel` do `FiltrosDialog`.
- Largura do modal aumenta de `3xl` para `5xl` para acomodar tabelas.
- Aba lembrada na sessão (estado local; sem persistência).

### Resultado
- 1 clique para abrir o exame, 1 clique para trocar de aba (antes: 2 cliques para entrar + fechar para sair + reabrir).
- Sem perda de contexto entre Parâmetros ↔ VR ↔ Layouts.
- Edição pesada de layout continua em modal próprio (intencional).

---

## Ordem de execução
1. Migration `valores_referencia` (aguarda aprovação).
2. Após aprovação: atualizar resolver + criticoPipeline + UI do FiltrosDialog/Panel.
3. Refator do `DetalhesExameDialog` para tabs + extração dos painéis.

Confirma para eu disparar a migration?