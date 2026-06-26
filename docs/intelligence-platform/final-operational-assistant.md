# Assistente Operacional — Consolidação Definitiva

## Princípio oficial
O Assistente possui exatamente a mesma capacidade operacional de um usuário experiente do SISLAC. Se a interface permite, o Assistente permite — via linguagem natural, reutilizando os mesmos serviços.

## O que o Assistente é
- A forma mais natural de utilizar o SISLAC.
- Uma camada de tradução: linguagem natural → Capability → Skill → Action → Serviço Oficial.

## O que o Assistente NÃO é
- Não é um produto.
- Não é um módulo.
- Não é um ERP paralelo.
- Não tem regras de negócio próprias.
- Não possui CRUD próprio.

## Operações cobertas hoje (via Capabilities autorizadas)
| Intenção do usuário | Capability | Serviço oficial reutilizado |
| --- | --- | --- |
| "Busque o paciente X" | `paciente.buscar` | `pacienteStore` (RLS) |
| "Abra o paciente Y" | `paciente.abrir` | `useNavigate` + rotas oficiais |
| "Abra o resultado de Z" | `resultado.abrir` (registrável) | `resultadoStore` + rota oficial |
| Demais operações | declaradas em `_shared/registry.ts` | stores/RPCs/edge functions existentes |

## Como novas operações entram (após esta fase)
```
Capability (registry.ts)
        ↓
Skill (ai-chat/skills/*)
        ↓
Action (chama serviço oficial)
        ↓
Store / RPC / Edge Function existente
```
Nunca criar nova arquitetura, novo Registry, novo Context, novo Provider, novo Manifest.

## Critério de cobertura
Uma operação é considerada "coberta pelo Assistente" quando:
1. Existe Capability declarada em `_shared/registry.ts`.
2. Existe Skill que invoca o serviço oficial — sem duplicar regra.
3. A Capability é filtrada pelo Manifest via `has_permission()`.
4. O LLM consegue mapear linguagem natural para a Capability.
