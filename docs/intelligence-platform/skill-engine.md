# Skill Engine

## Definição
**Skill** = unidade de competência da IA por domínio. Cada domínio do SISLAC tem **uma** Skill, dona de seu vocabulário, prompts e Tools.

## Skills oficiais (catálogo inicial)
| Skill | Domínio | Stores que reutiliza |
|---|---|---|
| `PacienteSkill` | Cadastro/consulta de pacientes | `pacienteStore` |
| `AtendimentoSkill` | Criar/editar/consultar atendimentos | `atendimentoStore`, `orcamentoStore` |
| `ExamesSkill` | Catálogo, parâmetros, layouts | `exameCatalogoStore`, `exameParametrosStore` |
| `ValoresReferenciaSkill` | Faixas, réguas etárias, resolução de referência | `valoresReferenciaStore`, `reguasEtariasStore` |
| `ResultadosSkill` | Resultados, críticos, liberação, impressão | hooks de resultado, `criticoChecker` |
| `SorotecaSkill` | Estrutura, triagem, expurgo | `sorotecaStore`, `sorotecaExpurgoStore` |
| `EstoqueSkill` | Estoque, validade, consumo | `estoqueStore` |
| `FinanceiroSkill` | Entradas (read-only), saídas, faturamento | `financeiroStore`, `convenioFaturasStore` |
| `WhatsAppSkill` | Templates, fila, status de envio | `enqueueNotification`, `notificationPolicy` |
| `ProducaoSkill` | Métricas, dashboards | `producaoMetricsStore` |

## Contrato de uma Skill
```ts
type Skill = {
  id: string;                          // ex: "atendimento"
  domain: string;                      // ex: "Atendimentos"
  description: string;                 // 1 frase, ajuda o LLM a rotear
  requiredPermission?: Permission;     // ex: VIEW_APPOINTMENTS
  tools: ToolRegistration[];           // ver tool-calling.md
  systemPromptFragment?: string;       // <300 tokens, opcional
};
```

## Registro
- Arquivo único `supabase/functions/ai-chat/skills/index.ts` faz `import` estático de cada Skill.
- Adicionar Skill nova = adicionar 1 entry no array + criar o arquivo. Sem alteração no núcleo.
- Skills sem permissão do usuário **não** são expostas ao LLM (reduz custo, evita ofuscação).

## Anti-acoplamento
- Skill **A não pode importar** Tool/serviço da Skill B. Comunicação cross-domain só via Action Engine (compose) ou via Skill que orquestra (`WorkflowSkill` futuro, fora do MVP).
- Skill não importa componentes React.
- Skill não emite HTML/JSX; só dados serializáveis.

## Reuso obrigatório
- Toda Tool de leitura usa o mesmo cliente Supabase com JWT do usuário (RLS aplica).
- Toda Tool de escrita chama o mesmo serviço já usado pela UI (`createAtendimento`, `updateResultado`, etc.). Sem `INSERT` ad-hoc.

## Versionamento
- Cada Skill carrega `version: "1.0.0"`; tools carregam `since: "1.0.0"`.
- Mudança breaking → bump major + entry em `governance.md`.
