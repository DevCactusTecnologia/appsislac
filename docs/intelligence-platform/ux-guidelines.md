# UX Guidelines

## Filosofia
> Olhou. Entendeu. Resolveu.

A IA deve **reduzir cliques**, não adicionar. Se uma sugestão da IA não economiza tempo, ela não deve existir.

## Quando aparece
| Situação | Comportamento |
|---|---|
| Usuário abre o sistema | Botão flutuante visível, silencioso |
| Usuário digita Ctrl/Cmd+J | Painel abre, foco no input |
| Contexto rico detectado (ex.: paciente aberto) | Chip de ação sugerida no rodapé do painel |
| Hint proativo (ex.: 3 resultados parados >24h) | Badge numérico no botão; sem toast, sem modal |
| Erro recorrente do usuário | (futuro) hint contextual no botão |

## Quando NÃO aparece
- Páginas públicas (`/`, `/inscricao`).
- Telas de impressão.
- Durante streaming de upload/download bloqueante.
- Em diálogos críticos abertos (cobrança, exclusão).

## Quando sugere vs. quando apenas responde
- **Sugere** quando: contexto fornece ação clara (ex.: "abrir atendimento deste paciente?").
- **Apenas responde** quando: pergunta puramente informacional ("qual o porte CBHPM 03?").
- **Executa** quando: usuário pediu explicitamente E a ação tem confirmação visual.

## Anti-interrupção
- Máximo **1 hint proativo visível** por vez (badge agrega contagem).
- Sem som, sem animação chamativa, sem reposicionar o botão.
- Hints expiram em 10 minutos se não interagidos.

## Padrões de mensagem
- Respostas curtas por padrão (<150 palavras).
- Listas e tabelas em markdown.
- Tool calls aparecem como **cards inline**: ícone + nome humano da ação ("Buscando pacientes…") + status.
- Confirmação: card com **resumo do que vai acontecer** + dois botões ("Confirmar" / "Cancelar"). Sem texto longo.

## Erros
- 402 (créditos): "Os créditos de IA acabaram. Avise o administrador." + link para Configurações.
- 429 (rate): "Muitas solicitações. Tente em alguns segundos."
- Tool error: mensagem amigável + opção "Tentar novamente" quando seguro.

## Mobile
- Painel fullscreen.
- Composer sticky no rodapé.
- Sem atalho de teclado; gesto swipe-up no botão.

## Acessibilidade
- Botão com `aria-label="Assistente SISLAC"`.
- Painel é `role="dialog"` com `aria-modal="false"` (não bloqueia página).
- Foco gerenciado; Esc fecha; Tab navega só dentro do painel quando aberto por teclado.
- Contraste mínimo AA respeitado pelos tokens semânticos.

## Tom
- Profissional, direto, em português do Brasil.
- Sem emojis (regra SISLAC).
- Sem promessas ("eu fiz" só após Action confirmada).
- Nunca afirma dado clínico sem citar a Tool que retornou.
