# Relatório Executivo — Valores de Referência 2.0 (Fase 1)

> **Objetivo desta fase: olhar, entender, documentar. Nenhuma alteração de código ou banco foi feita.**

## Respostas diretas

| Pergunta | Resposta |
|---|---|
| Qual é a SSOT? | `valores_referencia` (DB) + `exame_parametros` (DB) + réguas em `localStorage` (cliente). |
| Quantas tabelas existem? | **3 tabelas relevantes** + 1 store client-only (réguas). |
| Quantos parâmetros existem? | **239 parâmetros** em 73 exames (prod). |
| Quantos VRs cadastrados? | **165**, distribuídos em apenas **1 exame** distinto. |
| Existem regras duplicadas? | Sim — texto do laudo (`descricao` × `valor_referencia`) e crítico (parâmetro × VR). |
| Existem regras mortas? | `critico_min/max` em `valores_referencia` (0 linhas). |
| Existem campos mortos? | `qtd_caracteres`, `exibir_anterior`, `obrigatorio` em `exame_parametros`. |
| Existe código morto? | Pouco; muito código **legado coexistindo**. |
| Cadastro é intuitivo? | **Não** — 3 modos visuais (Filtro/Matriz/Lista) sem hierarquia, conceitos novos sem onboarding. |
| Pode ser simplificado? | Sim — ver "Arquitetura ideal" abaixo. |

## Arquitetura ideal (mantendo 100% de compatibilidade)

### Banco

1. `valores_referencia`:
   - Substituir `exame_nome` → `exame_id uuid` (FK).
   - Substituir `parametro_nome` → `parametro_id bigint` (FK para `exame_parametros`).
   - Normalizar idade: `idade_min_dias int4`, `idade_max_dias int4` (gerado a partir do legado).
   - Adicionar `classificacao text CHECK ('normal','limitrofe','alterado','critico')` para suportar resultados qualitativos com semântica.
   - Manter `critico_min/max` (planejado) — esconder na UI até virar política.
2. Nova tabela `reguas_etarias` (id, tenant_id, nome, sistema, faixas jsonb).
3. CHECK constraints em `sexo`, `unidade_idade`.

### Aplicação

1. Uma só UI: **Matriz** como canônica; "Lista" só como modo avançado.
2. Eliminar `exame_parametros.valor_referencia` após migração para `valores_referencia.descricao`.
3. Lookup de VR via `Map<exame_id, VR[]>` (boot por tenant em lotes).
4. Históricos: trigger `valores_referencia_history` + tela de auditoria.
5. Permissão fina: `has_permission('valores_referencia.edit')`.

### UX

- Onboarding na matriz (1 frase, 1 tooltip por coluna).
- Unidade herdada do parâmetro (read-only por default).
- Esconder `unidade_idade` (sempre "Anos" ao usuário, dias por trás).
- Sinalizar visualmente cobertura/lacunas e conflitos.

## Custo / risco

- **Compatibilidade**: garantida via migração `text → uuid` lookup-based + view de compatibilidade temporária.
- **Risco clínico**: zero alteração de regras nesta fase.
- **Esforço estimado**: médio (3 sprints) — concentrado em migração + UI única.

## Pergunta final do roadmap

> "É possível torná-lo mais simples sem perder capacidade técnica?"

**Sim.** A capacidade técnica atual é menor do que a complexidade aparente sugere — três UIs e dois campos duplicados podem ser substituídos por uma única matriz canônica com FK e auditoria, sem perder nenhum recurso que esteja realmente em uso hoje.

---

**Fim da Fase 1.** Nenhum código foi alterado. Aguardando aprovação explícita para iniciar Fase 2.
