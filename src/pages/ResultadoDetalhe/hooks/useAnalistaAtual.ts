import { useEffect, useRef, useState } from "react";

export type AnalistaAtual = { nome: string; iniciais: string };

export function computeIniciais(nome: string): string {
  const parts = (nome || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Mantém o analista atual sincronizado com o usuário logado enquanto o
 * operador não confirmar credenciais de outro analista pelo diálogo
 * "Alterar Analista". Uma vez trocado, permanece congelado até o próximo
 * mount.
 */
export function useAnalistaAtual(nomeUsuarioLogado: string | number | null | undefined) {
  const nomeStr = nomeUsuarioLogado != null ? String(nomeUsuarioLogado) : "";
  const [analistaAtual, setAnalistaAtual] = useState<AnalistaAtual>(() => {
    const nome = nomeUsuarioLogado || "Analista";
    return { nome, iniciais: computeIniciais(nome) };
  });
  const analistaTrocadoRef = useRef(false);

  useEffect(() => {
    if (analistaTrocadoRef.current) return;
    if (!nomeUsuarioLogado) return;
    setAnalistaAtual({ nome: nomeUsuarioLogado, iniciais: computeIniciais(nomeUsuarioLogado) });
  }, [nomeUsuarioLogado]);

  return { analistaAtual, setAnalistaAtual, analistaTrocadoRef } as const;
}
