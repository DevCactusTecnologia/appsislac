# 11 — Core Freeze Rules

**Status:** 🔒 CORE CONGELADO — SISLAC Database Migration Core v1.0

Este documento fixa as duas únicas regras de governança que sobrevivem ao freeze. Qualquer PR que as viole deve ser rejeitado em code review, independentemente da justificativa técnica aparente.

---

## Regra 1 — `src/runtime/db.ts` não cresce por conveniência

`src/runtime/db.ts` é o coração do runtime cliente. Concentra toda a API pública (`db`, `getTenantContext`, cache, `installTenantAuthInvalidation`, shims de compat). Isso é intencional: **uma única superfície pública**.

Baseline atual (freeze): **157 linhas**.

Regras:

- ❌ **Proibido** adicionar código a este arquivo apenas porque "cabe aqui".
- ❌ **Proibido** adicionar novas responsabilidades operacionais (telemetria, feature flags, roteamento de storage/realtime, helpers de domínio, etc.).
- ✅ **Permitido**: correção de bug, ajuste no cache de tenant, evolução do resolvedor de contexto.
- ⚠️ **Threshold**: se o arquivo ultrapassar ~300 linhas por acúmulo de responsabilidades, a solução **NÃO é criar módulos aleatórios**. É:
  1. Identificar a responsabilidade coesa que vazou (ex.: cache de tenant nome, listener de auth).
  2. Extrair **apenas** essa responsabilidade para um módulo interno (`src/runtime/_internal/*`).
  3. Manter `src/runtime/db.ts` como **única API pública reexportando** o que foi extraído.
  4. Nenhum outro arquivo do app pode importar do `_internal`.

Sem exceções. Sem "helper temporário". Sem "utility". Se o novo código não cabe nas caixas acima, o problema é modelagem de negócio — não runtime.

## Regra 2 — Fachada server-side (`_shared/runtime/db.ts`) segue a mesma disciplina

Baseline atual (freeze): **162 linhas**. Mesmas regras da Regra 1 aplicam-se. Nenhuma nova função pública sem justificativa técnica comprovada (ex.: rotina que só pode existir dentro do chokepoint por razões de segurança / service-role). Novos padrões de acesso a dados são consumidores — não expandem a fachada.

---

## Como medir

A cada PR que toca `src/runtime/db.ts` ou `_shared/runtime/db.ts`:

```
wc -l src/runtime/db.ts supabase/functions/_shared/runtime/db.ts
```

Se o total ultrapassar ~500 linhas somadas, é sinal amarelo obrigatório: revisar antes de mergear.

---

## Referência cruzada

- Freeze de infraestrutura original: `docs/database-runtime/runtime-freeze.md`
- Cirurgia arquitetural: `docs/database-runtime/surgery/01-removals.md` … `10-executive-report.md`

**Estas duas regras encerram o Core. Nada mais precisa ser adicionado ao freeze.**
