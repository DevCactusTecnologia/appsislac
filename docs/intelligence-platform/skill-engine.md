# Skill Engine

## Definição
**Skill** = unidade de competência da IA por domínio. Cada domínio do SISLAC tem **uma** Skill, dona de seu vocabulário, prompts, Tools, Actions, Ações Rápidas e Sugestões.

## Filosofia (orientada à execução)
Toda Skill deve responder objetivamente:
1. **Quais tarefas elimina?** (lista concreta de tarefas manuais substituídas)
2. **Quanto tempo economiza?** (segundos por uso — baseline declarado)
3. **Quantos cliques remove?** (cliques manuais − 1 do Avatar)

Skill que apenas conversa **não é aceita**. Toda Skill precisa expor pelo menos uma Action útil (ver `governance.md`).

Classificação obrigatória por Skill (ver `metrics-model.md`):
| Categoria | Foco | Exigência |
|---|---|---|
| `automation` | Reduz/elimina tarefa recorrente | Ideal |
| `write` | Executa mutação | Necessário ter ≥1 |
| `read` | Consulta/extração | Aceitável como apoio |
| `conversational` | Apenas responde | **Proibido como única categoria** |

## Skills oficiais (catálogo inicial)
| Skill | Domínio | Stores que reutiliza | Ações Rápidas previstas |
|---|---|---|---|
| `PacienteSkill` | Cadastro/consulta | `pacienteStore` | Pesquisar, Cadastrar, Imprimir etiqueta |
| `AtendimentoSkill` | Criar/editar/consultar | `atendimentoStore`, `orcamentoStore` | Criar atendimento, Criar orçamento |
| `ExamesSkill` | Catálogo, parâmetros, layouts | `exameCatalogoStore`, `exameParametrosStore` | Pesquisar, Configurar exame |
| `ValoresReferenciaSkill` | Faixas, réguas, resolução | `valoresReferenciaStore`, `reguasEtariasStore` | Abrir matriz, Criar regra |
| `ResultadosSkill` | Resultados, críticos, liberação | hooks de resultado, `criticoChecker` | Listar parados, Liberar lote |
| `SorotecaSkill` | Estrutura, triagem, expurgo | `sorotecaStore`, `sorotecaExpurgoStore` | Pesquisar amostra, Sugerir expurgo |
| `EstoqueSkill` | Estoque, validade, consumo | `estoqueStore` | Alertar vencimento, Repor item |
| `FinanceiroSkill` | Entradas (RO), saídas, faturamento | `financeiroStore`, `convenioFaturasStore` | Abrir financeiro, Faturas vencendo |
| `WhatsAppSkill` | Templates, fila, status | `enqueueNotification`, `notificationPolicy` | Enviar WhatsApp |
| `ProducaoSkill` | Métricas, dashboards | `producaoMetricsStore` | Abrir produção |

## Classificação inicial (Responder/Sugerir/Executar/Automatizar)
| Skill | Responde | Sugere | Executa | Automatiza | Veredito |
|---|---|---|---|---|---|
| Paciente | ✓ | ✓ | ✓ (cadastrar, imprimir) | parcial | OK |
| Atendimento | ✓ | ✓ | ✓ (criar, cancelar) | sim (pré-preenche convênio padrão) | OK |
| Exames | ✓ | ✓ | ✓ (abrir config) | — | OK |
| ValoresReferencia | ✓ | ✓ | ✓ (criar regra) | sim (duplicar preset) | OK |
| Resultados | ✓ | ✓ | ✓ (liberar) | sim (lote por critério) | OK |
| Soroteca | ✓ | ✓ | ✓ (localizar) | sim (sugestão expurgo) | OK |
| Estoque | ✓ | ✓ | ✓ (registrar consumo) | sim (alerta vencimento) | OK |
| Financeiro | ✓ | ✓ | ✓ (saída) | sim (faturas vencendo) | OK |
| WhatsApp | — | ✓ | ✓ (enviar template) | sim (notificação automática) | OK |
| Produção | ✓ | ✓ | — | sim (relatório agendado) | OK |

Nenhuma Skill puramente conversacional foi aprovada.

## Contrato de uma Skill
```ts
type Skill = {
  id: string;                          // ex: "atendimento"
  domain: string;                      // ex: "Atendimentos"
  description: string;                 // 1 frase, ajuda o LLM a rotear
  requiredPermission?: Permission;     // ex: VIEW_APPOINTMENTS
  tools: ToolRegistration[];
  actions: ActionRegistration[];
  quickActions: QuickAction[];         // grid do Modo Assistente
  suggestions: Suggestion[];           // hints contextuais
  metrics: {
    baselineSeconds: number;           // tempo manual estimado da tarefa principal
    baselineClicks: number;
    category: "read" | "write" | "automation";
  };
  systemPromptFragment?: string;       // <300 tokens, opcional
  version: string;                     // SemVer
};
```

## Registro
- `supabase/functions/ai-chat/skills/index.ts` faz `import` estático de cada Skill.
- Adicionar Skill nova = adicionar 1 entry no array + criar o arquivo. Sem alteração no núcleo.
- Skills sem permissão do usuário **não** são expostas ao LLM (reduz custo, evita ofuscação).

## Anti-acoplamento
- Skill **A não pode importar** Tool/serviço da Skill B. Comunicação cross-domain só via Action Engine (compose) ou via Skill orquestradora futura.
- Skill não importa componentes React.
- Skill não emite HTML/JSX; só dados serializáveis.

## Reuso obrigatório
- Toda Tool de leitura usa o mesmo cliente Supabase com JWT do usuário (RLS aplica).
- Toda Tool de escrita chama o mesmo serviço já usado pela UI (`createAtendimento`, `updateResultado`, etc.). Sem `INSERT` ad-hoc.

## Versionamento
- Cada Skill carrega `version: "1.0.0"`; tools carregam `since: "1.0.0"`.
- Mudança breaking → bump major + entry em `governance.md`.

## Revisão periódica
- Skill com taxa de aceite < 5% em 30d → revisão obrigatória ou remoção.
- Skill sem Action executada por 60d → marcada como obsoleta.
