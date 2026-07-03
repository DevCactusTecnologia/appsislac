import { useEffect, useState } from "react";
import { getAtendimentos, subscribe as subscribeAtendimentos } from "@/data/atendimentoStore";

/**
 * Sincroniza `jejum` e `prioridadeClinica` do atendimento em tempo real
 * com o store. Quando o atendimento é editado em outra aba/dispositivo,
 * o realtime do atendimentoStore atualiza o cache e refletimos aqui.
 *
 * Retorna o estado atual + setters, para que o componente-pai continue
 * podendo aplicar overrides otimistas (ex.: ao alternar jejum inline).
 */
export function useJejumPrioridadeRealtime(
  protocolo: string | undefined,
  initialJejum = false,
  initialPrioridade: "normal" | "urgencia" | "emergencia" = "normal",
) {
  const [jejum, setJejum] = useState<boolean>(initialJejum);
  const [prioridade, setPrioridade] = useState<"normal" | "urgencia" | "emergencia">(
    initialPrioridade,
  );

  useEffect(() => {
    if (!protocolo) return;
    const unsub = subscribeAtendimentos(() => {
      const at = getAtendimentos().find((a) => a.protocolo === protocolo);
      if (!at) return;
      setJejum(!!at.jejum);
      setPrioridade((at.prioridadeClinica ?? "normal") as "normal" | "urgencia" | "emergencia");
    });
    return unsub;
  }, [protocolo]);

  return { jejum, setJejum, prioridade, setPrioridade } as const;
}
