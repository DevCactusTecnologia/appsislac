## Valores de Referência 2.0 — Fase 2

Mudança estrutural grande (banco + stores + UI + cleanup). Antes de executar, preciso da sua aprovação explícita do plano abaixo — conforme regra do projeto para mudanças estruturais.

### Princípio
SSOT única por conceito. Matriz como interface canônica. Sem regressão funcional.

---

### Etapa 1 — SSOT definitiva (eliminar duplicações)

| Conceito | Hoje (2 fontes) | Depois (1 fonte) |
|---|---|---|
| Texto do laudo | `exame_parametros.valor_referencia` **e** `valores_referencia.descricao` | apenas `valores_referencia.descricao` |
| Crítico | `exame_parametros.critico_min/max` **e** `valores_referencia.critico_min/max` | apenas `valores_referencia.critico_min/max` (com linha "default" sexo=Ambos/idade aberta) |
| Unidade | `exame_parametros` (não existe) + `valores_referencia.unidade` | `valores_referencia.unidade` (já é a única) |

**Migração de dados**: backfill copia `exame_parametros.valor_referencia` e `critico_min/max` para uma linha default em `valores_referencia` quando não houver VR cadastrada; depois drop das colunas.

### Etapa 2 — Matriz como interface canônica
- `FiltrosDialog` (embedded em `DetalhesExameDialog`) passa a abrir direto em **Matriz**.
- Modo **Lista** vira "modo avançado" colapsado atrás de um toggle "Avançado".
- Modo **Filtro** removido (filtros — sexo, faixa etária — vão para o cabeçalho da própria matriz).

### Etapa 3 — Normalização (FKs)
- `valores_referencia.exame_id uuid REFERENCES exames_catalogo(id)`
- `valores_referencia.parametro_id uuid REFERENCES exame_parametros(id) ON DELETE CASCADE`
- Backfill via JOIN por `lower(exame_nome)`/`lower(parametro_nome)`.
- Após backfill: `exame_nome`/`parametro_nome` ficam `NULL`able e marcados deprecated; drop em migration final desta fase quando todos consumidores estiverem migrados.
- Índices: `(parametro_id)`, `(exame_id, parametro_id)`.

### Etapa 4 — Idade em dias (internamente)
- Adicionar `idade_min_dias int`, `idade_max_dias int` em `valores_referencia`.
- Backfill convertendo `idade_min/max + unidade_idade` → dias (helper `idadeParaDias` já existe).
- Resolver passa a comparar inteiros (sem `parseFloat` por linha).
- UI continua mostrando Dias/Meses/Anos automaticamente (usa `formatIdade`).
- Colunas `idade_min/max/unidade_idade` removidas após validação.

### Etapa 5 — Réguas etárias persistentes
- Nova tabela `reguas_etarias(id, tenant_id, nome, sistema bool, faixas jsonb, created_at, updated_at)`.
- GRANTs + RLS (`current_tenant_id()` + `is_super_admin`).
- Migrar dados de `localStorage` é inviável server-side; cliente faz upload one-shot na primeira carga após login (best-effort, logado).
- `reguasEtariasStore` reescrita para Supabase; presets continuam código.

### Etapa 6 — Parâmetros (limpeza de campos)
- Validar consumidores via `rg`. Confirmado sem uso funcional:
  - `qtd_caracteres`, `exibir_anterior`, `exibir_mapa`, `chave_apoio` → **remover**.
  - `obrigatorio`, `visivel` → **manter** (têm uso potencial óbvio, esconder no formulário avançado).
- `valor_referencia` (texto livre) → **remover** (SSOT é `valores_referencia.descricao`).

### Etapa 7 — Valores de referência (campos novos justificados)
- Adicionar: `ordem int default 0`, `ativo bool default true`, `observacao text`.
- Não adicionar `cor`/`prioridade` (sem consumidor real hoje).

### Etapa 8 — Detecção de conflitos
- Função TS `detectarConflitosVR(parametroId)` que retorna lista de overlaps de (sexo × faixa etária).
- UI: badge vermelho na linha conflitante + tooltip com a contraparte; impede salvar conflito duro (faixas idênticas).

### Etapa 9 — UX da matriz
- 1 tela só: cabeçalho com colunas (régua etária), linhas por sexo, células editáveis inline.
- Botão "Régua etária" no topo, "Adicionar observação", toggle "Avançado" (lista).

### Etapa 10 — Performance
- `valoresReferenciaStore` mantém 2 índices em memória: `Map<parametroId, ValorReferencia[]>` e `Map<exameId, ...>`.
- `resolverReferencia(parametroId, sexo, idadeDias)` → O(k) na faixa, sem `toLowerCase`.
- Resolver atual por nome vira shim deprecated (1 release) e depois removido.

### Etapa 11 — Auditoria
- Reaproveitar `audit_logs` existente. Trigger em `valores_referencia`, `exame_parametros`, `reguas_etarias` registrando `op`, `old`, `new`, `user_id`, `tenant_id`.

### Etapa 12 — Segurança
- Nova permissão `valores_referencia.edit` em `has_permission()`.
- RLS de UPDATE/DELETE/INSERT em `valores_referencia` exige `has_permission(auth.uid(),'valores_referencia.edit')` além do tenant.
- Admin/manager recebem a permissão por padrão.

### Etapa 13 — Cleanup
- Remover: `FiltrosPorPerfil.tsx` (não consumido), `GerenciarReguasDialog` (substituído), helpers `idadeFaixas` legados não usados após Etapa 4, branch "Filtro" do `FiltrosDialog`.
- Remover do `exameParametrosStore` os campos dropados.

### Etapa 14 — Governança
- Documentar SSOT, pipeline, fluxo, FKs em `docs/valores-referencia-2.0/phase2-governance-report.md`.

---

### Ordem de execução (migrations atômicas)

```text
M1: add valores_referencia.exame_id, parametro_id (nullable) + backfill + índices
M2: add valores_referencia.idade_min_dias/max_dias + backfill
M3: add valores_referencia.ordem/ativo/observacao
M4: create reguas_etarias + RLS + GRANTs
M5: add permission 'valores_referencia.edit' + tighten policies
M6: audit triggers (valores_referencia, exame_parametros, reguas_etarias)
M7: drop colunas legadas (exame_nome, parametro_nome, idade_min/max, unidade_idade
    em valores_referencia; valor_referencia, qtd_caracteres, exibir_anterior,
    exibir_mapa, chave_apoio, critico_min/max em exame_parametros)
```

Cada migration roda separadamente com aprovação. M7 só depois de **todos** os consumidores atualizados em código + smoke test manual.

### Validação
- `bun run build`, `tsgo`, `bunx vitest run`, Playwright headless: criar VR → digitar resultado → ver crítico → imprimir laudo → conferir placeholders `##REF_X##`/`##FLAG_X##`.

### Relatórios entregues no fim
`docs/valores-referencia-2.0/phase2-{schema,ui,performance,cleanup,security,governance,final}-report.md`.

---

### Riscos
- Drop de colunas legadas (M7) é irreversível sem backup — só após validação completa.
- Migração `localStorage → reguas_etarias` depende do cliente logar; presets de fábrica garantem que não fica vazio.
- Permissão nova pode bloquear usuários existentes — script de seed concede a admin/manager no mesmo M5.

Confirma para eu disparar **M1** (FKs + backfill)? Ou quer ajustar algo do plano antes?
