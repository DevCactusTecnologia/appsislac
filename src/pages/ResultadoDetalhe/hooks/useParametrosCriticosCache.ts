import { useEffect, useState } from "react";
import { getExamesCatalogo } from "@/data/exameCatalogoStore";
import { getParametros, loadParametros, type ExameParametro } from "@/data/exameParametrosStore";

/**
 * Carrega os parâmetros configurados (com `critico_min`/`critico_max`)
 * de cada exame presente na lista. Alimenta o motor de detecção crítica.
 *
 * Mapa indexado por NOME do exame (mesma chave usada pelo pipeline crítico
 * em `services/criticoPipeline.ts`).
 */
export function useParametrosCriticosCache(nomesExame: string[]): Record<string, ExameParametro[]> {
  const [map, setMap] = useState<Record<string, ExameParametro[]>>({});

  useEffect(() => {
    if (nomesExame.length === 0) return;
    const catalogo = getExamesCatalogo();
    const nomes = Array.from(new Set(nomesExame));
    let cancel = false;
    (async () => {
      const next: Record<string, ExameParametro[]> = {};
      for (const nome of nomes) {
        const cat = catalogo.find((c) => c.nome === nome);
        if (!cat) continue;
        const cached = getParametros(cat.id);
        const params = cached.length > 0 ? cached : await loadParametros(cat.id);
        next[nome] = params;
      }
      if (!cancel) setMap(next);
    })();
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nomesExame.join("|")]);

  return map;
}
