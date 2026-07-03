import { useEffect, useState } from "react";
import { db as supabase } from "@/runtime/db";

export type AssinaturaLaudo = {
  tipo: "carimbo" | "imagem";
  conselho: string | null;
  url: string | null;
};

/**
 * Carrega a configuração de assinatura do usuário logado.
 * Se `assinatura_tipo === "imagem"`, resolve a URL assinada via edge
 * `assinatura-url`. Mantém o formato original consumido por
 * `ResultadoDetalhe.tsx` — comportamento idêntico ao inline anterior.
 */
export function useAssinaturaLaudo(userId: string | undefined | null): AssinaturaLaudo {
  const [assinatura, setAssinatura] = useState<AssinaturaLaudo>({
    tipo: "carimbo",
    conselho: null,
    url: null,
  });

  useEffect(() => {
    if (!userId || typeof userId !== "string") return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("assinatura_tipo,assinatura_imagem_key,assinatura_conselho")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled || !data) return;
      const p = data as {
        assinatura_tipo?: string;
        assinatura_imagem_key?: string | null;
        assinatura_conselho?: string | null;
      };
      const tipo: "carimbo" | "imagem" = p.assinatura_tipo === "imagem" ? "imagem" : "carimbo";
      let url: string | null = null;
      if (tipo === "imagem" && p.assinatura_imagem_key) {
        const r = await supabase.functions.invoke("assinatura-url", { body: { userId } });
        url = (r.data as { url?: string | null } | null)?.url ?? null;
      }
      if (!cancelled) setAssinatura({ tipo, conselho: p.assinatura_conselho ?? null, url });
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return assinatura;
}
