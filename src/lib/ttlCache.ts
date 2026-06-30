// Helper genérico de cache TTL com deduplicação de in-flight promises.
// Útil para wrappers de funções assíncronas (RPCs, lookups frequentes).

export interface TtlCacheOptions {
  /** Tempo de vida em ms (default 60s). */
  ttlMs?: number;
}

interface Entry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Cria uma versão memoizada de `fn` com TTL e deduplicação de chamadas
 * concorrentes para a mesma `key`. Erros NÃO são cacheados.
 */
export function withTtlCache<Args extends unknown[], T>(
  fn: (...args: Args) => Promise<T>,
  keyFn: (...args: Args) => string,
  { ttlMs = 60_000 }: TtlCacheOptions = {},
): ((...args: Args) => Promise<T>) & { invalidate: (key?: string) => void } {
  const cache = new Map<string, Entry<T>>();
  const inflight = new Map<string, Promise<T>>();

  const wrapped = (async (...args: Args) => {
    const key = keyFn(...args);
    const now = Date.now();
    const hit = cache.get(key);
    if (hit && hit.expiresAt > now) return hit.value;

    const pending = inflight.get(key);
    if (pending) return pending;

    const p = fn(...args)
      .then((value) => {
        cache.set(key, { value, expiresAt: Date.now() + ttlMs });
        return value;
      })
      .finally(() => { inflight.delete(key); });
    inflight.set(key, p);
    return p;
  }) as ((...args: Args) => Promise<T>) & { invalidate: (key?: string) => void };

  wrapped.invalidate = (key?: string) => {
    if (key === undefined) { cache.clear(); inflight.clear(); return; }
    cache.delete(key);
    inflight.delete(key);
  };
  return wrapped;
}
