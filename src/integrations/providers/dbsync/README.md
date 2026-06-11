# DBSync — DB Diagnósticos

Provider isolado, registrado mas **inativo por padrão**.

## Status atual (Rodada 1 — Scaffold)

- ✅ Capabilities declaradas
- ✅ Transport SOAP (mock + skeleton HTTP)
- ✅ Envelopes: `RecebeAtendimento`, `ConsultaStatusAtendimento`
- ✅ Parser básico
- ✅ Status adapter DB → canônico SISLAC
- ✅ Modelo `ExternalLabelData`
- ✅ Feature flag `dbsync_enabled` (default OFF)

## NÃO implementado nesta rodada

- ❌ Workflow MPP / pendências
- ❌ Recoleta automatizada
- ❌ Rastreamento logístico
- ❌ Render de etiqueta (ZPL/EPL)
- ❌ Integração com `integration-dispatch` (dispatcher continua rejeitando DBSYNC)
- ❌ Migrações destrutivas no banco

## Regras invioláveis

1. Não importar nada de `providers/hermes-pardini/`.
2. Não acoplar `if (provider === 'DBSYNC')` em UI/timeline/warnings — usar `getCapabilities()`.
3. Credenciais SEMPRE cifradas (mesma rotina `_shared/crypto.ts`).
4. Status DB nunca chega cru ao frontend — sempre via `DBSyncStatusAdapter`.
5. Ativação por tenant via feature flag `dbsync_enabled`.