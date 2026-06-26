# Capability Validation

## Capabilities reais hoje (skills/*)

| Tool | Skill | Mutação | needsApproval | Status |
|---|---|---|---|---|
| `paciente_search` | paciente | não | não | OK |
| `paciente_create` | paciente | sim | ✅ `_confirmed` | OK |
| `paciente_exames` | paciente | não | não | OK |
| `atendimento_count` | atendimento | não | não | OK |
| `atendimento_summary` | atendimento | não | não | OK |
| `resultado_open` | resultado | não (navega) | não | OK |
| `resultado_set_valor` | resultado | **sim** | ✅ `_confirmed` | ⚠️ grava sem checar critical-flag, sem auditoria por resultado |
| `resultado_set_varios` | resultado | **sim** | ✅ `_confirmed` | idem |

Total: **8 tools**. Tudo o resto que o usuário pedir cai no caminho **livre do LLM**.

## Resposta às perguntas da ETAPA 5

> **Toda pergunta operacional passa obrigatoriamente por uma Capability?**

❌ **Não.** O `systemPrompt` permite explicitamente: _"Se nenhuma ferramenta cobrir a pergunta, responda naturalmente com seu conhecimento, deixando claro quando algo for opinião ou estimativa."_ Isso é correto para perguntas conceituais ("o que é VCM?"), mas abre porta para **alucinação operacional** se o modelo decidir que algo é "geral" quando deveria ser tool.

> **Existe alguma resposta gerada apenas pelo modelo?**

✅ Sim — qualquer coisa fora das 8 tools. Exemplos hoje:
- Quantos pacientes existem? → **sem tool** (não há `paciente_count`).
- Quanto faturei hoje? → **sem tool** (não há `financeiro_*`).
- Há amostras vencendo na soroteca? → **sem tool**.
- Mensagens do WhatsApp? → **sem tool**.

> **Existe risco de alucinação?**

🔴 **Sim, alto** para qualquer pergunta operacional fora de Paciente/Atendimento/Resultado. O modelo provavelmente dirá "não tenho acesso a essa informação" — bom — mas também pode tentar estimar a partir do nada se mal-prompted.

## Recomendado

- Política: **se a pergunta menciona dado operacional (números, listas, estados, valores) e nenhuma tool cobre → resposta deve ser "ainda não tenho essa capability"**. Já está parcialmente no prompt; reforçar.
- Roadmap de Capabilities por impacto:
  1. `financeiro_resumo` (entrada/saída do dia)
  2. `producao_kpis` (atendimentos × analistas)
  3. `soroteca_vencendo` (amostras a expurgar)
  4. `whatsapp_pendentes` (mensagens não respondidas)
  5. `resultado_save` e `resultado_release` (com `needsApproval`)
  6. `paciente_count`, `exame_count` etc. — paridade com `atendimento_count`
