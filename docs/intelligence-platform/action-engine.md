# Action Engine

## Princípio
A IA **executa**, não apenas responde. Toda execução acontece através de **Actions** — funções server-side que reusam serviços oficiais e atravessam auditoria + permissão + confirmação.

## Anatomia de uma Action
```ts
type Action<Input, Output> = {
  id: string;                  // "atendimento.create"
  skill: string;               // "atendimento"
  description: string;
  inputSchema: ZodSchema<Input>;
  requiredPermission: Permission;
  needsApproval: boolean;      // true para mutações
  side_effects: "none" | "read" | "write" | "external"; // tag
  execute: (ctx, input) => Promise<Output>;
  audit: (input, output) => Record<string, unknown>; // o que loga (sanitizado)
};
```

## Classificação
| Tipo | needsApproval | Exemplos |
|---|---|---|
| Read | false | `paciente.search`, `atendimento.get`, `exame.list` |
| Write não-crítica | true (toggle por preferência) | `paciente.update_address`, `documento.duplicate` |
| Write crítica | **true sempre** | `atendimento.cancel`, `resultado.release`, `whatsapp.send`, `estoque.expurgo` |
| Financeira | **true sempre** | `pagamento.register`, `fatura.gerar` |
| Clínica | **true sempre** | `resultado.release`, `critico.flag` |

## Confirmação
- UI renderiza card "Confirmar ação: …" com diff/preview.
- Botão "Confirmar" envia tool result `approved: true`; "Cancelar" envia `approved: false`.
- Sem confirmação implícita; sem timeout que auto-aprova.
- Super admin **não** bypassa confirmação para ações em tenants.

## Reuso de serviços
- `atendimento.create` chama o **mesmo** serviço usado em `src/pages/NovoAtendimento` (não duplica `INSERT`).
- `paciente.create` chama o mesmo validador (CPF, telefone, etc.).
- `whatsapp.send` chama `enqueueNotification` (respeita `notificationPolicy`).

## Tratamento de erro
- Tool retorna `{ ok: false, error: { code, message, userMessage } }`.
- LLM nunca recebe stack trace; recebe `userMessage` curta.
- 4xx do gateway → mensagem clara no chat; 5xx → "Tente novamente"; 402 → bloqueio com aviso de créditos; 429 → backoff sugerido.

## Auditoria (resumo)
Toda Action grava em `ai_audit`:
```
ai_audit_id | tenant_id | user_id | skill | action_id | input_hash | output_summary | duration_ms | status | approved | error_code | created_at
```
Detalhes em `governance.md` e DDL futura.

## Orquestração (multi-step)
- `stopWhen: stepCountIs(50)` no `streamText`.
- LLM pode encadear: `paciente.search` → `atendimento.create` → confirmação → `whatsapp.send` → confirmação.
- Cada passo aparece como card individual no AI Shell; usuário pode interromper a qualquer momento (`stop`).
