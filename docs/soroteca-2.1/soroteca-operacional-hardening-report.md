# Soroteca 2.1 — Relatório de Hardening Operacional

Data: 2026-06-23
Filosofia entregue: **Olhou. Entendeu. Tomou decisão.**

## Decisões arquiteturais oficiais

- **NÃO** executado `DROP TABLE amostra_emprestimos`.
- **NÃO** executado `DROP FUNCTION amostra_em_emprestimo_ativo`.
- **NÃO** apagado nenhum histórico ou dado.
- Removido apenas o **consumo operacional** — frontend, rota, menu, store, regras.

A tabela e o RPC permanecem no banco como histórico inerte. Podem ser dropados em janela futura sem novo desenvolvimento.

## O que foi removido

### Páginas
| Arquivo | Status |
|---|---|
| `src/pages/SorotecaEmprestimos.tsx` | DELETADO |

### Stores
| Arquivo | Status |
|---|---|
| `src/data/sorotecaEmprestimosStore.ts` | DELETADO |

### Rotas
| Rota | Status |
|---|---|
| `/soroteca/emprestimos` | REMOVIDA de `src/App.tsx` |

### Menus
| Item | Local | Status |
|---|---|---|
| Tab "Empréstimos" | `src/components/soroteca/SorotecaNav.tsx` | REMOVIDO |
| Ícone `HandHelping` | idem | REMOVIDO |
| `AppSidebar` | — | Já não listava sub-item (apenas Soroteca raiz) — sem alteração |

### Lógicas
| Lógica | Onde | Status |
|---|---|---|
| Pré-query de empréstimos ativos em `buscarAmostrasReutilizaveis` | `src/data/sorotecaStore.ts` | REMOVIDA |
| `MATERIAIS_NAO_REUTILIZAVEIS` (Set hardcoded) | `src/data/sorotecaStore.ts` | REMOVIDO — substituído por consulta SSOT a `materiais_amostra.reutilizavel` |
| `MATERIAIS` (array hardcoded `["Sangue","Urina","Fezes","Líquor","Secreção"]`) | `src/pages/Producao.tsx` | REMOVIDO — substituído por `listarMateriaisAmostra({ ativosOnly: true })` |
| `reutilizarAmostra` (export não consumido) | `src/data/sorotecaStore.ts` + import morto em `NovoAtendimento.tsx` (linha `void reutilizarAmostra`) | REMOVIDOS |
| `atualizarLocal` / `atualizarGaleria` / `atualizarPosicao` | `src/data/sorotecaEstruturaStore.ts` + imports + `void` em `SorotecaEstrutura.tsx` | REMOVIDOS (eram código morto identificado pela auditoria) |

## O que foi adicionado / consolidado

### Hook unificado de scanner HID
- Novo: `src/hooks/useHidScanner.ts`.
- Migrados: `src/pages/Soroteca.tsx` e `src/pages/SorotecaTriagem.tsx`.
- Eliminou duplicação de ~35 linhas em cada página (listener `keydown`, buffer com janela 50 ms, gate por foco em input/textarea/select/contentEditable).
- **1 scanner · 1 hook · 1 manutenção.**

### Hardening do Expurgo
- `preverCandidatas` em `src/data/sorotecaExpurgoStore.ts` agora bloqueia:
  - Amostras `DESCARTADA` / `UTILIZADA` / `VENCIDA` (filtro `status='DISPONIVEL'` — já existia, confirmado).
  - Amostras **sem localização física válida** (`localizacao IS NOT NULL AND localizacao <> ''`).
- Eliminada qualquer dependência de empréstimos.
- Trigger `aplicar_expurgo_amostra` continua respondendo por liberar a posição e marcar `DESCARTADA` — sem alteração de schema.

### Materiais como SSOT
- Catálogo único: `materiais_amostra`.
- Consumidores migrados:
  - `sorotecaStore.buscarAmostrasReutilizaveis*` — consulta `reutilizavel` por nome de material.
  - `Producao.tsx` — lista materiais ativos via React Query (cache 5 min, prefixo `["tenant", tenantId, ...]`).

