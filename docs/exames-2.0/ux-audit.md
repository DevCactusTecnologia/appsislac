# Auditoria — UX do Cadastro de Exames

## Comparação com referência Worklab (imagem anexada)
A referência mostra 28 campos em uma única tela, misturando operação,
faturamento, etiqueta, apoio, interfaceamento e laudo. O SISLAC já evoluiu
para um padrão melhor.

## Estado atual do `NovoExameDialog`
Filosofia declarada no topo do arquivo:
> O exame é apenas **identidade operacional**. Analítica vive em
> Parâmetros, Layout, VR. A UI expõe **3 áreas**:
> 1. Identidade (sempre visível)
> 2. Coleta (sempre visível)
> 3. Faturamento + Apoio (collapse)

**Bom:** UI já está simplificada conceitualmente.

## Problemas detectados

| # | Problema | Severidade |
|---|---|---|
| U1 | Embora a UI mostre 3 seções, o `form` state inicializa **52 campos** (preserva todos por compatibilidade). Operador acredita que está editando "pouco" mas qualquer reset apaga 40+ campos invisíveis. | 🟠 |
| U2 | Dialog tem 659 linhas — limite saudável. ✔ | 🟢 |
| U3 | `ExamesTab` tem 976 linhas — grande, mas concentra busca/filtros/lista. | 🟡 |
| U4 | `ParametrosDialog` tem **788 linhas** — denso. Provavelmente concentra parâmetro + VR + crítico + lista de opções de select. | 🟠 |
| U5 | Não há **busca global** dentro do dialog (encontrar campo "LOINC" exige scroll). | 🟢 |
| U6 | Hints (`<HelpCircle />`) já presentes — bom. | 🟢 |

## Tempo estimado para localizar um exame
Atendendo à filosofia "Olhou. Entendeu. Resolveu.":
- Buscar exame na lista: **< 5 s** (busca por nome/mnemônico já existe).
- Abrir e entender o cadastro: **< 30 s** (3 seções visíveis, defaults
  prontos).
- ✔ Critério satisfeito **para o operador**, mas não para o **schema**.

## Recomendação (sem implementar)
1. Esconder definitivamente do `form` os 25 campos mortos (apenas envia
   default ao salvar).
2. Quebrar `ParametrosDialog` em 3: parâmetro / VR / crítico.
3. Adicionar tooltip "porque este campo existe" em todos os campos
   regulatórios.
4. Considerar abas em vez de collapse para reduzir scroll.
