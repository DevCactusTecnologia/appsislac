# 11 — Failover & Isolamento

- Banco único → SPOF total. Se o projeto shared cair, 100% dos tenants caem.
- Não há réplica leitura/escrita, nem health-check por tenant que dispare degradação seletiva.
- `tenant_registry.runtime_status='suspended'` é checado em `tenantConnection.ts:57-59` mas só para o caminho `dedicated` (que não funciona).
- Não há circuit-breaker no acesso a Postgres (existe `circuit.ts` mas é para integrações de laboratório externas, não DB).

Isolamento entre tenants: hoje é puramente lógico (RLS). Em DB-per-tenant real haveria isolamento físico — não implementado.
