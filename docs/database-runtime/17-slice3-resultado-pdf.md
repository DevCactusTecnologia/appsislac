# 17 — Slice 3: Resultado + PDF

## Escopo executado

10 edge functions do domínio Resultado + PDF migradas para roteamento tenant-aware seguindo o **Template de Migração de Domínio** (relatório 16).

| Function | Classificação de dados | Primitivo usado |
|---|---|---|
| `sign-resultado` | tenant-scoped (`resultados`, `resultado_assinado`, `resultado_acesso_log`) | `getTenantClient` |
| `assinatura-url` | control-plane + probe tenant | `getPlatformClient` + `getTenantClient` (probe) |
| `comprovante-resolve` | control-plane (público, sem tenant) | `getPlatformClient` |
| `comprovante-shortlink` | tenant-scoped (`comprovante_links`) | `getTenantClient` |
| `image-url` | control-plane + probe tenant | `getPlatformClient` + `getTenantClient` (probe) |
| `integration-pdf-resolve` | RLS-driven (`atendimento_exames`, `integration_pdfs`, `integration_results`) | `getUserTenantClient` |
| `integration-pdf-url` | RLS-driven (`integration_pdfs`) | `getUserTenantClient` |
| `lab-apoio-upload-pdf` | tenant-scoped (`atendimento_exames`, `atendimentos`, `pdf_override_audit`) | `getTenantClient` |
| `upload-assinatura` | control-plane + probe tenant (`profiles`) | `getPlatformClient` + `getTenantClient` (probe) |
| `upload-image` | tenant-scoped (`tenant_lab_config`) + control-plane (`profiles`) | `getTenantClient` + `getPlatformClient` |
| `upload-pdf` | control-plane + probe tenant | `getPlatformClient` + `getTenantClient` (probe) |

> Nota: `comprovante-resolve` é público (sem JWT) e não recebe `tenant_id` no ponto de entrada — permanece control-plane e foi mantido **fora do allowlist do guardrail**. Todas as outras 10 estão no allowlist.

## Decisões locais (dentro do template)

1. **Storage não migra neste slice.** `.storage.from(...)` continua atendendo pelo `getPlatformClient()` (shared). Alinhado com o princípio "não criar `StorageRuntime`" (relatório 11). Migração de Storage será avaliada apenas se houver dor real após dedicated ir para produção.
2. **Probe do tenant em funções puramente control-plane.** `assinatura-url`, `image-url`, `upload-assinatura`, `upload-pdf` chamam `getTenantClient(tenantId)` apenas para validar acessibilidade em modo dedicated — evita "vazamento" silencioso de operações relacionadas a um tenant cujo runtime está degradado. Custo: uma resolução de cache; benefício: HTTP 503 explícito ao invés de sucesso enganoso.
3. **`sign-resultado` mantém leitura de `user_profiles` no control-plane.** É a única fonte confiável para resolver `tenant_id` do usuário nesta função (não foi refatorada; comportamento idêntico ao anterior).

## Fora de escopo

Refatoração de qualquer lógica de negócio, otimização de queries, mudança em `_shared/s3.ts`, `_shared/rateLimit.ts`, `_shared/hardening.ts`. Alterações estritamente limitadas à camada de criação de clients.

## Anti-padrões evitados

- ❌ `StorageRuntime` / `RpcRouter` / `RealtimeRuntime` — nenhum foi criado.
- ❌ Fallback silencioso — todos os pontos lançam HTTP 503 em `MigrationBlockedError`.
- ❌ `tenant_id` vindo do body — em todas as funções o tenant é resolvido server-side via `profiles`.

## Estado

Slice 3 concluído. Guardrail CI passa com 12 funções cobertas (2 do Slice 2 + 10 do Slice 3).
