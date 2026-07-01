# 03 — Edge Functions

## Status: EM PLANEJAMENTO (D3 = incremental por domínio)

## Escopo (76 edge functions mapeadas)

Classificação:

- **Control-plane (permanecem no Shared)**: 33 functions
  - Todos os `super-admin-*` (35).
  - `tenant-*` de metadados (runtime-config, healthcheck, resolve, domain-verify, dedicated-login-gate).
  - `leads-manager`, `admin-*`.
- **Data-plane (migrar para `getTenantClient`)**: 43 functions
  - Atendimento (~4): create-atendimento, update-atendimento, extract-requisicao-exames, ai-suggest-exames.
  - Resultado (~4): sign-resultado, assinatura-url, comprovante-*.
  - Financeiro/PDF (~6): upload-pdf, image-url, upload-image, upload-assinatura, integration-pdf-*.
  - Integrações (~14): integration-*, provider-*, lab-apoio-*, dbsync-*.
  - LGPD (~3): lgpd-*.
  - IA (~4): ai-chat, ai-speak, ai-transcribe, ai-suggest-exames.
  - Soroteca (~2): soroteca-*.
  - WhatsApp (~3): whatsapp-*.
  - Outros: sitemap (tenant-scoped), tenant-*.

## Ordem de rollout (D3 aprovada)

| Slice | Domínio | Functions | Validação |
|---|---|---|---|
| S2 | Atendimento | 4 | Playwright: cadastro→coleta→resultado |
| S3 | Resultado + PDF | 10 | Playwright: laudo + assinatura + comprovante |
| S4 | Financeiro/Storage | 6 | Upload/Download signed URL |
| S5 | Integrações + Provider | 14 | Job runner + polling |
| S6 | IA + LGPD + Soroteca + WhatsApp + Sitemap | 9 | Smoke por domínio |

## Guardrail CI (pendente Slice 2)

`scripts/check-data-plane-routing.sh`: falha build se função em `EDGE_DATA_PLANE_ALLOWLIST` importar `getPlatformClient()` direto (sem `getTenantClient`).

## Status Slice 1

| Item | Estado |
|---|---|
| Fundação server (`getTenantClient` real) | ✓ (relatório 02) |
| Codemod data-plane | ✗ pendente |
| Guardrail CI | ✗ pendente |
| Functions migradas | 0 / 43 |
