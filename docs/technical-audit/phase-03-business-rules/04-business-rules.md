# 04 — Business Rules

Classificação: **[OBR]** obrigatória, **[OPC]** opcional, **[CFG]** configurável, **[REG]** regulatória, **[OPE]** operacional, **[FIN]** financeira, **[LAB]** laboratorial, **[AUD]** auditoria, **[SEC]** segurança, **[INT]** integração.

## Atendimento
- [OBR][OPE] Todo atendimento gera `protocolo` sequencial único (tenant).
- [OBR][SEC] `create_atendimento_tx` valida `has_permission('criar_atendimento')`.
- [OBR][OPE] `idempotency_key` previne duplicação em reenvios.
- [OPE][AUD] Edição sensível (finalizado/cancelado/fora janela) exige justificativa — gravada em `atendimento_audit.justificativa` via `set_audit_justificativa`.
- [CFG] Janela de edição = `app_settings.edit_window_hours` (default 24h).
- [OPE] Edição preserva IDs/estados de exames existentes (RPC `update_atendimento_tx`).

## Precificação
- [OBR][FIN] Prioridade: `metaValor` persistido > tabela convênio > "Própria" > 0. Nunca chutar.
- [OPE] Convênio "Particular" tem ID 0 fixo.

## Coleta / Análise
- [CFG] `tenant_lab_config.registrar_coleta` liga/desliga etapa; sidebar redireciona.
- [CFG] `tenant_lab_config.analisar_amostras` idem.
- [OBR][LAB] Sequência amostra por dia (`amostra_sequence`).
- [OBR][LAB] Suporte tempos MM:SS para exames de coagulação/VHS.

## Valores de Referência
- [OBR][LAB] VR resolvido por sexo + idade + jejum + risco CV.
- [OPC][LAB] Fórmulas (ex: LDL calculado).
- [REG] Metodologia OECV consolidada em `reguas_etarias`.

## Auditoria dupla
- [OBR][AUD] Analisado (analista) ≠ Liberado (validador). Bloqueia edição após liberação.
- [OBR][AUD] Todos triggers gravam usuário/timestamp; alterações pós-finalização → `pos_finalizacao=true`.

## Assinatura / Laudo
- [OBR][REG] Cabeçalho contém CNES + RT + conselho/UF (validado por `validarLaboratorioParaComprovante`).
- [OBR][REG] CNPJ válido obrigatório para recibo de pagamento (RDC ANVISA 302/2005).
- [OBR][LAB] Layout de impressão travado (mem constraint).
- [OPC] Marca d'água global configurável.

## Financeiro
- [OBR][FIN] Entradas são read-only (derivadas de atendimento).
- [OBR][FIN] Estornos requerem justificativa (`financeiro_estornos`).
- [OBR][FIN] Comprovante gera código FNV-1a determinístico.
- [CFG][FIN] PIX QRCode dinâmico por atendimento; webhook confirma.

## Convênios
- [OPE] Copiar tabela de preço entre convênios permitido.
- [OBR][FIN] Glosas exigem motivo cadastrado.

## Notificações WhatsApp
- [CFG] Por tenant: `automatic|manual` por tipo (resultado, recoleta, orçamento, atendimento, agendamento, consulta).
- [OBR][SEC] Token/número/webhook Meta exclusivos Super Admin.
- [OBR] Opt-out respeitado (`whatsapp_opt_out`).

## Integrações
- [OBR][INT] Circuit breaker por provider.
- [OBR][INT] Dead-letter após N tentativas.
- [OBR][INT] Idempotência de jobs.

## Multi-tenant / Segurança
- [OBR][SEC] `tenant_id` NOT NULL em toda tabela de domínio; RLS 4 policies obrigatórias.
- [OBR][SEC] Tenant resolvido server-side (`current_tenant_id()`); frontend jamais envia.
- [OBR][SEC] Roles em `user_roles` (nunca em `profiles`).
- [OBR][SEC] Super admin exige revalidação em cada edge function.

## Migração
- [OBR][SEC] Fases sequenciais; `runtime_mode` só muda após smoke verde.
- [OBR] Preservação de `password_hash` (senhas intactas).
- [OBR] Auditoria em `tenant_migration_runs` / `tenant_migration_log`.

## LGPD
- [OBR][REG] Consentimento registrado.
- [OBR][REG] Direito de deleção (`lgpd-deletar-paciente`).
- [OBR][REG] Relatório auditável (`lgpd-auditoria-relatorio`).

## IA
- [OBR][SEC] Tools filtradas por `has_permission`.
- [OBR][SEC] `needsApproval` gate na UI para ações sensíveis.
- [OBR][AUD] Toda execução → `ai_audit`.

## Rotas / Navegação
- [OBR] `/` = Landing pública; autenticado redireciona pra `/dashboard` ou `/super-admin`.
- [OBR] Ctrl+K = busca global.
