# Estoque 2.1 — Hardening e Simplificação

Plano de execução em fases. Cada fase é independente e pode ser revertida. Sem novas features (compras, pedidos, transferências, etc.) — apenas fechar furos e simplificar.

## Fase 2.1 — Saldo somente-leitura + "Definir saldo"

**Frontend:**
- `LoteDialog.tsx`: campo `quantidade_inicial` permanece editável apenas na criação. Em modo edição, vira somente-leitura com texto "Para alterar saldo, use Movimentação".
- `MovimentacaoDialog.tsx`: renomear tipo `ajuste` para rótulo "Definir saldo". UI passa a pedir **"Saldo correto"** em vez de delta. Sistema calcula `delta = saldo_correto - quantidade_atual` e envia movimentação `ajuste` com esse delta. O backend continua recebendo `ajuste` (não muda schema).

## Fase 2.2 — Histórico imutável

**Migration:**
- DROP POLICY de DELETE em `estoque_movimentacoes`.
- Remover botão/ação de excluir movimentação no frontend (se existir).

## Fase 2.3 — Cron diário de validade

**Insert (não migration — contém URL/anon key):**
- Habilitar `pg_cron` + `pg_net` (migration separada apenas para extensions, se ainda não habilitadas).
- `cron.schedule('estoque-marcar-vencidos', '0 1 * * *', ...)` chamando a RPC `estoque_marcar_lotes_vencidos()` via `net.http_post` para uma edge function fina OU via `SELECT public.estoque_marcar_lotes_vencidos()` direto. Vou usar SELECT direto (mais simples, sem edge function nova).

## Fase 2.4 — CHECK constraints

**Migration:**
```sql
ALTER TABLE estoque_lotes ADD CONSTRAINT estoque_lotes_status_check
  CHECK (status IN ('ativo','esgotado','vencido','descartado'));
ALTER TABLE estoque_movimentacoes ADD CONSTRAINT estoque_movimentacoes_tipo_check
  CHECK (tipo IN ('entrada','saida','ajuste','descarte'));
```
Validar dados existentes antes; normalizar qualquer linha fora do conjunto.

## Fase 2.5 — KPIs: 5 → 4

**Frontend (`src/pages/Estoque.tsx`):**
- Unificar "Vencidos" + "Vencendo (≤30d)" em **"Validade Crítica"** (soma).
- Manter: Total de Insumos · Lotes Ativos · Validade Crítica · Estoque Baixo.
- Manter DecisionPanel intacto.

## Fase 2.6 — Permissões alinhadas

**Frontend:**
- Trocar permissão de menu/rota de `/estoque` de `configuracoes_sistema` para verificação de role `admin` (mesmo critério da RLS). Quem não é admin não vê o menu.
- Ajustar `AppSidebar.tsx` e `App.tsx`.

## Fase 2.7 — Proteger histórico de lotes

**Migration:**
- `ALTER TABLE estoque_lotes DROP CONSTRAINT … FOREIGN KEY (insumo_id)` e recriar como `ON DELETE RESTRICT`.
- Mesmo tratamento para `estoque_movimentacoes` → `estoque_lotes`/`estoque_insumos` se hoje for CASCADE.

## Fase 2.8 — Limpeza cirúrgica

- Manter `estoque_marcar_lotes_vencidos` (passa a ser usada pelo cron — não é mais órfã).
- Verificar uso de `idx_estoque_insumos_categoria` e `idx_estoque_insumos_nome` via `pg_stat_user_indexes`. Só dropar se `idx_scan = 0` há tempo relevante.

## Resultado esperado

- Saldo só muda via movimentação rastreável.
- Histórico imutável.
- Vencimento automático todo dia 01:00.
- Status e tipos validados no banco.
- 4 KPIs claros + DecisionPanel.
- Menu coerente com RLS.
- Histórico de lotes protegido contra delete em cascata.

## Ordem de execução

1. Migrations (2.2 + 2.4 + 2.7) em uma única migration.
2. Insert do cron (2.3).
3. Edits de frontend (2.1 + 2.5 + 2.6).
4. Verificação de índices (2.8) — informar resultado, não dropar sem confirmação.

Aguardando "ok" para executar.
