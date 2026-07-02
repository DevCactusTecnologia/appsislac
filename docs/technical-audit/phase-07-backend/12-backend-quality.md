# 12 — Qualidade do Backend

## Acoplamento
- **Baixo horizontal**: edges independentes; runtime é a única ponte comum.
- **Direcional**: dependências fluem Edge → Shared → RPC → DB (sem ciclos observados).
- **Chokepoints intencionais**: `createClient.ts`, `runtime/db.ts`, `edgeBoot.ts`, `pipeline.ts` — pontos de governança, não pontos de fragilidade.

## Coesão
- Alta em `_shared/` (cada arquivo cobre 1 preocupação).
- Alta nas edges do super-admin plane (verbos claros).
- Média em edges de integração (`integration-dispatch` orquestra vários passos, coeso ao caso de uso).

## Reutilização
- `_shared/runtime/*` reutilizado por 54 edges.
- `_shared/drivers/pipeline.ts` reutilizado por todos os providers de integração lab.
- `_shared/integrationLog.ts` reutilizado por 32+ edges.
- `edgeBoot.ts` reutilizado por 14 edges (potencial não realizado nas 60 legadas).

## Duplicidade
- **CORS headers** replicados manualmente em edges que não usam `edgeBoot` (60 duplicações do mesmo objeto).
- **JWT validate** replicado em edges pré-`edgeBoot` (padrão `admin.auth.getUser(token)`).
- Zero duplicação de resolução de tenant (100% via runtime/db).
- Zero duplicação de criação de cliente SDK (100% via chokepoint).

## Responsabilidades
- Edge = "casca HTTP + orquestração".
- RPC = "lógica transacional + guards de segurança".
- Runtime = "resolução de client".
- Drivers = "protocolo externo".
- Regra respeitada de forma consistente.

## Métricas (evidências)
| Métrica | Valor |
|---|---|
| Edges com SDK direto (violação) | 0 |
| Edges com `try/catch` explícito | ~100% |
| RPCs SECURITY DEFINER com `search_path` fixo | ~100% (padrão observado nas amostras) |
| Migrations sequenciais | 355 |
| Drivers implementando contrato | 2/2 (100% dos ativos) |
