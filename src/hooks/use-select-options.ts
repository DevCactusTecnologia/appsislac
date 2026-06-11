// @deprecated — use `useDicionario` (src/hooks/useDicionario.ts) em vez deste hook.
//
// Mantido temporariamente apenas como ponte tipada para qualquer importador
// remanescente. Toda nova leitura de `select_options` deve usar `useDicionario`
// (React Query, cache por tenant, sem store global).
//
// O store `selectOptionsStore` continua sendo usado para CRUD admin
// (addSelectOption/updateSelectOptionLabel/toggleSelectOption/...).
import { useEffect, useState } from "react";
import {
  ensureSelectOptions,
  getSelectOptionsAtivas,
  isSelectOptionsLoaded,
  subscribeSelectOptions,
  type SelectOption,
} from "@/data/selectOptionsStore";

/** @deprecated use `useDicionario(categoria, { ativosOnly: true })` */
export function useSelectOptions(categoria: string): {
  options: SelectOption[];
  loading: boolean;
} {
  const [, setTick] = useState(0);
  const [loading, setLoading] = useState(!isSelectOptionsLoaded(categoria));

  useEffect(() => {
    let mounted = true;
    if (!isSelectOptionsLoaded(categoria)) {
      ensureSelectOptions(categoria).finally(() => {
        if (mounted) setLoading(false);
      });
    } else {
      setLoading(false);
    }
    const unsub = subscribeSelectOptions(categoria, () => {
      if (mounted) setTick((n) => n + 1);
    });
    return () => { mounted = false; unsub(); };
  }, [categoria]);

  return { options: getSelectOptionsAtivas(categoria), loading };
}
