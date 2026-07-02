# 11 — LGPD

## Dados pessoais (Art. 5º I)
- Pacientes: nome, CPF, RG, data nascimento, sexo, endereço, telefone, email, foto.
- Usuários operacionais: nome, email, CPF, CRM/COREN, assinatura digital.
- Leads/inscrições: nome, email, telefone, senha_hash.

## Dados sensíveis (Art. 5º II)
- **Saúde**: resultados de exames, laudos, histórico clínico, conclusões diagnósticas.
- Biometria: assinatura digitalizada (grafismo).

## Base legal
- Execução de contrato (paciente-lab).
- Cumprimento de obrigação legal (RDC/CFM).
- Consentimento (marketing / integração).
- Não auditado: existência de política de privacidade publicada e termo de aceite versionado.

## Trilha de auditoria
- Tabelas de auditoria confirmadas: `platform_audit`, `atendimento_audit`, `financeiro_audit`, `storage_audit`, `tenant_migration_runs`, `integration_logs`.
- Auditoria dupla (Analisado/Liberado) em resultados.
- Impersonation: `super_admin_impersonation_log` (verificar existência formal).

## Controle de acesso
- RLS por tenant + RBAC por papel + `has_permission` fine-grained.
- Segregação: exames financeiros/clínicos separados por tabela e policy.

## Direitos do titular (Art. 18)
- **Acesso**: paciente não tem portal para self-service. Solicitação via lab.
- **Correção**: via operador.
- **Anonimização/Eliminação**: não confirmado job/RPC de expurgo por CPF.
- **Portabilidade**: exportação de laudo em PDF/JSON existe parcial.

## Expurgo
- `super-admin-purge-tenant-from-shared` — expurgo de tenant.
- Retenção clínica: **prontuário deve ser 20 anos (CFM 1.821/2007)** — sem job automático de purge por período.

## Achados
| # | Item | Severidade |
|---|---|---|
| L01 | Ausência de portal do titular (Art. 18) | ALTO |
| L02 | Sem job automatizado de anonimização a pedido | ALTO |
| L03 | Retenção clínica sem enforcement técnico | MÉDIO |
| L04 | Log de impersonation — verificar completude | MÉDIO |
| L05 | Consentimento granular (marketing vs operacional) — não confirmado | MÉDIO |
