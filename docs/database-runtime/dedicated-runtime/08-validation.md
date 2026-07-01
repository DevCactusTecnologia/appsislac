# 08 — Validation

## Status: PLANEJADO — execução no Slice 6

## Estratégia

Playwright suite `e2e/dedicated-runtime/` com 3 perfis:

| Perfil | Tenant | Dataset |
|---|---|---|
| P (pequeno) | 100 pacientes, 500 atendimentos | Smoke rápido |
| M (médio) | 5k pacientes, 30k atendimentos | Performance real |
| G (grande) | 50k pacientes, 300k atendimentos | Stress + load |

## Cenários obrigatórios

- Login (issuer Shared, JWT válido no Dedicated).
- Cadastro paciente → INSERT no Dedicated.
- Novo atendimento → sequences (guia/protocolo) do Dedicated.
- Resultado → cálculo VR, assinatura, laudo PDF.
- Financeiro → pagamento, comprovante, PIX.
- Storage → upload assinatura + download signed URL (do bucket dedicado).
- Realtime → atualização em outra aba/dispositivo.
- WhatsApp → outbox + template.
- Auditoria → log gravado no dedicated.
- IA → chat + sugestão exames (chamadas continuam globais).
- Integrações → job + polling + circuit breaker.

## Aceitação

- 0 regressões em tenant Shared existente.
- 0 leituras/escritas indevidas no Shared para dados operacionais do tenant Dedicated (validado via `pg_stat_statements` + logs de query).

## Status

| Item | Estado |
|---|---|
| Suite E2E | ✗ pendente |
| Dataset fixtures P/M/G | ✗ pendente |
| Verificador de cross-writes | ✗ pendente |
