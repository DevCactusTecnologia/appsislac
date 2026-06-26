# Executive Report — Assistant 2.0

> Radiografia completa do Assistente do SISLAC.
> Metodologia oficial **OECV** (Olhou • Entendeu • Configurou • Validou) — nenhum código alterado.

---

## 1. Vereditos diretos

| Pergunta | Resposta |
|---|---|
| O Assistente parece **chatbot** ou **colaborador**? | **~70% colaborador, ~30% chatbot.** Já executa, mas perde a sessão entre turnos. |
| Voz já é como assistente virtual moderno? | **Quase.** Falta TTS por sentença, barge-in e captor sim/não. Latência 2.5–5 s. |
| Contexto permanece ativo durante a tarefa? | **Não estruturalmente.** Depende da memória conversacional do LLM. |
| Usuário conclui tarefas só conversando? | **Parcial.** Abre tela ✅, grava valor ✅, "salvar" e "liberar" ❌ (sem tool). |
| Perguntas operacionais sem Capability? | **Sim**, várias áreas (financeiro, soroteca, whatsapp, produção). |
| Risco de alucinação? | **Médio-alto** para áreas sem tool; **baixo** para Paciente/Atendimento/Resultado. |
| Executa ou só orienta? | **Executa** as 8 capabilities existentes; **orienta** o resto. |
| Conversa natural e fluida? | **Boa** em turnos curtos; **frágil** em fluxos compostos. |
| Pronto para plantão completo? | **Ainda não.** Bloqueadores: working memory, save/release, latência de voz. |

## 2. Mapa de capacidade vs experiência alvo

```text
                   Hoje    Alvo
Navegação por voz   ████    ████
Buscar paciente     ████    ████
Abrir resultado     ████    ████
Gravar valor        ███░    ████
Salvar              ░░░░    ████   ← lacuna crítica
Liberar             ░░░░    ████   ← lacuna crítica (com confirmação)
Confirmação por voz ██░░    ████
Working memory      █░░░    ████   ← lacuna crítica
TTS streamado       ██░░    ████
Barge-in            ░░░░    ████
Follow-up automático░░░░    ████
Financeiro/Soroteca ░░░░    ████   (sem tool)
```

## 3. Top 10 recomendações priorizadas (impacto × risco)

| # | Recomendação | Impacto | Risco | Esforço |
|---|---|---|---|---|
| 1 | **Working Memory** server-side (`ai_sessions`) | 🟢 Alto | 🟢 Baixo | M |
| 2 | Tools `resultado_save` + `resultado_release` (com `needsApproval`) | 🟢 Alto | 🟢 Baixo | P |
| 3 | TTS por sentença (split + pipeline) | 🟢 Alto | 🟡 Médio | P |
| 4 | Captor sim/não/cancela no shell para `pending_action` | 🟢 Alto | 🟢 Baixo | P |
| 5 | Normalizador numérico PT-BR ("quatro vírgula cinco" → 4.5) | 🟢 Alto | 🟢 Baixo | P |
| 6 | Microcopy `spoken_ack` padronizada por tool | 🟡 Médio | 🟢 Baixo | P |
| 7 | Capabilities financeiro/soroteca/whatsapp básicas | 🟢 Alto | 🟡 Médio | G |
| 8 | Barge-in (pausar TTS ao começar a falar) | 🟡 Médio | 🟡 Médio | P |
| 9 | Refactor `AiShell` em 3 hooks | 🟡 Médio | 🟢 Baixo | M |
| 10 | Validação de valor crítico → `_double_confirmed` | 🟢 Alto (clínico) | 🟢 Baixo | P |

P = ≤ 1 dia. M = 2–4 dias. G = > 1 semana.

## 4. O que NÃO mexer

- Core do `streamText` + `tool` (AI SDK).
- Modelo TTS `eleven_v3` (decisão de produto).
- `aiAuth.ts` (segurança correta).
- Manifest como SSOT.

## 5. Critério de pronto para "plantão"

O Assistente está pronto para um plantão completo quando, sem tocar a tela e sem repetir paciente:

1. "Abre o hemograma da Alicia." → abre.
2. "Quatro e meio em hemácias, quatorze em hemoglobina." → grava ambos.
3. "Salva." → salva.
4. "Libera." → pede confirmação por voz, libera ao "sim".
5. "Próximo, abra a Maria." → muda foco sem perder contexto.

Com as recomendações 1–6 acima, esse cenário fica viável.

---

**Status final:** auditoria concluída. **Nenhum código alterado.** Próximo passo depende de aprovação explícita.
