# 06 — Drivers

Contrato: `ProviderDriver` em `_shared/drivers/types.ts`.
```
interface ProviderDriver {
  provider: IntegrationProviderId;
  capabilities: ServerCapabilities;
  dispatch(ctx: DriverContext): Promise<DriverOutcome>;
}
```

## Inventário
| Driver | Arquivo | Contrato | Capabilities |
|---|---|---|---|
| Hermes-Pardini | `_shared/drivers/hermes-pardini/driver.ts` | `ProviderDriver` (`HERMES_PARDINI`) | send_order, polling, fetch_pdf, fetch_pending |
| DB Diagnósticos | `_shared/drivers/dbsync/driver.ts` | `ProviderDriver` (`DB_DIAGNOSTICOS`) | send_order, polling, fetch_pdf |
| Transports | `_shared/drivers/transports/index.ts` | Fetch com timeout/DNS/TLS retry (compartilhado) | n/a |

Providers declarados no enum mas **sem driver server**: `ALVARO`, `SABIN`, `DASA`, `FLEURY`, `PIXEON`, `HL7`, `FHIR`, `CUSTOM` (planejados/UI-only).

## Outros drivers de infraestrutura (fora do contrato de integração lab)
| Domínio | Local | Contrato |
|---|---|---|
| PIX (BR Code) | `src/lib/pixBrCode.ts` (frontend) | função pura |
| IA | Lovable AI Gateway via `ai-*` edges | HTTP JSON |
| Storage | `_shared/s3.ts` + edges de upload | Supabase Storage SDK |
| Email | Não há driver dedicado (Supabase Auth email flows) | n/a |
| WhatsApp | `whatsapp-dispatcher/-webhook/-template-sync` | HTTP (Meta Cloud API) — sem contrato ProviderDriver |

## Observações
- Somente integrações laboratoriais utilizam o contrato formal `ProviderDriver`.
- IA / WhatsApp / PIX seguem contratos ad-hoc por conta de cada canal ter semântica distinta.
- Credenciais decifradas em `_shared/drivers/credentials.ts` antes de entregar `DriverContext.credentials`.
