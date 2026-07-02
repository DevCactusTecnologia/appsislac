# 11 — Padronização

## Existe padrão único?
**Sim**, um padrão arquitetural claro:
- Chokepoint SDK único (`_shared/runtime/createClient.ts`) — 100% de conformidade (0 imports diretos).
- Resolução tenant sempre server-side (`profiles.tenant_id` + `tenant_registry`).
- `edgeBoot` como bootstrap canônico (opt-in, adoção parcial — 14/74).
- Contrato `ProviderDriver` obrigatório para integrações laboratoriais.
- Sufixos RPC padronizados (`_tx`, `_page`, `_kpis`, `audit_*`, `is_*`, `circuit_*`, `super_admin_*`).

## Convenções observadas
| Área | Convenção |
|---|---|
| CORS | `corsHeaders` reexportado de `edgeBoot` |
| Auth | `Authorization: Bearer` verificado via `getUser` (nunca decodificado localmente) |
| Correlation | `x-correlation-id` propagado em header + log + response |
| Erros | `{ error, correlation_id }` JSON + status HTTP semântico |
| Logs | `integration_logs` estruturado (level, message, context) |
| Nomes de edges | `<dominio>-<acao>` (`super-admin-*`, `integration-*`, `ai-*`, `lgpd-*`) |
| Nomes de RPC | snake_case com sufixo de intenção |
| RLS | `current_tenant_id()` + `is_super_admin()` + `has_permission()` |

## Exceções catalogadas
1. **60 edges legadas** ainda não migradas para `edgeBoot` (têm try/catch local — funcional, mas duplica CORS/JWT).
2. **`whatsapp-webhook`, `tenant-resolve`, `sitemap`, `leads-manager`, `whatsapp-template-sync`** — públicas (sem JWT) por design.
3. Providers `ALVARO/SABIN/DASA/FLEURY/PIXEON/HL7/FHIR/CUSTOM` — declarados no enum mas sem driver server (placeholders).
4. `integration-jobs-runner` combina scheduling + dispatch (justificado).

## Uniformidade
- **Runtime**: uniforme (100%).
- **Edge bootstrap**: parcial (19%).
- **Contratos de integração**: uniforme para labs (100%); ad-hoc para IA/WhatsApp (por natureza do canal).
- **RPC**: uniforme (~99%).
