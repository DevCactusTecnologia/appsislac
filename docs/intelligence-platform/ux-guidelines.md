# UX Guidelines

## Filosofia
> Olhou. Entendeu. Resolveu.

O Assistente do SISLAC é **um colaborador experiente do laboratório** (ver `persona.md`), **orientado à execução**. Toda interação deve seguir:

```
Responder  →  Sugerir  →  Executar  →  Automatizar
```

Nunca: conversar por conversar. Se uma interação não economiza tempo, cliques ou erros, ela não deveria existir.

## Regra de ouro (Fase 1.2)
Antes de promover qualquer nova capacidade, responder: **reduz trabalho? reduz cliques? reduz tempo? reduz erros? melhora a rotina do laboratório?** Se a resposta for "não" para todas, a funcionalidade não é implementada.

## Hierarquia de propósito
| Camada | Quando | Exemplo |
|---|---|---|
| **Responder** | Pergunta puramente informacional | "Qual o porte CBHPM 03?" |
| **Sugerir** | Contexto fornece ação clara | Chip "Criar atendimento" quando paciente está aberto |
| **Executar** | Usuário pede ou clica em Ação Rápida | "Criar atendimento para João" |
| **Automatizar** | Padrão recorrente detectado | Pré-preencher convênio mais usado para aquele paciente |

Prioridade sempre: **Automatizar > Executar > Sugerir > Responder**.

## Quando aparece
| Situação | Comportamento |
|---|---|
| Usuário abre o sistema | Botão flutuante visível, silencioso |
| Usuário clica/Ctrl+J | Painel abre em **Modo Assistente** (Ações Rápidas), foco no composer minimizado |
| Contexto rico (paciente/exame aberto) | Chips de ação sugerida; ações rápidas adaptam-se ao foco |
| Hint proativo | Badge numérico no botão; sem toast, sem modal, sem som |

## Quando NÃO aparece
- Páginas públicas (`/`, `/inscricao`).
- Telas de impressão.
- Durante upload/download bloqueante.
- Em diálogos críticos abertos (cobrança, exclusão).

## Anti-interrupção
- Máximo **1 hint proativo destacado** por vez (badge agrega contagem).
- Sem som, sem animação chamativa, sem reposicionar o botão.
- Hints expiram conforme `proactive-suggestions.md`.

## Padrões de mensagem
- Respostas curtas (<150 palavras). Listas/tabelas em markdown.
- Tool calls como **cards inline**: ícone + verbo humano ("Buscando pacientes…") + status.
- Confirmação: card com **resumo do que vai acontecer** + dois botões (Confirmar / Cancelar). Sem texto longo.
- Nunca afirmar dado clínico sem citar a Tool que retornou.

## Erros
- 402 (créditos): "Os créditos de IA acabaram. Avise o administrador." + link Configurações.
- 429 (rate): "Muitas solicitações. Tente em alguns segundos."
- Tool error: mensagem amigável + "Tentar novamente" quando seguro.

## Mobile
- Painel fullscreen, Modo Assistente em grid 2 colunas.
- Composer sticky no rodapé.
- Sem atalho de teclado; gesto swipe-up no botão.

## Acessibilidade
- Botão com `aria-label="Assistente SISLAC"`.
- Painel é `role="dialog"` com `aria-modal="false"`.
- Foco gerenciado; Esc fecha; Tab navega dentro do painel.
- Contraste AA respeitado pelos tokens semânticos.

## Tom
- Profissional, direto, português do Brasil.
- Sem emojis.
- Sem fórmulas conversacionais ("Olá!", "Claro!", "Com prazer!").
- Verbos no imperativo nas Ações Rápidas e chips ("Criar atendimento", "Enviar WhatsApp").
- "Eu fiz X" só aparece após a Action confirmada e bem-sucedida.

## Checklist UX antes de promover qualquer Skill/Action
- [ ] Funciona sem treinamento para recepcionista/biomédico/técnico?
- [ ] Reduz cliques em pelo menos 2 vs. fluxo manual?
- [ ] Confirmação é necessária? (sim para mutações, não para leituras)
- [ ] Caminho mais curto possível (1 clique no Avatar → 1 confirmação se mutação)?
- [ ] Texto da Action é verbo + objeto, sem adjetivos?
- [ ] Erros têm mensagem acionável (não técnica)?
