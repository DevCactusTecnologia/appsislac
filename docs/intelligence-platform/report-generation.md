# Report Generation (via conversa)

Relatórios passam a ser pedidos em linguagem natural. O Assistente decide dados, filtros, formato e gera.

## Padrão arquitetural
Cada relatório existe como **Capability** registrada em `_shared/registry.ts` e implementada como **Action** dentro da Skill do domínio. Nada é hardcoded no AI Shell.

```
"Gere um PDF das despesas deste mês"
  → ai-chat seleciona capability `financeiro.relatorio_despesas`
  → Skill financeira chama serviço oficial de exportação
  → URL/arquivo é devolvido ao usuário no chat
```

## Roadmap incremental (fora desta fase)
A Fase 2.4 não cria novas Skills. À medida que novas Capabilities forem registradas, a conversa abaixo passa a funcionar sem alterar o AI Shell:

- "Relatório de pacientes inadimplentes."
- "Exames liberados hoje."
- "Glosas deste convênio."
- "Faturamento por médico no mês."

## Restrições
- Toda Capability declara `permission` — relatórios respeitam papel do usuário.
- Capabilities com `needsApproval: true` confirmam antes de gerar.
- Auditoria automática via `ai_audit` registra cada geração.
