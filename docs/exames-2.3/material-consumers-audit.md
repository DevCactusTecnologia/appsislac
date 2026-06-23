# Exames 2.3 — Material FK Consolidation

## Etapa 1 + 2 — Radiografia de consumidores e qualidade do catálogo

Data: 2026-06-23
Status: **AUDITORIA CONCLUÍDA — AGUARDANDO APROVAÇÃO PARA ETAPAS 3-8**

---

## 1. Catálogo `materiais_amostra` (SSOT alvo)

8 materiais ativos, sem duplicatas, sem inconsistências:

| Sigla | Nome         |
|-------|--------------|
| SOR   | Soro         |
| PLA   | Plasma       |
| ST    | Sangue Total |
| URI   | Urina        |
| FEZ   | Fezes        |
| SWB   | Swab         |
| LCR   | Líquor       |
| SEC   | Secreção     |

UNIQUE em `lower(nome) per tenant`. Coluna `reutilizavel` disponível (substituiria
`MATERIAIS_NAO_REUTILIZAVEIS` hardcoded em `sorotecaStore.ts`).

---

## 2. Estado atual dos dados (descoberta crítica)

| Tabela / Coluna                       | Total | Preenchido | Vazio/NULL |
|---------------------------------------|------:|-----------:|-----------:|
| `exames_catalogo.material` (text)     |   441 |          0 |        441 |
| `atendimento_exames.material` (text)  |    14 |          0 |         14 |
| `amostras.tipo_material` (text NOT NULL) | 19 |     19 ("—") |        0 |
| `amostras.material_id` (FK uuid)      |    19 |          0 |         19 |

**Conclusão de dados:** o campo `material` é texto morto em produção.
Nenhum exame, atendimento ou amostra tem material real persistido.
A FK `amostras.material_id` já existe mas nunca foi populada.

**Implicação para o backfill (Etapa 4):**
- Não há mapeamento texto→FK a executar (0 linhas com valor).
- Não há risco de "material sem correspondência".
- A regra de PARADA da Etapa 4 não dispara.

---

## 3. Consumidores reais do campo `material` (catálogo + atendimento)

### 3.1 Leituras / escritas significativas

| Arquivo | Papel | Ação proposta na refatoração |
|---|---|---|
| `src/data/exameCatalogoStore.ts` | mapeia `material` no `fromRow`/`toRow` | trocar por `material_id` (uuid \| null) |
| `src/components/configuracoes/NovoExameDialog.tsx` | input texto + preset auto-fill por categoria | trocar por `<Select>` ligado a `materiaisAmostraStore` |
| `src/lib/exameDefaults.ts` | presets por categoria (`material: "Soro"`, etc.) | mapear para `materialSigla`/`materialId` ou remover |
| `src/data/atendimentoStore/exames.ts` + `mutations.ts` + `_internal.ts` + `types.ts` | propaga `material` texto do catálogo → `atendimento_exames.material` | trocar por `material_id` resolvido; passar uuid no snapshot |
| `src/pages/NovoAtendimento/*` (types, helpers, NovoAtendimento.tsx) | tipo `Exame.material: string` | tipo `materialId?: string`; nome resolvido por lookup |
| `src/lib/imprimirEtiquetaPorAtendimentoExame.ts` (linha 110) | `amostra?.tipo_material \|\| exRow.material \|\| "—"` | resolver `material_id` → nome via catálogo |
| `src/lib/etiquetaAmostra.ts` | renderiza string de material na etiqueta | idem |
| `src/components/AtendimentoDetalheDialog.tsx` | exibe material | idem |
| `src/pages/Producao.tsx` | array `MATERIAIS` hardcoded para filtro | substituir por `materiaisAmostraStore` (já flagado em soroteca-audit) |
| `src/pages/RegistrarColeta.tsx` / `AnalisarAmostra.tsx` | filtros e badges | idem |
| `src/data/producaoMetricsStore.ts` | agrupa por material | idem |
| `src/data/atendimentoStore/types.ts` (`material: string`) | tipagem | trocar tipo |

### 3.2 Soroteca (já está parcialmente correto)

| Arquivo | Estado |
|---|---|
| `src/data/sorotecaStore.ts` | já filtra por `material_id`; mantém `MATERIAIS_NAO_REUTILIZAVEIS` hardcoded — **substituir por `materiais_amostra.reutilizavel`** |
| `src/data/sorotecaEstruturaStore.ts` | OK |
| `src/pages/Soroteca*.tsx`, `AmostraDetalheDialog.tsx` | leem `tipo_material` texto; passar a resolver via `material_id` |
| Trigger `sync_amostra_tipo_material_biu` | mantém `tipo_material` sincronizado a partir de `material_id` — **remover na Etapa 7** após drop da coluna |

