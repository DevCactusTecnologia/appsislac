# Auditoria de Banco — Valores de Referência 2.0

## `public.valores_referencia` (16 colunas)

| Coluna | Tipo | Null? | Uso real (frontend) | Observação |
|---|---|---|---|---|
| `id` | bigint | NO | sim | PK |
| `tenant_id` | uuid | NO | server-side (RLS) | OK |
| `exame_nome` | text | NO | sim | **Lookup por nome**, não por FK → ver Performance. |
| `parametro_nome` | text | NO | sim | Idem (texto, não FK). |
| `sexo` | text | NO | sim | Valores: Masculino/Feminino/Ambos (sem CHECK). |
| `idade_min`, `idade_max` | text | NO | sim | Salvos como string; parser converte para número. |
| `unidade_idade` | text | NO | sim | Anos/Meses/Dias. |
| `valor_min`, `valor_max` | text | NO | sim | Texto para suportar `<`, `>`, decimais com `,`. |
| `unidade` | text | NO | sim | Texto livre, sem normalização. |
| `descricao` | text | NO | sim | Texto livre exibido no laudo. |
| `critico_min`, `critico_max` | text | YES | **0 linhas usando** | Adicionado na Fase 1 do roadmap anterior; nunca adotado. |
| `created_at`, `updated_at` | timestamptz | NO | — | OK |

### Índices
- `valores_referencia_pkey` (id)
- `idx_valores_referencia_exame` (exame_nome, parametro_nome) — **case-sensitive**; código compara com `.toLowerCase()` → index não é usado nas leituras críticas.
- `idx_valores_referencia_tenant` (tenant_id)

### RLS
- 4 policies: `vref_select`, `vref_insert`, `vref_update`, `vref_delete` — confirmadas.

## `public.exame_parametros` (25 colunas)

| Coluna | Uso real |
|---|---|
| `id`, `exame_id`, `tenant_id`, `ordem`, `tipo` | core |
| `rotulo`, `chave`, `abreviacao` | core (chave única por exame: `exame_parametros_chave_unica_por_exame`) |
| `valor_referencia` | **texto livre legado** — concorre com `valores_referencia.descricao` |
| `formula` | só Formula |
| `opcoes_select` | só Select |
| `casas_decimais`, `separador_decimal`, `qtd_digitos` | número/fórmula |
| `formato_exibicao` | só Tempo (`min_seg`/`hh_mm_ss`) |
| `critico_min`, `critico_max` | crítico fallback global |
| `qtd_caracteres`, `chave_apoio`, `exibir_anterior`, `exibir_mapa`, `obrigatorio`, `visivel` | herdados de UI antiga — **vários parecem nunca ser consultados pelo backend nem alterar comportamento crítico**. Ver `dead-code-report.md`. |

### Índices
- `exame_parametros_pkey`
- `exame_parametros_chave_unica_por_exame` (exame_id, chave) — unique
- `idx_exame_parametros_exame_id`, `idx_exame_parametros_exame_ordem`, `idx_exame_parametros_tenant`

### RLS
- 4 policies (`expar_*`).

## Observações

- Nenhum CHECK em `sexo` / `unidade_idade` / `tipo` / `formato_exibicao` → integridade depende 100% do frontend.
- `unidade` não é normalizada (mistura `g/dL`, `g/dl`, `g/L`…).
- `idade_min/max` como `text` complica indexação por faixa — qualquer query "buscar VR para X dias" exige scan + parse em app.
- Realtime: nenhum canal `postgres_changes` para essas tabelas.
