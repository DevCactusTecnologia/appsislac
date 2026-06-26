# Sugestões Contextuais (Proactive Hints)

## Princípio
A IA observa o contexto operacional e propõe ações **úteis e executáveis**. Nunca informa por informar. Toda sugestão é um botão que dispara uma Action.

## Anatomia de uma Sugestão
```ts
type Suggestion = {
  id: string;                  // "atendimento.create-from-patient"
  skill: string;               // "atendimento"
  trigger: SuggestionTrigger;  // condição de aparição
  label: string;               // "Criar atendimento"
  icon: LucideIcon;
  action: ActionRef;           // { actionId, inputPreset }
  priority: 1 | 2 | 3;         // 1 = mais relevante
  ttlMinutes: number;          // expira após
  permission: Permission;
};
```

## Triggers padronizados
| Trigger | Quando dispara | Origem |
|---|---|---|
| `route` | Rota atual bate padrão | Context Engine (browser) |
| `focus` | Entidade em foco (paciente, exame, atendimento) | Context Engine |
| `stateThreshold` | Métrica ultrapassa limite (ex.: soroteca >85% cheia) | Background poll (60s) |
| `staleness` | Item parado há > X (ex.: resultado pendente >24h) | Background poll |
| `recurrence` | Usuário repetiu mesma sequência ≥3 vezes hoje | Memory engine |
| `calendar` | Data/hora (ex.: convênio vencendo nos próximos 7d) | Background poll |

## Catálogo inicial por domínio
### Paciente aberto
- Criar atendimento → `atendimento.create` com `pacienteId` preset
- Imprimir etiqueta → `paciente.print-label`
- Consultar histórico → `paciente.history`
- Enviar WhatsApp → `whatsapp.send` com paciente preset

### Exame aberto
- Configurar parâmetros → `exames.open-params`
- Criar valores de referência → `valoresReferencia.open-matrix`
- Revisar layout científico → `exames.open-layout`

### Soroteca
- Amostras sem localização (badge com contagem) → `soroteca.list-unlocated`
- Galeria quase cheia (≥85%) → `soroteca.suggest-expurgo`
- Expurgo pendente → `sorotecaExpurgo.review`

### Financeiro
- Convênios vencendo (7d) → `financeiro.faturas-vencendo`
- Glosas recorrentes → `financeiro.glosas-padrao`
- Pendências do dia → `financeiro.pendencias-hoje`

### Resultados
- Resultados parados >24h → `resultados.lista-parados`
- Críticos sem liberação → `resultados.criticos-pendentes`

### Atendimento
- Atendimentos sem coleta após 30min → `atendimento.lista-coleta-pendente`
- Pagamento parcial → `pagamento.alerta-debitos`

## Apresentação
- **Badge no botão flutuante**: agrega contagem (1, 2, 3+). Sem toast, sem modal, sem som.
- **Chips no painel** (Modo Assistente, abaixo das Ações Rápidas): máximo 3 visíveis, ordenadas por `priority`.
- Clique no chip = executa a Action (com confirmação se `needsApproval`).
- Dispensar (X) = oculta por `ttlMinutes`.

## Regras anti-ruído
- Máximo **3 hints simultâneos** visíveis (excedentes ficam ocultos mas contam no badge).
- TTL default: 10 minutos para `route`/`focus`, 60 minutos para `stateThreshold`/`staleness`.
- Mesma sugestão não reaparece por 1h se dispensada.
- Hints proativos **nunca** disparam ação automaticamente — sempre exigem clique.

## Padronização técnica (resumo)
1. Toda Skill exporta `suggestions: Suggestion[]`.
2. O `SuggestionRegistry` (server) é consultado pelo Edge `ai-context-suggestions` (endpoint leve, sem LLM).
3. Browser pede sugestões a cada mudança de rota/foco + poll de 60s para triggers de estado.
4. Filtragem por permissão acontece no servidor (nunca no cliente).
5. Resposta cacheada por `(tenant, user, route, focusId)` por 60s.

## Métricas obrigatórias
- Sugestões geradas / aceitas / dispensadas / expiradas.
- Tempo médio até clique.
- Top 10 sugestões mais úteis (taxa de aceite).
- Sugestões removidas por baixa aceitação (<5% em 30d).
