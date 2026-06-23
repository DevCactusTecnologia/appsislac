# Plataforma 2.1 — Fase 5: documento_templates

## Diagnóstico

- Tabela com **6 linhas**, **1 848 calls** observados em `pg_stat_statements`.
- Mean 56,6 ms / Total 104 599 ms.

## Análise do consumidor

`src/data/documentoTemplatesStore.ts` já implementa **store singleton com cache em memória**:

```ts
let _initStarted = false;
let _initPromise: Promise<void> | null = null;

export async function _initDocumentoTemplatesStore() {
  if (_initPromise) return _initPromise;   // memoização
  ...
}
export function ensureDocumentoTemplatesLoaded() {
  if (!_initStarted) return _initDocumentoTemplatesStore();
  return _initPromise ?? Promise.resolve();
}
```

**O store carrega uma única vez por sessão de browser.** As 1 848 calls vêm de:
- múltiplas abas/janelas abertas por dia,
- sessões de usuários reais (caixa, recepção, laboratório, super-admin),
- reloads (F5) durante o desenvolvimento e suporte.

Não há polling, nem `useEffect` em loop, nem realtime sobre essa tabela.

## Conclusão

**Não há otimização válida nesta camada.** Métricas/segundo são marginais. O custo total (~100 s acumulados em todo o histórico de boot) é desprezível.

## Ação

Nenhuma alteração de código.

Eventual otimização futura (fora desta fase): pré-publicar os 6 templates como JSON estático servido em CDN, evitando boot do Supabase. Requer mudança funcional — **fora do escopo de 2.1**.
