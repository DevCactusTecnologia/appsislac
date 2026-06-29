// Hook reativo para a flag "rotina de coleta + análise".
// Lê do cache local de `labConfigStore` e reassiste mudanças.
//
// Quando `enabled === false`, o sistema:
//   • esconde "Registrar coleta" e "Analisar amostras" do menu Rotina;
//   • bloqueia rotas /registrar-coleta e /analisar-amostra (redirect → /resultados);
//   • novos exames já entram com status "analisado" via trigger no banco
//     (data_coleta = data_analise = now(); coletor/analista = '__SEM_REGISTRO__');
//   • auditoria registra "Não houve registro de coleta/análise".

import { useEffect, useState } from "react";
import { getLabConfig, subscribeLabConfig } from "@/data/labConfigStore";

export const SEM_REGISTRO_MARKER = "__SEM_REGISTRO__";

export function isRotinaColetaAnaliseEnabled(): boolean {
  const cfg = getLabConfig();
  // Default seguro: true (mantém fluxo original quando ainda não há config).
  return cfg.rotinaColetaAnaliseEnabled !== false;
}

export function useRotinaColetaAnaliseEnabled(): boolean {
  const [enabled, setEnabled] = useState<boolean>(isRotinaColetaAnaliseEnabled());
  useEffect(() => {
    const unsub = subscribeLabConfig(() => setEnabled(isRotinaColetaAnaliseEnabled()));
    return unsub;
  }, []);
  return enabled;
}
