# 03 — Rule Necessity

Origem por regra (referência: Fase 03 · `04-business-rules.md`).

Legenda origem: **LEG** legislação · **BPL** boas práticas laboratoriais · **OPE** operacional · **FIN** financeira · **CFG** configuração · **TEC** decisão técnica · **HIS** evolução histórica · **?** desconhecida.

| Regra | Origem |
|---|---|
| Protocolo sequencial único por tenant | OPE + BPL |
| `has_permission('criar_atendimento')` | TEC (segurança) |
| Idempotency-key | TEC |
| Justificativa em edição sensível | LEG (RDC rastreabilidade) |
| Janela de edição configurável | CFG |
| Preservação de IDs/estado em update | TEC |
| Prioridade de preço (meta > tabela > própria > 0) | FIN |
| Convênio Particular ID 0 fixo | HIS (convenção herdada) |
| `registrar_coleta`/`analisar_amostras` toggles | CFG |
| Sequência diária de amostra | BPL |
| Suporte MM:SS em exames de tempo | BPL |
| VR por sexo+idade+jejum+risco CV | BPL |
| Fórmulas (ex.: LDL) | BPL |
| Metodologia OECV | BPL |
| Auditoria dupla analisado≠liberado | LEG (RDC) |
| Bloqueio de edição pós-liberação | LEG |
| Cabeçalho com CNES+RT+conselho | LEG (RDC 302) |
| CNPJ válido no recibo | LEG (ANVISA/Receita) |
| Layout de impressão travado | TEC (mem constraint) |
| Marca d'água | CFG |
| Entradas financeiras read-only | TEC (integridade) |
| Estorno com justificativa | FIN + LEG |
| Código FNV-1a de comprovante | TEC |
| PIX QRCode dinâmico + webhook | FIN |
| Cópia de tabela entre convênios | OPE |
| Glosas com motivo | FIN + LEG |
| Política automatic/manual WhatsApp | CFG |
| Token/webhook Meta só Super Admin | TEC (segurança) |
| Opt-out WhatsApp | LEG (LGPD) |
| Circuit breaker por provider | TEC |
| Dead-letter integrações | TEC |
| Idempotência de jobs | TEC |
| `tenant_id NOT NULL` + 4 policies RLS | TEC (multi-tenant) |
| Tenant resolvido server-side | TEC (segurança) |
| Roles em `user_roles` (não em profiles) | TEC (segurança — anti escalonamento) |
| Revalidação super admin em cada edge | TEC |
| Fases de migração sequenciais | TEC |
| Preservação `password_hash` | TEC (UX+segurança) |
| Auditoria de migração | TEC |
| Consentimento LGPD | LEG |
| Direito de deleção | LEG |
| Relatório auditável LGPD | LEG |
| Tools IA filtradas por permissão | TEC |
| `needsApproval` gate | TEC |
| `ai_audit` de execuções | TEC + LEG (rastreabilidade) |
| Ctrl+K busca global | TEC (UX) |
| Redirect `/` conforme role | TEC |

Nenhuma regra ficou classificada como `?`. A grande maioria das regras não-regulatórias é **TEC** por segurança (multi-tenant) ou **CFG** por variar entre laboratórios — o que sugere design intencional, não acidente histórico.
