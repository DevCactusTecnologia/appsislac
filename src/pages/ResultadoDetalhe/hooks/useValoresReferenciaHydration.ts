import { useEffect, useState } from "react";
import {
  getValoresReferencia,
  subscribeValoresReferencia,
  _initValoresReferenciaStore,
} from "@/data/valoresReferenciaStore";

/**
 * Garante que o store de valores de referência esteja hidratado e força
 * um re-render (via `vrTick`) sempre que o store notifica atualização.
 *
 * Sem isso o primeiro render acontece com VR vazio e nunca recalcula a
 * resolução por sexo/idade — mesmo após o store popular assíncrono.
 */
export function useValoresReferenciaHydration(): number {
  const [vrTick, setVrTick] = useState(0);
  useEffect(() => {
    if (getValoresReferencia().length === 0) {
      void _initValoresReferenciaStore();
    } else {
      setVrTick((t) => t + 1);
    }
    return subscribeValoresReferencia(() => setVrTick((t) => t + 1));
  }, []);
  return vrTick;
}