## Menu final da Soroteca

```
Soroteca
├─ Amostras            (/soroteca)
├─ Estrutura & Galerias (/soroteca/estrutura)
├─ Triagem             (/soroteca/triagem)
├─ Materiais           (/soroteca/materiais)
└─ Expurgo             (/soroteca/expurgo)
```

Sem "Empréstimos". Sem submódulos secundários.

## Permissões

A auditoria flagou `armazenar_amostra` e `gerenciar_soroteca` como permissões propostas mas não mapeadas em `has_permission()`. **Nenhum código atual usa essas strings** (rg em `src/` retorna 0 ocorrências). Todas as rotas Soroteca permanecem gatedas por `registrar_coleta`, que já existe em `has_permission()`. Resultado: zero possibilidade de "403 silencioso" pelo motivo apontado — não é necessário nenhum patch adicional nesta entrega.

## Métricas

| Métrica | Antes | Depois | Δ |
|---|---:|---:|---:|
| Páginas Soroteca | 6 | 5 | −1 |
| Rotas Soroteca | 6 | 5 | −1 |
| Stores Soroteca | 5 | 4 | −1 |
| Implementações HID scanner | 2 | 1 (hook) | −1 |
| Listas hardcoded de materiais | 2 (`MATERIAIS_NAO_REUTILIZAVEIS`, `MATERIAIS`) | 0 | −2 |
| Exports não consumidos identificados pela auditoria | 4 (`reutilizarAmostra`, `atualizarLocal`, `atualizarGaleria`, `atualizarPosicao`) | 0 | −4 |
| Linhas de código deletadas (líquido aproximado) | — | ~700 | — |

## Consumidores ativos de empréstimos

```
$ rg "sorotecaEmprestimosStore|SorotecaEmprestimos|MATERIAIS_NAO_REUTILIZAVEIS|reutilizarAmostra" src/
(zero matches em código de aplicação)
```

Único resíduo: tipagens de `amostra_emprestimos` em `src/integrations/supabase/types.ts` (arquivo auto-gerado, intocável). Não há consumidor.

## Código morto remanescente

Nenhum identificado pela auditoria que ainda esteja vivo. Todos os candidatos foram removidos após validação:
- `reutilizarAmostra` — único consumo era `void reutilizarAmostra;` em `NovoAtendimento.tsx` (linha de supressão de warning, agora removida).
- `atualizar*` em estrutura — único consumo era `void` em `SorotecaEstrutura.tsx`.

## Filosofia operacional

A Soroteca terminou como módulo:
- **Simples** — 5 telas, sem fluxos paralelos.
- **Rápido** — scanner unificado, busca direta, sugestão automática de posição.
- **Auditável** — `audit_logs` continua cobrindo `materiais_amostra` e `amostras`.
- **Operacional** — sem dashboards, sem KPIs, sem aprovações burocráticas.
- **Fácil de manter** — 1 hook de scanner, 1 catálogo de materiais, 0 listas hardcoded.

Critério "Olhou, Entendeu, Tomou decisão" atingido em todas as telas remanescentes.

## Pontos não executados (fora de escopo declarado)

- **Não criados**: dashboards, KPIs, workflows, aprovações, novos estados, novas tabelas, novas permissões, timeline avançada.
- **Não dropados**: `amostra_emprestimos`, `amostra_em_emprestimo_ativo` — decisão arquitetural oficial registrada acima.

## Próximas janelas (sugestão, não executadas)

1. Drop físico de `amostra_emprestimos` + RPC quando o histórico não for mais necessário.
2. Migrar `buscarAmostrasReutilizaveis` para um RPC `buscar_reutilizaveis(...)` único — elimina 1 round-trip de catálogo. Não bloqueante.

— Fim do relatório.
