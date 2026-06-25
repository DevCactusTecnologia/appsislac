# Auditoria de Performance

## Carregamento

- `valoresReferenciaStore._initValoresReferenciaStore` faz `SELECT * FROM valores_referencia ORDER BY id` no boot da aplicação. Hoje 165 linhas → barato; em escala 50k linhas vira problema (carrega tudo na memória do navegador).
- `exameParametrosStore.loadParametros(exameId)` é sob demanda, com cache local. Bom.
- `reguasEtariasStore` lê de `localStorage` — instantâneo, mas não compartilha entre dispositivos.

## Consultas por abertura de "Detalhes do Exame"

1. `exameLayoutsStore` → 1 select por `exame_id`.
2. `exameParametrosStore.loadParametros` → 1 select por `exame_id`.
3. `valoresReferenciaStore` → **0** (já em memória global).
4. `reguasEtariasStore` → 0 (localStorage).

Total: 2 round-trips quando abrir um exame que ainda não foi visitado. Aceitável.

## Lookups

- `resolverReferencia(exameNome, parametroNome, sexo, idade)` percorre `valoresReferencia.filter(...)` → O(N) sobre **todos** os VRs do tenant. Hoje N=165, ok; com 50k vira gargalo (executa por parâmetro em cada laudo).
- `findExamesComChave` faz `ilike` sobre `exame_parametros` (sem index funcional em `lower(chave)`).
- Comparações sempre `.toLowerCase()` no app → não aproveita `idx_valores_referencia_exame`.

## JOINs / FK

- Não existem FK formais entre `valores_referencia.exame_nome` ↔ `exames_catalogo.nome`. Lookups por **texto**.
- Não há JOIN: a relação é resolvida em JavaScript.

## Cache

- 100% client-side, sem invalidação reativa por realtime.
- Risco: dois usuários editando o mesmo exame em janelas diferentes só veem mudança no próximo refresh.

## Oportunidades

| Item | Ganho |
|---|---|
| Trocar `exame_nome` por `exame_id` (uuid) e usar FK | índice eficaz, integridade, possibilita `cascade`. |
| Normalizar idade em dias (`idade_min_dias int4`, `idade_max_dias int4`) | range index, sem parse no app. |
| Index funcional `lower(exame_nome), lower(parametro_nome)` (até a FK chegar) | usa index. |
| Lookup `Map<exameId, ValorReferencia[]>` no boot | O(1) por exame. |
| Mover réguas para tabela `reguas_etarias` | consistência multi-device. |
