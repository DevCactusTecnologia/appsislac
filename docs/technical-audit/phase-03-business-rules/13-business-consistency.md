# 13 — Business Consistency

## Perguntas obrigatórias

### As regras são consistentes?
**Evidência positiva:**
- Regras críticas centralizadas em serviços únicos (`atendimentoPolicy`, `pricing`, `notificationPolicy`, `runtime/db`, `comprovantesValidation`).
- RPCs transacionais (`create_atendimento_tx`, `update_atendimento_tx`) concentram invariantes.
- RLS + `current_tenant_id()` aplicados uniformemente em toda tabela de domínio.
- Fluxo condicional coleta/análise usa mesma fonte (`tenant_lab_config`) na sidebar, guards e wizard.
- Auditoria dupla e justificativa seguem mesmo padrão em atendimento, financeiro e config.

### Os fluxos seguem padrão?
- Padrão observado: **UI → edge function → RPC transacional → triggers de auditoria**.
- Notificações seguem padrão único **produtor → policy → outbox → dispatcher → provider**.
- Integrações seguem padrão único **job → runner → circuit → dead-letter**.
- Multi-tenant sempre resolve tenant server-side.

### Existem módulos utilizando comportamentos completamente diferentes?
- **Financeiro Entradas** é intencionalmente read-only (regra explícita), diferente do padrão CRUD dos demais.
- **Estoque** e **Soroteca** operam de forma quase isolada do fluxo clínico — comportamento próprio, mas coerente com o domínio.
- **Landing pública** e **TenantSite** não seguem o pipeline RLS multi-tenant convencional; usam edge functions públicas com rate-limit — variação justificada.
- **Super Admin** foge do escopo tenant por design.

### Existem regras contraditórias?
- **NÃO É POSSÍVEL AFIRMAR** que existam contradições ativas. As memórias registram pontos historicamente ambíguos (ex.: dashboard legada proibida, layout de impressão travado, PWA removido) tratados via constraints explícitas. Não há evidência no código atual de duas regras concorrentes para o mesmo comportamento.
- Duplicações de validação (CPF, permissão, tenant) existem como **defesa em profundidade** — não são contradições.

## Conclusão de consistência
As evidências mostram padrão arquitetural repetido através do domínio, com desvios documentados e justificados por regra de negócio. Não foram observadas regras em conflito direto.
