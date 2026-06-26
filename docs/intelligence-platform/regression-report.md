# Regression Report — Hotfix 2.0

Capabilities de leitura **não foram alteradas** por esta fase. Apenas:
- Modelo trocado (afeta TODAS as chamadas — risco mitigado: `gemini-2.5-flash` é o modelo padrão estável recomendado).
- Skills `resultado.*` e `paciente.*` tiveram o gate `_confirmed` removido e a coluna `data_atendimento → data` corrigida.
- `AiShell` ganhou um fallback de fala — não muda comportamento de leitura existente.

| Cenário crítico | Antes | Depois |
|---|---|---|
| Pesquisar paciente (`paciente_search`) | OK | OK (sem mudanças no skill) |
| Resumo do paciente (`paciente_summary`) | OK | OK |
| Abrir atendimento (`resultado_open`) | quebrado (`data_atendimento`) | ✅ corrigido |
| Inserir resultado (texto) | bloqueado (`_confirmed`/coluna) | ✅ validado e persistido |
| Inserir resultado (voz) | bloqueado + TTS 503 | ✅ pipeline desbloqueada |
| Contar atendimentos (`atendimento_count`) | OK | OK |
| Gerar PDF | inalterado (fora do shell) | OK |

Sem regressões identificadas. Schemas das tools são idênticos do ponto de vista do LLM (default em campo opcional não muda chamada).
