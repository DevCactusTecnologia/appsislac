# Document Engine & Edge Functions

## Document Engine
O SISLAC possui um motor de renderização de documentos (laudos, etiquetas, protocolos).
- Templates em `documento_templates`.
- Renderização via `laudoResolver.ts` e `documentoRenderer.ts`.

## Edge Functions Rationalization
As funções seguem o padrão:
- `_shared`: Código comum (CORS, Auth, Errors).
- Tratamento de Multi-tenant via cabeçalhos ou tokens.

### Principais Funções
- `tenant-resolve`: Roteamento de login.
- `integration-jobs-runner`: Processamento de exames terceirizados.
- `whatsapp-send`: Notificações.

## Cron Jobs
Gerenciados via `pg_cron` chamando Edge Functions.
A saúde é monitorada em `cron_health`.
