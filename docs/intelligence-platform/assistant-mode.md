# Modo Assistente

> Princípio oficial: **A IA do SISLAC é orientada à execução de tarefas e automação operacional. O chat é apenas a interface de comunicação.** O objetivo principal é reduzir cliques, eliminar tarefas repetitivas, sugerir ações inteligentes e executar operações autorizadas de forma contextual, segura e integrada ao fluxo do laboratório.

## Conceito
Ao abrir o Avatar, o usuário **NÃO** vê um input em branco com "Olá, como posso ajudar?". Vê uma **grade de Ações Rápidas** contextual ao seu papel, rota atual e foco. O chat fica disponível como segunda camada (textarea minimizado no rodapé), nunca como tela principal.

## Estrutura do painel (top → bottom)
```text
┌─ Header: "Assistente" • status • minimizar/fechar ─┐
│                                                     │
│  AÇÕES RÁPIDAS                                      │
│  Grid 2 colunas, ícone + label curto (1-3 palavras) │
│  Filtradas por permissão e contexto                 │
│                                                     │
│  SUGESTÕES CONTEXTUAIS (se houver)                  │
│  Chips horizontais com ação clara                   │
│                                                     │
│  ──────────────────────────────────                 │
│  HISTÓRICO RECENTE (colapsável)                     │
│  Últimas 3 interações da thread                     │
│                                                     │
└─ Composer minimizado: "Pedir algo..." (expande) ────┘
```

## Catálogo inicial de Ações Rápidas
| Ação | Skill | Permissão | Comportamento |
|---|---|---|---|
| Pesquisar paciente | `paciente` | VIEW_PATIENTS | Abre busca inline; resultado navega ao paciente |
| Cadastrar paciente | `paciente` | CREATE_PATIENTS | Abre formulário em drawer interno do painel |
| Criar atendimento | `atendimento` | CREATE_APPOINTMENTS | Pré-preenche paciente se houver foco atual |
| Criar orçamento | `atendimento` | CREATE_BUDGETS | Idem |
| Pesquisar exame | `exames` | VIEW_EXAMS | Busca catálogo, ação "configurar" |
| Configurar exame | `exames` | EDIT_EXAMS | Abre `ParametrosDialog` da Skill |
| Enviar WhatsApp | `whatsapp` | SEND_WHATSAPP | Lista templates filtrados por contexto |
| Pesquisar soroteca | `soroteca` | VIEW_SOROTECA | Busca por código de amostra |
| Abrir financeiro | `financeiro` | VIEW_FINANCE | Filtros aplicados ao contexto (paciente/dia) |
| Abrir produção | `producao` | VIEW_PRODUCTION | KPIs do dia |

Critérios para entrar no catálogo:
1. Economiza ≥ 2 cliques vs. fluxo manual.
2. Faz sentido em qualquer rota (ou tem fallback contextual claro).
3. Tem Action correspondente registrada (não é apenas link de navegação).

## Integração com o AI Shell
- Ação Rápida = atalho para uma **Tool/Action** já registrada (não duplica lógica).
- Clicar em uma Ação Rápida envia um `prompt` interno padronizado ao Edge (`ai-chat`) com `mode: "quick-action"` para o LLM rotear sem ambiguidade — OU executa direto sem LLM quando o input é trivial (ex.: abrir busca).
- Sem LLM quando: ação é puramente UI (abrir dialog, navegar). Com LLM quando: requer extração de entidade da fala do usuário.

## Quando o chat assume
- Usuário digita no composer.
- Usuário pede algo fora do catálogo.
- Resultado de uma Ação Rápida precisa de refinamento conversacional ("desses 5 pacientes, abrir o segundo").

## Anti-padrões
- Avatar abrir já no chat com mensagem de boas-vindas.
- Ações Rápidas estáticas (sem filtro de permissão/contexto).
- Mais de 10 ações visíveis simultaneamente (limite duro: 8).
- Ícones decorativos sem ação.
