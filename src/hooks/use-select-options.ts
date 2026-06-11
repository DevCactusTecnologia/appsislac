// Hook para consumir opções configuráveis (`select_options`) com auto-load + subscribe.
// Retorna sempre as opções ATIVAS já mescladas (globais + tenant override).

import { useEffect, useState } from "react";
import {
  ensureSelectOptions,
  getSelectOptionsAtivas,
  isSelectOptionsLoaded,
  subscribeSelectOptions,
  type SelectOption,
} from "@/data/selectOptionsStore";

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