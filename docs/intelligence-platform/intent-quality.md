# Intent Quality

## Como o intent é detectado hoje

1. **Pré-parser determinístico no shell** (`parseNavIntent`): regex PT-BR mapeia verbos (`abrir/ir/vai/mostrar…`) + substantivo (`atendimentos/pacientes/financeiro…`) → rota fixa. Executa **sem LLM**.
2. **LLM (Gemini Flash)** com `systemPrompt` em PT-BR e tool calling decide o resto.

## Pontos fortes

- Navegação por voz é instantânea (sem custo de LLM, sem latência).
- Tools têm descrições didáticas que ensinam o modelo (ex.: "USE SEMPRE que o usuário pedir…").
- `resultado_open` aceita protocolo OU nome OU CPF — múltiplas formas naturais.

## Falhas conhecidas

| # | Falha | Exemplo |
|---|---|---|
| I1 | Modelo às vezes "explica o que faria" em vez de chamar a tool | "Para ver os atendimentos, vá em…" |
| I2 | Comandos compostos perdidos | "abre a Alicia e me diga o último hemograma dela" — só uma intenção é atendida |
| I3 | Negação não tratada | "não, cancela isso" não cancela pending action |
| I4 | Ambiguidade de paciente homônimo | Pega o primeiro do `limit(5)` sem pedir desambiguação |
| I5 | Plurais/diminutivos não cobertos pelo `parseNavIntent` ("atendimentozinho") |

## Recomendado

- Reforçar systemPrompt com "Nunca explique o caminho — execute a tool".
- Multi-intent: quebrar a fala em sentenças e enfileirar.
- Captor sim/não/cancela no shell quando há `pending_action`.
- Em homônimos, retornar `needs_disambiguation` e pedir confirmação por voz.
