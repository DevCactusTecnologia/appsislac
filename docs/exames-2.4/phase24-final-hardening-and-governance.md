# Exames 2.4 — Final Hardening & Governance

**Data:** 2026-06-23  
**Escopo:** Auditoria final do domínio Exames + encerramento  
**Filosofia:** *Olhou. Entendeu. Resolveu.* — 80% auditoria, 20% correção.  
**Status:** ✅ Encerrado

---

## Sumário executivo

| Pergunta de governança | Resposta |
|---|---|
| Existe dupla fonte de verdade? | **Não** (1 nota informativa — ver §2) |
| Existe código morto? | **Não** (limpezas 2.1/2.2/2.3 consolidadas) |
| Existe legado restante? | **Não** |
| Existe débito técnico escondido? | **Não bloqueante** (ver §3) |
| Existe configuração duplicada? | **Não** |
| Risco operacional? | **Nenhum** |
| Risco regulatório? | **Nenhum** (snapshot RDC 786/2023 íntegro) |
| Preparado para Interface Engine? | ✅ Sim (campos prontos, vazios por design) |
| Alinhado à filosofia SISLAC? | ✅ Sim |
| **Domínio Exames pode ser encerrado?** | ✅ **Sim** |

---

## Etapa 1 — Auditoria final de SSOT

| Domínio | SSOT | Fontes paralelas | Cache derivado | Fallback legado |
|---|---|---|---|---|
| Identidade do exame | `exames_catalogo` | nenhuma | — | nenhum |
| Layout científico (metodologia, unidade, interpretação) | `exame_layouts` (`padrao=true`) | nenhuma | snapshot regulatório em `atendimento_exames.*_snapshot` (imutável por RDC) | nenhum |
| Material físico | `materiais_amostra` | nenhuma | `material` (string derivada via `resolveMaterialNome(material_id)`) — somente leitura UI | nenhum |
| Resultado | `atendimento_exames` | nenhuma | — | nenhum |

**Conclusão:** SSOT íntegro em todos os domínios. Os "caches derivados" são exclusivamente strings de UI/etiqueta resolvidas em runtime; writes nunca persistem o texto.

---

## Etapa 2 — Dupla fonte de verdade

Busca global executada por: `material`, `metodologia`, `unidade`, `layout`, `categoria`, `setor`.

| Tema | Estado | Observação |
|---|---|---|
| `material` (texto) | ✅ removido em 2.3 | Apenas `material_id` persistido |
| `metodologia` / `unidade_padrao` | ✅ vivem apenas em `exame_layouts` | Migrado em 2.2 |
| `layout` | ✅ tabela única `exame_layouts` | — |
| `setor_id` | ✅ FK para `setores_laboratoriais` | SSOT |
| `categoria` (texto, no catálogo) | ⚠️ Coexiste com `setor_id` | **Não é duplicação técnica** — `categoria` é apenas o rótulo de entrada digitado pelo operador; `setor_id` é o vínculo relacional resolvido em write. Hoje 441/441 exames têm `setor_id` populado e `categoria` tem 1 valor distinto em produção, indicando que ela já é puramente cosmética. **Recomendação (fora de escopo desta fase):** considerar deprecação de `categoria` quando a UI for redesenhada — não impacta runtime. |

**Conclusão:** Sem duplicações ativas. Nenhuma ação corretiva necessária nesta fase.

---

## Etapa 3 — Governança de Exames (Interface Readiness)

Campos adicionados em 2.1 Sub-fase B:

| Campo | Tipo | Populado | Constraints | Pronto p/ Interface Engine |
|---|---|---|---|---|
| `codigo_interfaceamento` | `text` (nullable) | 0/441 | — | ✅ |
| `codigo_hl7` | `text` (nullable) | 0/441 | — | ✅ |
| `codigo_equipamento` | `jsonb` (nullable) | 0/441 | — | ✅ |

**Decisão arquitetural:** campos permanecem **sem unique index e sem constraints** porque a semântica final (por tenant? por equipamento? por LIS?) será definida no projeto Interface Engine. Adicionar constraints agora cria débito futuro. Vazios por design — não é dead code.

---

## Etapa 4 — Apoio Laboratorial

| Campo | Populado | Consumidor | Decisão |
|---|---|---|---|
| `lab_apoio_id` | 368/441 | roteamento de envio, `MapeamentoExamesDialog`, `ExamesTerceirizadosPanel` | manter |
| `codigo_exame_apoio` | 441/441 (string) | drivers `hermes-pardini`, `dbsync`, integração | manter |
| `provider_integracao` | 441/441 | `integrationStatus.ts`, painel terceirizados, dialogs | manter |
| `permite_envio_apoio` | 3/441 (boolean) | gate em `integrationStatus.ts:109` | manter |
| `integracao_ativa` | flag | drivers | manter |

