# Soroteca 2.0 — Fase 4 — Catálogo de Materiais

## Entregas

### Banco de dados
- **Tabela `public.materiais_amostra`** (multi-tenant): `nome`, `sigla`, `dias_retencao`, `horas_validade`, `temperatura_recomendada`, `reutilizavel`, `ativo`.
- Índice único `uniq_materiais_amostra_tenant_nome` (case-insensitive) + `idx_materiais_amostra_tenant_ativo`.
- RLS habilitado, 4 policies (`select` aberto a perfis operacionais; `insert/update` restritos a admin/manager; `delete` somente admin).
- Triggers: `tg_materiais_amostra_updated_at` + `audit_trigger`.

### Compatibilidade com amostras
- Coluna `amostras.material_id` (FK opcional → `materiais_amostra`).
- Índice `idx_amostras_material_id`.
- Trigger `sync_amostra_tipo_material_biu` (BEFORE INSERT/UPDATE OF material_id) atualiza automaticamente o campo legado `amostras.tipo_material` (uppercase do nome), garantindo zero quebra em Coleta, Atendimento, Produção, Resultados, Etiquetas e Labs de Apoio.

### Seed
- 8 materiais por tenant: **Soro, Plasma, Sangue Total, Urina, Fezes, Swab, Líquor, Secreção**, com siglas, retenção, validade e temperatura padrão (2-8°C).

### Frontend
- `src/data/materiaisAmostraStore.ts` — store enxuto com listagem paginada server-side, criar/atualizar/remover.
- `src/pages/SorotecaMateriais.tsx` — CRUD simples (busca debounced 300ms, paginação real 25/pg, dialog flat, switches Ativo/Reutilizável).
- Rota `/soroteca/materiais` registrada em `src/App.tsx` sob `registrar_coleta`.

## Respostas obrigatórias

| Pergunta | Resposta |
| --- | --- |
| Quantos materiais foram criados? | **8 por tenant** via seed. |
| Existe catálogo único? | **Sim** — `materiais_amostra` é fonte canônica. |
| Houve remoção de texto livre? | Não nesta fase — `tipo_material` é mantido por compatibilidade. |
| Como funciona a compatibilidade com `tipo_material`? | Trigger `sync_amostra_tipo_material` espelha `nome` (uppercase) no campo legado sempre que `material_id` é definido/alterado. |
| Impacto em Coleta? | **Zero.** Continua lendo `tipo_material`. |
| Impacto em Atendimento? | **Zero.** Sem alteração nos fluxos atuais. |
| Impacto em Produção? | **Zero.** |
| Impacto em Resultados? | **Zero.** |
| Código morto removido? | Nenhum removido nesta fase (limpeza de selects hardcoded ficará para Fase 5 com adoção do `material_id` nos formulários). |
| Soroteca preparada para Expurgo Programado? | **Sim** — `dias_retencao` já disponível por material, base para a Fase 7. |

## Regras respeitadas
- 1 problema → 1 solução; sem categorias, subgrupos, tags ou versionamento.
- Sem `material_audit`/`historico_material` (usa `audit_trigger` existente).
- Sem novas permissões (reaproveita roles admin/manager e permissões existentes).
- Paginação real obrigatória; sem `SELECT *` sem limite.

## Próximos passos (Fase 5+)
1. Substituir, nos formulários (Atendimento, Coleta, Cadastro de exames), o input livre de "Tipo Material" por um `Select` alimentado por `listarMateriaisAmostra({ ativosOnly: true })`, gravando `material_id`.
2. Backfill opcional: associar `tipo_material` legado ao `material_id` correspondente em registros antigos.
3. Limpar listas hardcoded (`MATERIAIS_PADRAO` em `laboratorioPadroes.ts`) após adoção total.
