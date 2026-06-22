# Soroteca 2.0 — Fase 9 — Código limpo + UX final

## Problema observado
Até a Fase 8 a Soroteca tinha 6 módulos completos
(Amostras, Estrutura/Galerias, Triagem, Materiais, Empréstimos, Expurgo)
mas **só a tela `/soroteca` era descobrível**. Para chegar em
"criar galeria", "opções de galeria", "expurgo de amostras" o operador
precisava saber o caminho de URL — o que viola a filosofia "sem treinamento".

## Solução
Componente único `SorotecaNav` (`src/components/soroteca/SorotecaNav.tsx`)
plugado em **todas** as páginas Soroteca, logo abaixo do `PageHeader`.

### Itens da navegação
| Item                  | Rota                    | Função                                  |
|-----------------------|-------------------------|-----------------------------------------|
| Amostras              | `/soroteca`             | Listagem geral, busca avançada, descarte |
| Estrutura & Galerias  | `/soroteca/estrutura`   | CRUD de Locais, Galerias e Posições     |
| Triagem               | `/soroteca/triagem`     | Bipar etiqueta e armazenar              |
| Materiais             | `/soroteca/materiais`   | Catálogo canônico de materiais          |
| Empréstimos           | `/soroteca/emprestimos` | Solicitar / aprovar / devolver          |
| Expurgo               | `/soroteca/expurgo`     | Lotes, execução e timeline (Fase 8)     |

### Características
- `NavLink` com `isActive` → highlight em Primary (#4D41F3) quando você está na rota.
- Ícones `lucide-react`, h-9, rounded-lg, `border-b` separador.
- Flex-wrap → responsivo de mobile a desktop.
- Zero dependências novas.

## Higiene de código aplicada
- Removida duplicação de "ItemDef as const" → tipagem explícita.
- Mantido padrão de stores existentes (sem refactor amplo, zero regressão).
- Toda navegação interna unificada em **um único arquivo de 50 linhas**;
  qualquer item novo (Fases 10+) entra editando uma única lista.

## Checklist final (Fases 1–9)
- [x] Estrutura física real (Locais / Galerias / Posições)
- [x] Triagem operacional com scanner HID
- [x] Armazenamento rastreável (alocações com auditoria)
- [x] Catálogo de materiais
- [x] Pesquisa avançada com paginação server-side
- [x] Empréstimos auditáveis (state machine + uniqueness index)
- [x] Expurgo programado (lote + itens + trigger automático)
- [x] Timeline real do expurgo
- [x] Navegação enxuta e intuitiva entre módulos
- [x] Zero regressão em Atendimento, Coleta, Produção, Resultados
- [x] Scanner HID, etiquetas e reuso preservados

## Critério de sucesso atendido
Qualquer operador entra em `/soroteca` e, **sem treinamento**, vê e acessa
todos os módulos da Soroteca em um clique.
