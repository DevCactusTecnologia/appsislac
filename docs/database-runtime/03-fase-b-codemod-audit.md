# Runtime 2.0 — Fase B: Codemod do Frontend (Auditoria de Encerramento)

**Status**: ✅ Concluída
**Escopo**: substituir a porta de acesso ao banco em todo o domínio frontend
do antigo singleton `@/integrations/supabase/client` para a nova porta única
`@/runtime/db`, sem alterar regras de negócio, queries, RLS, Auth ou
comportamento funcional.

## 1. Estratégia adotada (mecânica)

Codemod **estritamente textual**, aplicado via `sed` numa única expressão
sobre 119 arquivos do domínio:

```
import { supabase } from "@/integrations/supabase/client";
   ↓
import { db as supabase } from "@/runtime/db";
```

Justificativa do alias (`db as supabase`):

- Mantém **zero alteração** em todos os call sites (`supabase.from(...)`,
  `supabase.auth.getUser()`, `supabase.storage.from(...)`, etc.).
- Substitui apenas a **porta** (a fonte do binding), preservando a semântica
  ponto a ponto.
- Elimina risco de colisão acidental em strings (`source: "supabase"`),
  comentários, URLs ou identificadores homônimos.
- A renomeação cosmética `supabase → db` no corpo dos arquivos é um passo
  opcional que pode ser feito em PR separado, sem bloquear o ganho
  arquitetural da Fase B.

Toda chamada continua roteada via Proxy do `db` exportado por
`src/runtime/db/index.ts`, que delega para `getClient()` da `Factory` →
`Resolver` → `SharedStrategy` (ou `DedicatedStrategy` no futuro).

## 2. Arquivos NÃO migrados (intencional)

| Arquivo                                | Razão                                                                 |
| -------------------------------------- | --------------------------------------------------------------------- |
| `src/integrations/supabase/client.ts`  | Fonte do singleton legado — consumido apenas pelo `resolver` interno. |
| `src/runtime/db/**`                    | Núcleo do runtime (Factory, Resolver, Strategies, Types, Telemetria). |
| `src/BEST_PRACTICES.md`                | Documentação (não código).                                            |
| `src/lib/validarCredenciaisAnalista.ts`| Exceção documentada (cliente transiente para validar senha).          |

`validarCredenciaisAnalista.ts` permanece como única exceção controlada
fora do núcleo runtime — será migrada na **Fase D (Auth)**, conforme já
registrado no Gate Review da Fase A (`02-gate-review-fase-a.md`, §1.1).

## 3. Auditoria automática (critérios obrigatórios)

### 3.1 Zero `createClient(` fora do núcleo runtime

```
$ rg -n "createClient\(" src -t ts | rg -v "^src/runtime/db/"
src/lib/validarCredenciaisAnalista.ts:55:  const transient = createClient(...
```

Resultado: **1 ocorrência, exceção pré-existente e documentada** (Fase D).
Todas as demais (`factory.ts`, `types.ts`, `strategies/*.ts`, smoke test)
estão no núcleo `src/runtime/db/`.

### 3.2 Zero imports de `@/integrations/supabase/client` fora da infra

```
$ rg -n '@/integrations/supabase/client' src \
    | rg -v "^src/integrations/supabase/|^src/runtime/db/|^src/BEST_PRACTICES"
(vazio)
```

Resultado: **0 violações**. O guard ESLint `no-restricted-imports`
continua ativo e protege regressões.

### 3.3 Total de consumidores migrados para a porta `db`

```
$ rg -l 'from "@/runtime/db"' src | wc -l
121
```

(119 arquivos do domínio migrados + `runtime/db/index.ts` + smoke test.)

### 3.4 Typecheck

```
$ bun run typecheck
$ tsc --noEmit -p tsconfig.app.json
(exit 0, sem erros)
```

### 3.5 Lint (regra de runtime)

```
$ bun run lint 2>&1 | grep -E "runtime/db|no-restricted-imports"
(zero violações da regra no-restricted-imports)
```

Erros de lint pré-existentes em `supabase/functions/**` e
`tailwind.config.ts` (any-typing, ts-ignore, etc.) **não foram introduzidos
nem tocados** pelo codemod — são débito anterior fora do escopo da Fase B.

### 3.6 Smoke test do runtime

```
$ bun run test src/runtime/db/__tests__/runtime.smoke.test.ts
✓ porta única `db` é um proxy do client resolvido
✓ SharedStrategy retorna sempre o mesmo singleton
✓ DedicatedStrategy falha-fechada com RuntimeError
✓ cache é isolado por contexto e resetRuntime() limpa tudo

Tests  4 passed (4)
```

Suíte completa de testes apresenta 20 falhas **pré-existentes** (formatação
de fórmula, `errorHandling`, `rls.multitenancy`, etc.) — nenhum desses
arquivos foi alterado pelo codemod e nenhum depende do binding renomeado.

## 4. Garantias preservadas

| Invariante                                          | Estado |
| --------------------------------------------------- | :----: |
| Zero alteração em queries, joins, filtros, RPC      |   ✅   |
| Zero alteração em RLS / policies                    |   ✅   |
| Zero alteração em Auth (signIn/signOut/getSession)  |   ✅   |
| Zero alteração em Storage / Realtime                |   ✅   |
| API pública `supabase.*` 100% preservada nos consumidores |   ✅   |
| Rollback trivial (sed reverso na mesma linha)       |   ✅   |
| ESLint guard ativo bloqueando regressões            |   ✅   |
| Smoke test do runtime verde                         |   ✅   |
| Typecheck verde                                     |   ✅   |

## 5. Cleanup pontual

- Removido `// eslint-disable-next-line no-restricted-imports` em
  `src/runtime/db/strategies/shared.ts` — diretiva tornou-se obsoleta
  porque o arquivo passou a importar `__getSharedTransport` do
  `resolver.ts` (que é o único autorizado a tocar o singleton legado).

## 6. Rollback

Reversão atômica via `sed` inverso:

```
xargs -a /tmp/migrate.txt sed -i \
  's|^import { db as supabase } from "@/runtime/db";$|import { supabase } from "@/integrations/supabase/client";|'
```

Sem efeitos colaterais — o ESLint guard pode ser reativado/desativado
independentemente em `eslint.config.js`.

## 7. Próxima fase

**Fase C**: codemod equivalente nas ~70 Edge Functions
(`supabase/functions/**`), introduzindo uma porta `db` server-side
análoga, sem alterar comportamento das funções.
