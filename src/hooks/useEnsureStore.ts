import { useEffect } from "react";
import { ensureLazyStore, type LazyStoreKey } from "@/data/lazyStores";

/**
 * Hook que dispara a hidratação on-demand de um ou mais stores lazy
 * no mount da rota. Idempotente — chamadas repetidas não refazem fetch.
 * Não bloqueia render: getters síncronos retornam snapshot atual e o
 * subscribe re-renderiza quando os dados chegam.
 */
export function useEnsureStore(keys: LazyStoreKey | LazyStoreKey[]): void {
  useEffect(() => {
    const list = Array.isArray(keys) ? keys : [keys];
    for (const k of list) void ensureLazyStore(k);
    // Intencional: dependências controladas pelo array passado (estável por uso).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Array.isArray(keys) ? keys.join("|") : keys]);
}
