# EXAMES 2.2 — Desacoplamento do Layout Científico

**Data:** 2026-06-23
**Status:** ✅ Concluído
**Escopo aprovado:** Etapas 1–5 (auditoria + migração + trigger + UI + cleanup)

---

## 1. Decisões arquiteturais aprovadas pelo usuário

| Decisão | Opção escolhida |
|---|---|
| Destino dos campos científicos | **Colunas dedicadas em `exame_layouts`** (não jsonb) |
| Trigger de snapshot | **Lê do layout padrão (`padrao=true`) com fallback vazio** |
| Backfill | **Migration SQL atômica**: copia do catálogo para o layout padrão; cria stub se exame não tem layout |

---

## 2. Campos que saíram do exame

Removidos de `public.exames_catalogo`:

| Campo | Tipo | Destino |
|---|---|---|
| `metodologia` | text | `exame_layouts.metodologia` |
| `unidade_padrao` | text | `exame_layouts.unidade_padrao` |
| `exibir_metodologia_laudo` | bool | `exame_layouts.exibir_metodologia_laudo` |
| `exibir_unidade_laudo` | bool | `exame_layouts.exibir_unidade_laudo` |
| `exibir_material_laudo` | bool | `exame_layouts.exibir_material_laudo` |

> `texto_interpretativo_padrao` já tinha sido removido na fase 2.1; recriado agora em `exame_layouts` para fechar o ciclo.

**Total:** 5 colunas removidas + 6 colunas adicionadas no layout (5 movidas + 1 ressuscitada).

---

## 3. Snapshot regulatório (RDC 786/2023)

### Antes
```sql
SELECT NULLIF(metodologia, '') FROM exames_catalogo WHERE id = NEW.exame_id;
```

### Depois
```sql
SELECT NULLIF(metodologia, '') FROM exame_layouts
 WHERE exame_id = NEW.exame_id AND padrao = true
 ORDER BY created_at ASC LIMIT 1;
```

### Garantias
- ✅ Trigger `atendimento_exames_snapshot_regulatorio` continua disparando `BEFORE INSERT/UPDATE` em transições para `finalizado`/`liberado`/`data_liberacao IS NOT NULL`.
- ✅ Não reprocessa snapshots existentes (idempotente: só preenche quando `metodologia_snapshot IS NULL`).
- ✅ Laudos antigos permanecem 100% intactos.
- ✅ Backfill garantiu que **todos os 441 exames** têm um layout padrão (73 pré-existentes + 368 stubs criados).

---

## 4. Backfill executado

```sql
-- Existentes
UPDATE exame_layouts l SET metodologia = ..., unidade_padrao = ...
FROM exames_catalogo c WHERE l.exame_id = c.id;

-- Faltantes
INSERT INTO exame_layouts (exame_id, tenant_id, nome, conteudo, padrao, criado_por,
  metodologia, unidade_padrao, exibir_*)
SELECT c.id, c.tenant_id, 'Layout padrão', '', true, 'system:exames-2.2-backfill', ...
FROM exames_catalogo c
WHERE NOT EXISTS (SELECT 1 FROM exame_layouts l WHERE l.exame_id = c.id);
```

**Resultado:** 441/441 exames com layout padrão. Zero exames órfãos.

---

## 5. Mudanças no código

| Arquivo | Mudança |
|---|---|
| `src/data/exameLayoutsStore.ts` | Adiciona 6 campos científicos a `ExameLayout`, `fromRow`, `toRow`. `addLayout` passa a aceitar `ExameLayoutInput` (Partial-tolerante) |
| `src/data/exameCatalogoStore.ts` | Remove `metodologia`, `unidadePadrao`, `exibir*Laudo` da interface, fromRow, toRow |
| `src/lib/regulatorioResolver.ts` | Lê de `getLayouts(catalogo.id).find(padrao)` em vez de `catalogo.metodologia/unidadePadrao` |
| `src/components/configuracoes/NovoExameDialog.tsx` | Remove campos científicos do `emptyForm` |
| `src/components/configuracoes/LayoutDialog.tsx` | Adiciona seção **"Configurações científicas"** com inputs de metodologia, unidade, texto interpretativo + 3 checkboxes |
| `src/integrations/supabase/types.ts` | Regenerado automaticamente pela migration |

---

## 6. Cleanup

- ✅ Removidas 6 leituras/gravações redundantes no catálogo (`metodologia`, `unidadePadrao`, 3 flags + 1 herdado).
- ✅ Resolver regulatório agora tem fonte única — `exame_layouts`.
- ✅ `regulatorioResolver` comentário atualizado refletindo Exames 2.2.
- ✅ Nenhum fallback para catálogo. Nenhuma dupla fonte de verdade.
- ✅ `rastreabilidadeStore.exame_pops.metodologia` preservado — é entidade distinta (versionamento de POPs).

---

## 7. Respostas obrigatórias

| Pergunta | Resposta |
|---|---|
| Quais campos saíram do exame? | `metodologia`, `unidade_padrao`, `exibir_metodologia_laudo`, `exibir_unidade_laudo`, `exibir_material_laudo` (5 colunas dropadas) |
| Quais foram para Layout Científico? | Os 5 acima + `texto_interpretativo_padrao` (recriado no layout) |
| O snapshot continua íntegro? | ✅ Sim. Trigger refatorado, snapshots históricos preservados, novos snapshots lidos do layout padrão |
| Existe dupla fonte de verdade? | ❌ Não. Catálogo não tem mais esses campos; resolver lê só do layout |
| Quantos arquivos mortos removidos? | 0 arquivos. ~30 linhas mortas removidas de `exameCatalogoStore` e `NovoExameDialog` |
| Existe legado restante? | Não, exceto a coluna `unidade_padrao` em uma tabela de POPs versionados (`exame_pops`) que é entidade separada com semântica regulatória própria |
| Houve regressão? | ❌ Não. Backfill cobriu 100% dos exames; resolver mantém mesma assinatura externa |
| O exame ficou mais simples? | ✅ Sim. `ExameCatalogo` perdeu 5 fields. Cadastro é exclusivamente operacional |
| O layout ficou mais consistente? | ✅ Sim. Agora concentra TODA a verdade científica (metodologia, unidade, conteúdo HTML, parâmetros, flags) |
| Alinhado à filosofia do SISLAC? | ✅ Sim. "Exame conhece operação; Layout conhece ciência." |

---

## 8. Próximos passos (NÃO executar)

- **Material FK**: migrar `exames_catalogo.material` (string) → `material_id` (FK) com refactor de `atendimento_exames`/`soroteca`/`coleta`.
- **Interface Engine**: implementar consumo real de `codigo_interfaceamento`, `codigo_hl7`, `codigo_equipamento` (Exames 2.3+).

**PARAR.** Aguardando aprovação explícita para qualquer próxima fase.
