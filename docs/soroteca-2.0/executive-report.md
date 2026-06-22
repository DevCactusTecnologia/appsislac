# Soroteca 2.0 — Fase 1.10 — Relatório Executivo

> Radiografia do domínio Soroteca no SISLAC. Esta fase é **100% leitura**. Nenhuma linha de código, schema, RLS ou UX foi alterada.

## TL;DR

O SISLAC já tem um **núcleo sólido** de amostragem (tabela `amostras`, geração de código sequencial com DV, RLS multi-tenant, auditoria, integração nativa com Coleta e reuso em Atendimento). Falta a **camada física e operacional**: hierarquia de armazenamento, catálogo de material, empréstimo, expurgo programado e UX de busca avançada.

A próxima fase é **aditiva** — preservar o existente e construir em camadas.

## 1. O que existe hoje (e funciona)

| Capability | Onde | Estado |
|---|---|---|
| Criação automática de amostra na coleta | `RegistrarColeta` → `criarAmostraParaExame` | ✅ |
| Código de barras sequencial diário com DV | RPC `gerar_codigo_amostra` | ✅ |
| Reaproveitamento de amostra entre exames | `NovoAtendimento` + `ReutilizarAmostraDialog` | ✅ |
| Agrupamento "1 amostra = 1 lab" em terceirizados | `labApoio.resolveAmostrasPorLab` | ✅ |
| Job de validade biológica | `marcar_amostras_vencidas()` | ✅ |
| Descarte com confirmação | `Soroteca` + `AlertDialog` | ✅ |
| Detalhe rico (paciente, exames, timeline, terceirizado) | `AmostraDetalheDialog` | ✅ |
| Scanner HID global | `Soroteca.tsx` useEffect window | ✅ |
| Etiquetas impressas | `etiquetaAmostra` + `imprimirEtiquetaPorAtendimentoExame` | ✅ |
| RLS multi-tenant + permissões | 4 policies em `amostras` | ✅ |
| Auditoria trigger | `audit_amostras` → `audit_trigger` | ✅ (não exposta na UI) |

## 2. O que está incompleto

- **Validade hard-coded em 24h** — ignora exames com estabilidade real.
- **Material como texto livre** — sem catálogo nem regras.
- **Localização como texto livre** — sem hierarquia física.
- **Lista server-side sem paginação** — `listarAmostras()` baixa tudo do tenant.
- **Timeline derivada** — não lê `public.auditoria`.
- **Descarte sem campo de motivo** dedicado.

## 3. O que está duplicado

- Índice `idx_amostras_tenant_codigo` é redundante com `amostras_codigo_barra_tenant_unique`.
- `buscarAmostrasReutilizaveis` × `buscarAmostrasReutilizaveisPorNome` — convivem; segunda é wrapper.

## 4. O que está órfão / morto

- `void reutilizarAmostra;` em `NovoAtendimento.tsx:2557` — chamada no-op.
- Nenhum arquivo de Soroteca está sem consumidores.

## 5. O que precisa ser removido (Fase 2 — mediante aprovação)

| Item | Risco | Ação proposta |
|---|---|---|
| `void reutilizarAmostra;` em NovoAtendimento | Baixo | Remover linha morta |
| `idx_amostras_tenant_codigo` | Baixo | DROP INDEX (já coberto pelo UNIQUE) |
| `VALIDADE_PADRAO_HORAS` hard-coded | Médio | Migrar para tabela `materiais_amostra` |

## 6. O que deve ser preservado

- Tabela `amostras` (esqueleto e FKs).
- Função `gerar_codigo_amostra` + `_calc_dv_amostra` + `amostra_sequence`.
- `audit_trigger`.
- Store unificada `sorotecaStore.ts` como SSoT.
- Scanner HID global.
- Modelo "amostra emerge da coleta, nunca criada manualmente".

## 7. Gaps maiores vs SISVIDA

| Gap | Severidade |
|---|---|
| Hierarquia física (local → galeria → posição) | 🔴 Alto |
| Empréstimo de amostras | 🟡 Médio |
| Expurgo programado (com janela de retenção) | 🟡 Médio |
| Triagem como pipeline próprio | 🟡 Médio |
| Catálogo de material com estabilidade | 🟡 Médio |
| Pesquisa avançada com filtros estruturados | 🟢 Baixo (rápido de adicionar) |
| Grade visual de orifícios | 🟢 Baixo (UI nova, sem dor de migração) |

## 8. Classificação de complexidade

| Categoria | Item | Risco |
|---|---|---|
| Baixo | Adicionar filtros server-side | 🟢 |
| Baixo | Remover índice duplicado | 🟢 |
| Baixo | Expor timeline de `auditoria` | 🟢 |
| Médio | Catálogo de materiais + migração de `tipo_material` text → FK | 🟡 |
| Médio | Empréstimo (tabela nova + UI) | 🟡 |
| Médio | Expurgo programado (política + execução) | 🟡 |
| Alto | Hierarquia física (4 tabelas novas + grade visual + migração de `localizacao`) | 🔴 |
| Alto | Adicionar estados ao enum (`EM_TRIAGEM`, `EMPRESTADA`, `EXPURGADA`) sem quebrar consumidores | 🔴 |

## 9. Arquitetura recomendada para Soroteca 2.0

```text
┌─ Camada Física ────────────────────────────────┐
│ locais_armazenamento ──< galerias ──< posicoes │
└────────────────────┬───────────────────────────┘
                     │
┌─ Camada Lógica ────▼───────────────────────────┐
│ amostras (existente + colunas novas opcionais) │
│   + material_id → materiais_amostra            │
│   + setor_id   → setores_laboratoriais         │
│   + posicao_id → posicoes (nullable)           │
└─────┬──────────────────────────────────────────┘
      │
┌─ Camada Operacional ──────────────────────────┐
│ amostra_alocacoes (histórico de posições)     │
│ amostra_emprestimos                           │
│ amostra_expurgos (políticas + execuções)      │
└───────────────────────────────────────────────┘
      │
┌─ UI ──────────────────────────────────────────┐
│ /soroteca              (lista unificada)      │
│ /soroteca/triagem      (pipeline)             │
│ /soroteca/galerias     (mapa físico)          │
│ /soroteca/expurgo      (programado)           │
│ /soroteca/emprestimos  (controle)             │
└───────────────────────────────────────────────┘
```

## 10. Roadmap recomendado

| Fase | Escopo | Risco |
|---|---|---|
| **F2** | Catálogo de materiais + migração `tipo_material` (texto → FK opcional, fallback mantido) | 🟡 |
| **F3** | Hierarquia física (locais/galerias/posições) + UI de cadastro + grade visual read-only | 🟡 |
| **F4** | Triagem como pipeline + alocação física + atualização de `localizacao` derivada | 🟡 |
| **F5** | Pesquisa avançada server-side + drawer de filtros + paginação | 🟢 |
| **F6** | Empréstimo (tabela, UI, bloqueio de reuso) | 🟡 |
| **F7** | Expurgo programado (política + execução em lote + lote auditável) | 🟡 |
| **F8** | Timeline real (consumir `public.auditoria`) + permissões granulares | 🟢 |
| **F9** | Cleanup: drop índice duplicado, remoção de código morto, deprecation de campos texto livres | 🟢 |

## 11. Critério de sucesso da Fase 1

✅ Radiografia completa entregue em 10 documentos.
✅ Nenhuma alteração executada.
✅ Clareza sobre o que existe, o que falta, o que duplica e o que vale modernizar.

## 12. Regra de parada

**STOP.** Próxima fase só inicia mediante **aprovação explícita**.
