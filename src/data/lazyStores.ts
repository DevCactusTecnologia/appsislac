// Lazy-load registry para stores secundários confinados a rotas específicas.
// Garante idempotência via cache de Promise (chamadas concorrentes/repetidas
// reaproveitam o mesmo fetch). Os stores subjacentes já mantêm cache em memória
// — esse helper apenas organiza o disparo on-demand.
//
// Importante:
//  - NÃO altera contratos dos stores (não torna getters async).
//  - NÃO bloqueia render: chamado em useEffect; getters síncronos retornam
//    o snapshot atual (vazio até resolver) e o subscribe re-renderiza ao
//    completar a hidratação.

import { _initOrcamentosStore } from "./orcamentoStore";
import { _initFinanceiroStore } from "./financeiroStore";
import { _initFinanceiroListasStore } from "./financeiroListasStore";
import { _initMapasTrabalhoStore } from "./mapaTrabalhoStore";

export type LazyStoreKey =
  | "orcamentos"
  | "financeiro"
  | "financeiroListas"
  | "mapasTrabalho";

const initializers: Record<LazyStoreKey, () => Promise<void>> = {
  orcamentos: _initOrcamentosStore,
  financeiro: _initFinanceiroStore,
  financeiroListas: _initFinanceiroListasStore,
  mapasTrabalho: _initMapasTrabalhoStore,
};

const inflight: Partial<Record<LazyStoreKey, Promise<void>>> = {};
const loaded: Partial<Record<LazyStoreKey, boolean>> = {};

/**
 * Garante que o store esteja carregado. Idempotente.
 * Nunca lança — falhas são silenciosas (showError já é chamado dentro do init).
 */
export function ensureLazyStore(key: LazyStoreKey): Promise<void> {
  if (loaded[key]) return Promise.resolve();
  const existing = inflight[key];
  if (existing) return existing;
  const p = initializers[key]()
    .then(() => { loaded[key] = true; })
    .catch(() => { /* silenciado: store mantém estado anterior */ })
    .finally(() => { delete inflight[key]; });
  inflight[key] = p;
  return p;
}

/** Reseta o controle de cache de um store lazy (uso em troca de tenant/logout). */
export function resetLazyStore(key?: LazyStoreKey) {
  if (key) {
    delete loaded[key];
    delete inflight[key];
    return;
  }
  for (const k of Object.keys(loaded) as LazyStoreKey[]) delete loaded[k];
  for (const k of Object.keys(inflight) as LazyStoreKey[]) delete inflight[k];
}

/** Preload leve (fire-and-forget) — usado em hover de menu / intent hints. */
export function preloadLazyStore(key: LazyStoreKey): void {
  void ensureLazyStore(key);
}
