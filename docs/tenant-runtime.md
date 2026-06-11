# Tenant Runtime & Database strategy

## Tenant Registry
O `tenant_registry` é o Control Plane do SISLAC.
Ele contém:
- `database_strategy`: `shared` ou `dedicated`.
- `runtime_mode`: `shared_db` ou `isolated_db`.
- Metadados de conexão para tenants dedicados.

## Tenant Resolution
1. **Login V2**: O Edge Function `tenant-resolve` identifica o tenant via lab_code, slug ou e-mail.
2. **Frontend**: O `tenantResolver.ts` unifica a descoberta do contexto.
3. **Database-per-Tenant**: Quando em modo `dedicated`, as queries são roteadas para a instância específica.

## Provisionamento
Gerenciado via `tenant-provision`. 
O status é rastreado em `tenant_registry` (`provisioning_status`).
