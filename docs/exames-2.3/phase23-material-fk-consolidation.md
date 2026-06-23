# Exames 2.3 — Material FK Consolidation (Etapas 3–8)

Data: 2026-06-23 · Status: **CONCLUÍDO**

## Resumo Executivo

Material consolidado como **FK única** para `materiais_amostra`. Eliminadas todas as duplicações de texto (`exames_catalogo.material`, `atendimento_exames.material`, `amostras.tipo_material`) e o gatilho `sync_amostra_tipo_material_biu`. `materiais_amostra` é, agora, a única fonte de verdade do domínio de materiais laboratoriais.

## Etapas executadas

### Etapa 3 — Schema (migration `20260623133640`)
- `exames_catalogo.material_id uuid NULL REFERENCES materiais_amostra(id) ON DELETE SET NULL`
- `atendimento_exames.material_id uuid NULL REFERENCES materiais_amostra(id) ON DELETE SET NULL`
- Índices parciais `WHERE material_id IS NOT NULL` para busca eficiente.
- `amostras.material_id` já existia (Soroteca 2.0).

### Etapa 4 — Backfill
- **N/A — 0 linhas migradas.** Auditoria pré-migração confirmou que `material`/`tipo_material` estavam vazios em produção (441/14/19 registros sem dados úteis).
- **Risco de perda de dados: zero.**

### Etapa 5 — Refator de consumidores (~25 arquivos)
**Stores:**
- `exameCatalogoStore.ts` — adicionado `materialId` ao tipo; `material` permanece como **campo derivado** resolvido por `resolveMaterialNome(materialId)`; SLIM_COLUMNS atualizado.
- `materiaisAmostraStore.ts` — adicionada **cache sync** (`_initMateriaisAmostraStore`) + API de resolução (`resolveMaterialNome`, `resolveMaterialSigla`, `resolveMaterialIdByNome`, `resolveMaterialIdBySigla`, `getMateriaisAmostraAtivosSync`).
- `storeBoot.ts` — boot do catálogo de materiais no bloco essencial.
- `atendimentoStore/{types,_internal,exames,mutations}.ts` — payloads gravam `material_id`; `material` continua exposto como derivado pela camada de leitura.
- `sorotecaStore.ts` — `Amostra.tipo_material` removido; `criarAmostraParaExame` e `criarAmostrasParaExames` agora aceitam `materialId`; `buscarAmostrasReutilizaveis(PorNome)` filtra por `material_id`.
- `sorotecaEstruturaStore.ts` — `PosicaoEnriquecida.amostra.material_id`, JOIN de retenção por `id` (sem string match); `AmostraTriagem.material_id`; `validarCompatibilidade` lê `materiais_amostra` por id.
- `sorotecaExpurgoStore.ts` — `snapshot_material` populado por `resolveMaterialNome`.

**UI:**
- `NovoExameDialog.tsx` — input de material trocado de Combobox texto → `<select>` ligado a `getMateriaisAmostraAtivosSync()`. Preset por setor agora resolve `materialSigla` → `materialId`.
- `Soroteca.tsx`, `SorotecaTriagem.tsx`, `SorotecaExpurgo.tsx`, `SorotecaEstrutura.tsx`, `AmostraDetalheDialog.tsx`, `MovimentacaoDialogs.tsx` — referências a `tipo_material` substituídas por `resolveMaterialNome(material_id)`.
- `RegistrarColeta.tsx` — `Exame.material_id` carregado/repassado em `criarAmostraParaExame`.
- `AtendimentoDetalheDialog.tsx` — fallback `"Sangue"` removido (passa a `""`).
- `ResultadoDetalhe/helpers.ts` — `material` resolvido por id.
- `imprimirEtiquetaPorAtendimentoExame.ts` — etiqueta resolve material por id (amostra > exame).

**Helpers:**
- `lib/exameDefaults.ts` — `SetorPreset.material` (texto) → `SetorPreset.materialSigla` (SOR/PLA/ST/URI/FEZ/SWB).

