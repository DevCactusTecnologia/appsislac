# Fase 2.4 — Experiência Conversacional Natural

## Princípio
O Assistente deixa de ser um menu e passa a ser conversação. O usuário descreve o que deseja; o Assistente entende, executa e confirma quando necessário.

## Mudanças desta fase
1. **Removidas Ações Rápidas** ("Pesquisar Paciente", "Cadastrar Paciente") da tela inicial do AI Shell.
2. **Nova tela inicial enxuta**: ícone + "Em que posso ajudar hoje?" + textarea + microfone. Sem grade de cards.
3. **Entrada por voz** via novo endpoint `ai-transcribe` (adaptador OpenAI gpt-4o-mini-transcribe).
4. **Sugestões contextuais** aparecem apenas quando há foco real (paciente/atendimento aberto). Nunca genéricas, nunca fixas.
5. **Tom humano** das respostas: o LLM já é instruído a se comportar como colaborador do laboratório; mantemos o mesmo system prompt.

## O que NÃO mudou
- Core (Registry, Manifest, ai-chat, contextEngine, manifestClient, aiAuth) permanece intocado.
- Nenhuma nova Skill, Capability ou Action foi criada.
- Fluxo único: Usuário → AiShell → ai-chat → Skill → Action → Serviço.
- Voz reusa exatamente o mesmo pipeline do texto (vira string e dispara `send()`).