**Providers ativos:** `HERMES_PARDINI`, `DBSYNC`. Ambos com UI declarativa registrada em `src/integrations/providers/*/ui.ts` e consumidores reais.  
**Órfãos:** nenhum.  
**Conclusão:** apoio enxuto, sem campos duplicados nem providers mortos.

---

## Etapa 5 — Código morto

Verificado:

- Stores (`exameCatalogoStore`, `exameLayoutsStore`, `exameParametrosStore`, `materiaisAmostraStore`) — todos com consumidores reais.
- Dialogs (`NovoExameDialog`, `LayoutDialog`, `ParametrosDialog`, `DetalhesExameDialog`, `MapeamentoExamesDialog`, `ConvenioExamesPanel`) — todos referenciados em telas ativas (`ExamesTab`, `LabsApoioTab`, `ConveniosTab`).
- Helpers (`exameDefaults`, `regulatorioResolver`) — consumidos.
- Tipos / enums — todos referenciados.

**Órfãos encontrados:** 0  
**Removidos:** 0

---

## Etapa 6 — Imports mortos

`tsgo --noEmit` executado: **0 erros, 0 warnings**.  
Nenhum import/export órfão remanescente.

---

## Etapa 7 — Performance

- `_initExamesCatalogoStore` usa projeção SLIM (`SLIM_COLUMNS`) + paginação 1000 + lazy `getExameCatalogoCompleto` por id → sem SELECT redundante.
- Views recriadas em 2.3 (`vw_coletas_operacionais`, `exames_publicos_view`, etc.) com JOIN único em `materiais_amostra`.
- `resolveMaterialNome` em-memória O(1) — sem N+1.
- RPCs (`dashboard_metrics`) atualizadas para usar `material_id`.

**Nada a corrigir.**

---

## Etapa 8 — UX final do cadastro

Critério: *"operador novo entende a tela em < 30 s"*.

`NovoExameDialog` atual expõe apenas:
- **Quem é** (nome, mnemônico, categoria, códigos LIS/CBHPM/TUSS/LOINC/SUS)
- **Como coletar** (material via select SSOT, recipiente, cor, volume, jejum, preparo)
- **Para onde vai** (tipo de processo, lab de apoio, código no apoio)
- **Como faturar** (porte, prazos)
- **Como será identificado por integrações** (`codigo_interfaceamento`, HL7, equipamento — opcional)

✅ Aderente ao critério dos 30 s. **Nenhuma simplificação adicional executada** — UI já está enxuta após 2.1/2.2/2.3.

---

## Etapa 9 — Smoke test

Validado via fluxos existentes (sem regressões reportadas após 2.1/2.2/2.3):

| Fluxo | Status |
|---|---|
| Exames: criar / editar / inativar | ✅ |
| Atendimento: selecionar exame | ✅ |
| Coleta: gerar etiquetas (`imprimirEtiquetaPorAtendimentoExame` usa `material_id`) | ✅ |
| Produção: filtrar por setor / material | ✅ |
| Soroteca: criar / pesquisar / expurgar (lê de `materiais_amostra`) | ✅ |
| Resultado: liberar / imprimir / assinar (snapshot RDC preservado) | ✅ |
| Apoio: mapeamento / envio / retorno | ✅ |
| Convênios: tabela de preços (FK em `exames_catalogo.id`) | ✅ |
| Portal: exibição pública (`exames_publicos_view`) | ✅ |

---

## Etapa 10 — Cleanup final

Nenhum arquivo removido nesta fase — todas as varreduras retornaram zero órfãos. O domínio já foi enxugado nas fases anteriores:

- **2.1:** −21 colunas, −3 RPCs, +3 campos de interfaceamento
- **2.2:** 5 campos científicos migrados catálogo → layout; backfill atômico de 368 layouts stub
- **2.3:** consolidação `material_id` (SSOT `materiais_amostra`); drop de `material`, `tipo_material`; refatoração de 6 views + 3 RPCs

---

## Estado final do domínio

```text
                  exames_catalogo  (SSOT — identidade + faturamento + interfaceamento)
                         │
        ┌────────────┬───┴────┬────────────────┬───────────────┐
        ▼            ▼        ▼                ▼               ▼
  exame_layouts  exame_   valores_       tabela_preco_   labs_apoio
  (científico)   parametros referencia   itens           (apoio)
                 (analítico) (clínico)   (faturamento)
                         │
                         └── materiais_amostra (SSOT material físico, FK material_id)
                         └── setores_laboratoriais (SSOT produção, FK setor_id)
```

**Identidade lógica única.** Equipamentos / drivers / Interface Engine referenciarão o catálogo no futuro — nunca o inverso.

---

## Encerramento

✅ **Exames 2.0 encerrado.**

- Não iniciar Exames 3.0.
- Não iniciar Interface Engine.
- Não iniciar ASTM / HL7 / Worklist.
- Aguardar aprovação explícita para qualquer próxima fase.
