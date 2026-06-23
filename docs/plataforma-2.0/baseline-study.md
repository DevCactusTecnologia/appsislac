# Plataforma 2.0 — Fase 14: Estudo de Baseline Futuro

> Exercício conceitual. **Nenhum baseline é criado.**

## Pergunta
Se o SISLAC fosse instalado hoje em um banco virgem, **quantas migrations seriam realmente necessárias?**

## Resposta
Aproximadamente **35–45 migrations** (versus 292 atuais).

## Composição proposta (Baseline 1.0)

| Camada     | Migrations | Conteúdo |
|------------|-----------:|----------|
| Fundação   | 3 | Roles enum + `user_roles` + `has_role`; profiles + `handle_new_user`; multi-tenant base (`tenants`, `current_tenant_id`, `is_super_admin`, `has_permission`). |
| Core       | 8 | Sequências + auditoria base (operational/platform/financeiro); rate limit; cron health; provider circuit; storage audit; integration framework; saas/subscription. |
| Domínios   | 18 | Uma migration por domínio com tabelas + RLS + triggers + grants consolidados: pacientes; atendimentos+exames+pagamentos; exames_catalogo+layouts+parametros+pops+valores_referencia+tabela_preco; materiais+amostras+alocacoes+emprestimos+movimentacoes+expurgo; estoque (insumos+lotes+movimentacoes+fornecedores+locais); financeiro (saidas+formas+destinos+tipos+estornos+caixa+competencias); convenios+faturas+itens+glosas; mapas+resultados; whatsapp (outbox+mensagens+templates+opt_out+metrics); integrações (12 tabelas em 1 migration); documento_templates; galerias+posicoes; unidades+setores; select_options+motivos+recoletas_motivos+labs_apoio; orcamentos; tenant_* (pages, settings, blocklist, lab_config); inscrições+solicitações públicas; geo (states+cities). |
| Evoluções  | 6 | RDC 786/2023 snapshot regulatório; super-admin guards; competências fechadas guards; portal público; `match_tuss_v2`; interface readiness fields. |

**Total estimado:** ~35 migrations + ~10 seeds = **~45 arquivos**.

## Ganho potencial

| Métrica | Hoje | Baseline 1.0 |
|---------|-----:|-------------:|
| Migrations | 292 | ~45 |
| Tempo de `db reset` | minutos | segundos |
| Onboarding novo dev | confuso | linear |
| Reprodutibilidade | OK | excelente |

## Riscos

- Perda de histórico fino (mitigado: histórico permanece em git/arquivos).
- Esforço de validação para garantir paridade 1:1 com banco atual.
- Quebra de dumps existentes que dependem de ordem de migrations.

## Recomendação conceitual
Vale a pena criar **Baseline 1.0** quando o domínio atual estabilizar por ≥ 30 dias sem migrations estruturais novas. **Não criar agora.**
