# 14 — Quality Classification

Critérios objetivos, sem nota arbitrária.

| Eixo | Evidência | Classificação |
|---|---|---|
| Padronização de imports/runtime | 121 arquivos via fachada, 4 exceções auditadas, ESLint enforcement | Excelente |
| Nomenclatura | Prefixos e convenções uniformes em todas camadas | Excelente |
| Estrutura de diretórios | Camadas fixas + subpastas por feature | Muito boa |
| Coesão (`data/`, `domains/`, `hooks/`, `_shared/`) | 1 responsabilidade por arquivo | Muito boa |
| Coesão (páginas operacionais) | 5 páginas > 1000 LOC misturando domínios | Regular |
| Acoplamento | Chokepoints únicos, sem ciclos | Muito boa |
| Duplicação estrutural | CORS/JWT em ~60 edges; padrão de store repetido em 48 | Regular |
| Duplicação literal | Poucos blocos copy-paste extensos | Boa |
| Tipagem | Strict + baixa densidade de escapes (~0,15/100 LOC) | Muito boa |
| Testes | 11 unit + 1 E2E para 469 arquivos | Baixa |
| Documentação | 247 `.md`, 10 fases de auditoria formal, `BEST_PRACTICES.md` | Excelente |
| Governança CI | Guards de import, tamanho, mocks, plano de dados | Muito boa |
| Código morto | 12 símbolos runtime + 2 edges + colunas + docs órfãs | Regular |
| Dívida arquitetural registrada | Runtime dedicated implementado sem consumo efetivo | Regular |
| Legibilidade de exceções | 66 TODO, 65 `as any`, 48 eslint-disable — distribuídos, não críticos | Boa |

## Consolidação
- 4 eixos Excelente
- 5 eixos Muito boa
- 2 eixos Boa
- 4 eixos Regular
- 1 eixo Baixa (testes)

## Classificação final
**Boa**, com pontos claros de Regular (páginas gigantes, duplicação estrutural em edges, código morto arquitetural, testes).
