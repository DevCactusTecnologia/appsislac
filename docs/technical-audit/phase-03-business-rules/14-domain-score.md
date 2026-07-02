# 14 — Domain Score (Matriz de Negócio)

## Matriz Fluxo × Módulos × Regras × Estados × Eventos × Validações × Responsáveis

| Fluxo | Módulos | Regras-chave | Estados | Eventos | Validações | Responsável |
|---|---|---|---|---|---|---|
| Atendimento | Paciente, Convênio, Caixa, Auditoria | Protocolo único, RBAC, idempotency, pricing | aguardando→...→cancelado | atendimento.criado/editado/cancelado | CPF, permissão, tenant, preço | Recepcionista |
| Coleta | Amostras, Materiais | Sequência amostra, config coleta | pendente→coletado→em_analise | amostra.coletada | material obrigatório | Coletador |
| Análise | Exame Parâmetros, VR, Régua etária | VR dinâmico, fórmulas, tempo MM:SS | digitado→analisado | exame.analisado | limites clínicos | Analista |
| Validação/Liberação | Auditoria dupla | analista ≠ validador; bloqueio pós | analisado→liberado | exame.liberado | dupla auditoria | Validador |
| Laudo/Assinatura | Document Engine, Storage | Cabeçalho legal, hash, marca d'água | liberado→assinado | laudo.assinado, laudo.pdf | CNES, RT, CNPJ | Responsável Técnico |
| Entrega | WhatsApp, Portal, Comprovantes | Política notificação, opt-out | assinado→entregue | resultado.entregue | shortlink válido | Sistema/paciente |
| Financeiro | Caixa, Formas/Destinos | Entradas read-only, estorno c/ justificativa | aberto→quitado→estornado | pagamento.registrado/quitado, pix.confirmado | CNPJ recibo, comprovante | Financeiro |
| Convênios | Faturas, Glosas, Competências | Fatura mensal, glosa c/ motivo | aberta→fechada→paga/glosada | fatura.fechada, glosa.registrada | motivo cadastrado | Faturamento |
| Produção/Mapa | Setores, KPIs | Densidade dados | — | métricas atualizadas | filtros | Gestor |
| Estoque | Insumos, Lotes, Fornecedores | Alerta validade, movimentação auditada | ativo→vencido→descartado | insumo.movimentado | lote válido | Estoquista |
| Soroteca | Estrutura, Expurgo | Localização única, expurgo em lote | armazenada→expurgada | expurgo.executado | posição livre | Bioquímico |
| Integrações | Providers, Circuit, Dead-letter | Idempotência, circuit, retries | queued→running→success/dead | integration.job.* | credenciais válidas | Sistema |
| WhatsApp | Outbox, Dispatcher | Policy automatic/manual, opt-out | pending→sent→delivered | whatsapp.enviado | opt-out, template aprovado | Sistema/Operador |
| Auditoria | Todos triggers | Trilha completa | — | audit.* | usuário identificado | Sistema |
| Super Admin | Tenants, Registry | is_super_admin, revalidação | — | tenant.* | role super_admin | Super Admin |
| Migração | Auth, Storage, DB | Fases sequenciais, hash preservado, flip só após smoke | schema→...→isolated_db | migration.* | smoke verde | Super Admin |
| IA | Capabilities, Audit | Permission gate, needsApproval, audit | — | ai.tool.executada | has_permission | Usuário |
| LGPD | Paciente, Auditoria | Consentimento, deleção, opt-out | ativo→revogado→deletado | lgpd.* | consentimento | DPO/Sistema |
| Landing Pública | Leads, Rate-limit | Sem autenticação, rate-limit | nova→convertida | lead.criado | rate-limit | Visitante |
| Recepção Pública | Solicitações | Rate-limit, dedupe | nova→em_atendimento→convertida | solicitacao.* | rate-limit | Visitante |

## Scores por dimensão (0-10, baseado em evidências de auditoria)
| Dimensão | Score | Justificativa |
|---|---|---|
| Cobertura de regras | 9.0 | 20 macroprocessos cobertos com regras explícitas |
| Centralização de regras críticas | 8.5 | Serviços únicos (`pricing`, `policy`, `runtime`) evitam dispersão |
| Consistência de fluxos | 8.5 | Padrão UI→edge→RPC→triggers repetido |
| Transacionalidade | 9.0 | RPCs `*_tx` garantem atomicidade |
| Auditoria/rastreabilidade | 9.5 | 10+ tabelas de auditoria + triggers universais |
| Segurança multi-tenant | 9.5 | RLS + `current_tenant_id()` + roles em tabela separada |
| Governança IA | 9.0 | Permissões + audit + approval gate |
| Extensibilidade fluxo (config-driven) | 8.5 | Coleta/análise/notificação configuráveis |
| Documentação viva (memórias/constraints) | 8.0 | Constraints explícitas evitam regressão |
| **Score agregado** | **8.8** | Excelente consistência geral |
