# Simplification Opportunities

> Regra: o Core está congelado. Estas são **sugestões**, nenhuma alteração foi executada.

## Arquivos que podem desaparecer ou encolher

| Arquivo | Estado | Sugestão |
|---|---|---|
| `src/lib/ai/contextEngine.ts` → `getContextualSuggestions` | Só retorna sugestões para `pacienteId` focado (1 branch real) | Mover para 10 linhas dentro do shell; remover o helper exportado |
| `parseNavIntent` (no shell) | 14 regras hard-coded em RegExp | Mover para tabela JSON consumida pelo shell, derivada do Manifest (cada Capability já tem rota) |
| Skills em 3 arquivos separados | 3 arquivos × ~150 linhas | Manter — divisão por domínio é correta; **não consolidar** |
| `AiShell.tsx` (783 linhas) | Mistura UI + STT + TTS + voz contínua + push-to-talk + audit | Extrair 3 hooks: `useVoiceRecognition`, `useTTS`, `useAssistantChat`. Componente final ~250 linhas |

## Abstrações desnecessárias

- **Visibility `experimental`** no Manifest — não há nenhum item experimental hoje. Remover do enum até existir caso real.
- **`baselineSeconds/baselineClicks`** no Manifest — não há leitor; existe só como placeholder de métricas futuras. Documentar uso ou remover.
- Dois caminhos de STT (Web Speech + Scribe) — **manter ambos**, são complementares. Não simplificar.

## Duplicação detectada

- Regex de `parseNavIntent` (shell) **duplica conceitualmente** o Capability Registry, mas em PT-BR coloquial. Idealmente uma única SSOT com `synonyms[]` por Capability.
- `findPaciente` aparece em `resultado.ts` e lógica equivalente em `paciente.ts` (`paciente_exames`). Extrair para helper compartilhado dentro de `_shared/` da própria função `ai-chat`.

## O que NÃO simplificar

- Tool calling via AI SDK (`streamText` + `tool`) — é o ponto certo.
- Separação `userClient` (RLS) vs `admin` (auditoria) em `aiAuth.ts` — segurança correta.
- Modelo travado em `eleven_v3` para TTS — decisão de produto.

## Impacto estimado por mudança

| Mudança | Risco | Ganho |
|---|---|---|
| Extrair hooks do AiShell | baixo | manutenibilidade alta |
| SSOT de sinônimos no Manifest | médio | extensibilidade alta |
| `helper findPaciente` compartilhado | baixo | -30 linhas |
| Remover `baselineSeconds/Clicks` se sem leitor | baixo | -2 campos |