### 3.3 Documentos / Previews / Mocks (NÃO são consumidores reais)

Apenas dados fictícios em modais de preview — substituir literais por nomes do catálogo, sem migração:

- `src/lib/mapaLotePreview.ts`
- `src/components/configuracoes/PreviewComprovantesDialog.tsx`
- `src/components/configuracoes/documentos/DocumentoTemplateDialog.tsx`
- `src/components/configuracoes/mapas/MapaTrabalhoDialog.tsx`
- `src/pages/NovoAtendimento/buildExamesCobranca.test.ts`
- `src/pages/NovoAtendimento/services/aplicarAjusteLiquido.test.ts`
- `src/pages/NovoAtendimento/helpers.ts` (fallback para orçamento)
- `src/pages/NovoAtendimento.tsx:797` (mock IA)

### 3.4 Integrações (campo distinto)

`hermes-pardini`, `dbsync/xml/envelopes.ts`, `dbsync/parser/index.ts`,
`dbsync/labels/*` — campo `material` recebido do parceiro (texto na resposta da API).
**Não migrar** — é payload externo, não é o nosso domínio. Continuam string.

### 3.5 Apoio (`MapeamentoExamesDialog.tsx`)

Campo `material` em `integration_exam_map` é **string de mapeamento por provedor**,
não a entidade do catálogo. Permanece string (escopo da fase Apoio).

---

## 4. Resumo quantitativo

- **Consumidores reais do catálogo `material`:** ~25 arquivos.
- **Mocks/previews/integrações (não migrar):** ~12 arquivos.
- **Tabelas afetadas:** `exames_catalogo`, `atendimento_exames`, `amostras` (parcial — `material_id` já existe).
- **Linhas a backfillar:** **0** (campo vazio em todas as tabelas).
- **Triggers a remover na Etapa 7:** `sync_amostra_tipo_material_biu`.
- **Constantes hardcoded a remover:** `MATERIAIS_NAO_REUTILIZAVEIS`, `MATERIAIS` (Producao), `exameDefaults.material`.

---

## 5. Plano consolidado proposto (Etapas 3 → 8)

Dado que **a coluna está 100% vazia**, o plano original simplifica:

1. **Etapa 3** — Migration: adicionar `exames_catalogo.material_id uuid REFERENCES materiais_amostra(id)` (nullable); adicionar `atendimento_exames.material_id uuid REFERENCES materiais_amostra(id)` (nullable).
2. **Etapa 4** — Backfill: **N/A** (0 linhas com valor). Documentar pulo.
3. **Etapa 5** — Refatorar stores/dialogs/etiquetas/produção para usar `material_id` + lookup em `materiaisAmostraStore`. Substituir input texto por `<Select>`.
4. **Etapa 6** — Hardening: manter `material_id` NULLABLE no catálogo (exames podem não exigir material — ex.: cálculos derivados); índice em `(material_id)` em `atendimento_exames` e `exames_catalogo`.
5. **Etapa 7** — Drop colunas legadas:
   - `exames_catalogo.material` (text)
   - `atendimento_exames.material` (text)
   - `amostras.tipo_material` (text) + trigger `sync_amostra_tipo_material_biu`
6. **Etapa 8** — Cleanup: `MATERIAIS_NAO_REUTILIZAVEIS`, `MATERIAIS` array, presets em `exameDefaults.ts`, mocks de preview.

---

## 6. Riscos e questões abertas (precisam decisão antes de prosseguir)

1. **`exameDefaults.ts`** define material por **categoria de exame** (`BIOQUIMICA → Soro`). Hoje o usuário não preenche material; o preset preenche silenciosamente. Manter esse comportamento mapeando para `material_id` por categoria? Ou remover o auto-fill e exigir seleção manual?
2. **`amostras.tipo_material NOT NULL`** com valor `"—"` em todas as linhas: drop seguro após Etapa 7 (nenhum consumidor depende do conteúdo real).
3. **Material NULLABLE no catálogo**: confirmar — exames sem material (cálculos, perfis derivados) devem ser permitidos?
4. **Integrações externas (`hermes-pardini`, `dbsync`)**: confirmar que campo `material` vindo do parceiro permanece string de transporte (não vira FK).

---

## 7. Critério de parada cumprido

Etapa 1 e 2 concluídas. **PARADA — aguardando aprovação explícita** para
executar a migration da Etapa 3 e o refactor das Etapas 5-8.
