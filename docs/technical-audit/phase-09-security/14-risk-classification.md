# 14 — Risk Classification

## CRÍTICO
_(nenhum achado com exploração trivial + impacto sistêmico confirmado)_

## ALTO
| ID | Achado | Fonte |
|---|---|---|
| A01 | JWT/refresh armazenado em `localStorage` — XSS-hijack sem HttpOnly | 02, 13-P02 |
| A02 | MFA opcional inclusive para super_admin | 02, 07 |
| A03 | Policy `doc_templates_demo_anon_select` permite `anon SELECT` em `documento_templates` | 04 |
| A04 | Ausência de portal do titular LGPD (Art. 18) | 11-L01 |
| A05 | Sem job automatizado de anonimização a pedido do titular | 11-L02 |
| A06 | Sanitização de SVG em uploads não confirmada | 09-U01 |

## MÉDIO
| ID | Achado |
|---|---|
| M01 | Buckets `tenant-site`/`tenant-assets` `public=true` — enumeração de path |
| M02 | Ausência de antivírus/mime-sniff server-side em uploads |
| M03 | Rate-limit in-memory bypassável por concorrência de isolates |
| M04 | Sem rotação automática de service-role |
| M05 | Retenção clínica (CFM 20 anos) sem enforcement técnico |
| M06 | Impersonation sem step-up MFA |
| M07 | Auth logs não espelhados na aplicação (só GoTrue interno) |
| M08 | Enumeração de usuários no signup GoTrue |

## BAIXO
| ID | Achado |
|---|---|
| B01 | HSTS aplicacional não confirmado (mitigado pelo edge Supabase) |
| B02 | CORS `*` em edges autenticadas (mitigado por JWT em header) |
| B03 | Logs sem hash-chain (WORM) |

## INFORMATIVO
| ID | Achado |
|---|---|
| I01 | `.env` contém apenas publishable key — correto |
| I02 | 373 policies RLS; 116 tabelas tenant-aware |
| I03 | 74 Edge Functions, 200 RPCs — governança consistente |

## INCONCLUSIVO
| ID | Item |
|---|---|
| X01 | Assinatura de `whatsapp-webhook` |
| X02 | Policies do bucket `assinaturas` |
| X03 | Realtime broadcast/presence enforcement |
| X04 | `npm audit` (componentes vulneráveis) |
| X05 | SSRF em edges com fetch externo |
| X06 | Grants individuais de todas as 200 RPCs a `anon` |
| X07 | Allowlist de extensão em buckets públicos |
| X08 | Limite de tamanho por endpoint de upload |
| X09 | Completude do `super_admin_impersonation_log` |
