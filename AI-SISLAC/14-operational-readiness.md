# 14 — Prontidão Operacional

## Funcionalidades testadas (caminho ativo)

| Operação | Tool | Estado | Observação |
|---|---|---|---|
| Pesquisar paciente | `paciente_search` | ✅ Funciona | Limite 10 |
| Resumo do paciente | — | ⚠️ Parcial | Não há tool específica; LLM compõe via `paciente_search` + `paciente_exames` |
| Abrir atendimento | — | ❌ Não existe | Sem `atendimento_open` |
| Abrir exame / resultado | `resultado_open` | ✅ Funciona | Navegação por id |
| Inserir resultado | `resultado_set_valor` / `set_varios` | ⚠️ Funciona mas sem confirmação UX | `needsApproval` é só prompt |
| Salvar | implícito no set | ✅ | |
| Liberar resultado | ❌ Não existe como tool | ❌ | Prompt menciona, código não tem |
| Gerar PDF | ❌ | ❌ | |
| Financeiro | ❌ | ❌ | Capability/categoria existe, skill não |
| WhatsApp | ❌ | ❌ | Idem |
| BPA | ❌ | ❌ | |
| Estoque | ❌ | ❌ | |
| Soroteca | ❌ | ❌ | |
| Navegação por voz/texto | `parseLocalIntent` | ✅ | 12 rotas |
| Voz push-to-talk | `ai-transcribe` + `ai-speak` | ✅ | Latência 4-8s/turno |

## Diagnóstico
- O Assistente cobre **~25%** das operações que aparecem na documentação.
- O caminho coberto **funciona com qualidade aceitável**.
- O caminho não coberto está **declarado mas não implementado** (vaporware).

## Pronto para produção?
- Para o **escopo real implementado** (busca, consulta, abrir resultado, inserir valores): **SIM, com ressalvas**:
  - Adicionar enforcement real de `needsApproval` no frontend antes de chamar `resultado.set_*`.
  - Adicionar rate limit por usuário.
  - Auditoria por tool, não apenas por turno.
- Para o **escopo prometido** (BPA, WhatsApp, Financeiro, Soroteca, Liberação): **NÃO**.
