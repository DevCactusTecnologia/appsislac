# Metrics Model

## Princípio
A Plataforma de Inteligência **prova seu valor por métricas operacionais**, não por engajamento conversacional. Tempo economizado e cliques eliminados > mensagens trocadas.

## Métrica soberana
**`ai_time_saved_seconds` — Tempo operacional economizado para o laboratório.**

Esta é a principal métrica da Plataforma. Todas as demais (mensagens, prompts, duração de conversa, adoção) são **secundárias** e existem apenas para diagnosticar problemas que afetem a métrica soberana. Nunca otimizar para volume de conversa.

## Métricas obrigatórias (GA)
### Execução
| Métrica | Descrição | Fonte |
|---|---|---|
| `ai_actions_executed_total` | Total de Actions executadas com sucesso | `ai_audit` |
| `ai_actions_failed_total` | Total de Actions com erro | `ai_audit` |
| `ai_informative_responses_total` | Respostas sem Action (apenas texto) | `ai_messages` (flag) |
| `ai_quick_actions_used_total` | Disparos de Ações Rápidas | `ai_audit` (origin) |
| `ai_suggestions_accepted_total` | Hints clicados | `ai_audit` (origin) |
| `ai_suggestions_dismissed_total` | Hints dispensados | telemetria |

### Eficiência
| Métrica | Cálculo | Meta inicial |
|---|---|---|
| `ai_time_saved_seconds` | `Σ (baseline_seconds - ai_duration_seconds)` por Action; baseline declarado na Skill | ≥ 30s/Action |
| `ai_clicks_saved` | `Σ baseline_clicks - 1` por Action (sempre é 1 clique no Avatar/chip) | ≥ 2 cliques/Action |
| `ai_avg_duration_ms` | Tempo do clique à conclusão | < 3s p50, < 8s p95 |

### Qualidade
| Métrica | Cálculo | Meta |
|---|---|---|
| `ai_confirmation_rate` | `approved / (approved + cancelled)` em Actions com `needsApproval` | > 80% |
| `ai_cancellation_rate` | `cancelled / total_with_approval` | < 20% |
| `ai_success_rate` | `executed_ok / executed_total` | > 95% |
| `ai_retry_rate` | Actions repetidas em <30s pelo mesmo usuário | < 5% |

### Adoção
| Métrica | Descrição |
|---|---|
| `ai_active_users_daily` | Usuários únicos com ≥1 interação no dia |
| `ai_actions_per_user_day` | Média diária |
| `ai_skills_usage_breakdown` | Distribuição por Skill |
| `ai_actions_usage_breakdown` | Top 20 Actions |

## Declaração obrigatória por Skill/Action
Toda Skill/Action declara seu baseline operacional:
```ts
metrics: {
  baselineSeconds: 45,    // tempo manual estimado
  baselineClicks: 6,      // cliques manuais estimados
  category: "read" | "write" | "automation",
}
```
Sem essa declaração, a Skill **não é aceita** em revisão (governance).

## Armazenamento
- Tabela `ai_audit` é fonte primária; agregações materializadas em `ai_metrics_daily` (job diário).
- Dashboard Super Admin: visão por tenant, por usuário, por Skill.
- Dashboard tenant: visão própria (tempo economizado pelo lab no mês).

## Privacidade
- Métricas agregadas; nunca expõem conteúdo de mensagens.
- Super Admin vê totais por tenant; nunca lê `ai_messages`.

## Uso operacional dos dados
- **Skills < 5% de aceite em 30d** → revisar ou remover (governance).
- **Actions com confirmação > 80% cancelada** → revisar prompt/UX.
- **Tempo médio > 8s p95** → investigar Tools lentas.
- **Taxa de erro > 5%** → bloquear Action e abrir incidente.