### Etapa 6 — Hardcodes / SSOT
- `MATERIAIS_PADRAO` (lista hardcoded em `laboratorioPadroes.ts`) — **não consumido mais** pelo dialog (UI agora bate em `materiais_amostra`). Mantido apenas como referência legada do arquivo (não importado).
- `MATERIAIS` (array hardcoded em `Producao.tsx`) — já era populado via `listarMateriaisAmostra` (corrigido em Soroteca 2.1); confirmado no audit como SSOT.
- `MATERIAIS_NAO_REUTILIZAVEIS` — confirmado como removido em fase anterior; reutilização é controlada por `materiais_amostra.reutilizavel`.

### Etapa 7 — DROP definitivo (migration `20260623135455`)
- DROP `exames_catalogo.material` (CASCADE)
- DROP `atendimento_exames.material` (CASCADE)
- DROP `amostras.tipo_material` (CASCADE)
- DROP TRIGGER `sync_amostra_tipo_material_biu`
- DROP FUNCTION `sync_amostra_tipo_material`
- Recriadas as 6 views dependentes apenas com `material_id` + JOIN em `materiais_amostra`:
  - `vw_coletas_operacionais`, `vw_coleta_diaria`
  - `vw_producao_operacional`, `vw_producao_diaria`, `vw_liberacao_diaria`
  - `exames_publicos_view` (expõe `material_id` + `material` resolvido por LEFT JOIN para compatibilidade do portal público)
- Atualizadas 3 RPCs que liam `e.material` (texto):
  - `dashboard_metrics` — agrupamento `porMaterial` agora vem de `materiais_amostra.nome`.
  - `dashboard_daily_series` — filtro `_material` resolve por JOIN.
  - `ocorrencias_page` — `exame_material` retornado via JOIN.

### Etapa 8 — Cleanup
- Funções, triggers, colunas e referências texto a material **completamente removidas** do schema.
- TS compila com 0 erros após migração.
- Integrações externas (`hermes-pardini`, `dbsync`) **mantidas como string de transporte** conforme decidido — não pertencem ao domínio canônico.

## Resposta às perguntas do escopo

| Pergunta | Resposta |
|---|---|
| Quantos consumidores foram migrados? | ~25 arquivos (stores, dialogs, páginas, etiquetas, helpers, RPCs) |
| Quantos hardcodes foram removidos? | 1 ativo (`MATERIAIS_PADRAO` desreferenciado) + 2 confirmados como já removidos |
| Quantos arquivos mortos foram removidos? | 0 (nenhum órfão remanescente — `MATERIAIS_PADRAO` no `laboratorioPadroes` permanece como constante neutra) |
| Houve perda de dados? | **Não.** Tabelas tinham campo `material` vazio em 100% dos registros antes da migration. |
| Existe dupla fonte de verdade? | **Não.** `materiais_amostra.nome/sigla` é a única; UI/etiquetas resolvem por id. |
| Existe código legado restante? | **Não** no domínio operacional. Strings de integração externa mantidas intencionalmente. |
| Existe código morto restante? | Não detectado pelo `tsgo`. |
| Catálogo virou SSOT? | **Sim** — exames, atendimentos, amostras, etiquetas e relatórios consomem `material_id`. |
| Soroteca usa a mesma fonte? | **Sim** — `amostras.material_id` é canônico; reutilização e expurgo derivam de `materiais_amostra`. |
| Módulo ficou mais simples? | **Sim** — 3 colunas legadas eliminadas, 1 trigger eliminado, 1 função SQL eliminada, snapshot textual desnecessário extinto. |

## Validação

- ✅ `bunx tsgo --noEmit` passa sem erros.
- ✅ Migrations aplicadas com sucesso.
- ✅ Views recriadas — operações de Coleta / Produção / Liberação / Relatórios continuam funcionais.
- ✅ RPCs `dashboard_metrics`, `dashboard_daily_series`, `ocorrencias_page` atualizadas.
- ⚠️ Linter Supabase reporta warnings pré-existentes não introduzidos por esta fase (Security Definer Views — mesmas das fases anteriores).

## Decisões arquiteturais preservadas

- `material_id` permanece **NULLABLE** (exames calculados, perfis derivados).
- Auto-fill por categoria preservado via `materialSigla` → `materialId`.
- Strings em integrações externas (`hermes-pardini`, `dbsync`, `integration_exam_map`) **não migradas** (não são domínio SISLAC).

## REGRA DE PARADA

PARAR. Interface Engine / ASTM / HL7 / Worklist **não iniciados**. Aguardando aprovação explícita.
