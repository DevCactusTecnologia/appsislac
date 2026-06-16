// Banner exibido quando um Super Admin está acessando um tenant via magic link
// (impersonation). A flag é gravada em sessionStorage (escopo por aba) na chegada
// via `?impersonated=1` e persiste enquanto o usuário navegar dentro do painel.
//
// Segurança:
//  - A "volta" para Super Admin encerra a sessão Supabase (signOut) — o magic link
//    substituiu o token do super admin no localStorage; não há como restaurar.
//  - Não confiamos no banner para autorização: ele é apenas UX/aviso. Toda
//    permissão real é validada server-side via RLS + edge functions.
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ShieldAlert, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const FLAG_KEY = "sislac_impersonation";
const NAME_KEY = "sislac_impersonation_tenant";

interface Stored {
  tenant?: string;
  startedAt: number;
}

function readFlag(): Stored | null {
  try {
    const raw = sessionStorage.getItem(FLAG_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Stored;
  } catch {
    return null;
  }
}

export function markImpersonationFromUrlIfPresent(): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (params.get("impersonated") !== "1") return;
  const tenant = params.get("tname") ?? undefined;
  try {
    sessionStorage.setItem(
      FLAG_KEY,
      JSON.stringify({ tenant, startedAt: Date.now() } satisfies Stored),
    );
    if (tenant) sessionStorage.setItem(NAME_KEY, tenant);
  } catch {
    /* noop */
  }
}

export default function ImpersonationBanner() {
  const [params, setParams] = useSearchParams();
  const [flag, setFlag] = useState<Stored | null>(() => readFlag());
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  // Captura o parâmetro ?impersonated=1 na chegada do magic link, grava no
  // sessionStorage da aba e limpa a URL.
  useEffect(() => {
    if (params.get("impersonated") === "1") {
      const tenant = params.get("tname") ?? undefined;
      try {
        sessionStorage.setItem(
          FLAG_KEY,
          JSON.stringify({ tenant, startedAt: Date.now() } satisfies Stored),
        );
        if (tenant) sessionStorage.setItem(NAME_KEY, tenant);
      } catch { /* noop */ }
      setFlag({ tenant, startedAt: Date.now() });
      const next = new URLSearchParams(params);
      next.delete("impersonated");
      next.delete("tname");
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  if (!flag) return null;

  const handleReturn = async () => {
    if (busy) return;
    setBusy(true);
    try {
      try { await supabase.removeAllChannels(); } catch { /* noop */ }
      await supabase.auth.signOut();
      try {
        sessionStorage.removeItem(FLAG_KEY);
        sessionStorage.removeItem(NAME_KEY);
      } catch { /* noop */ }
      navigate("/super-admin/login", { replace: true });
    } finally {
      setBusy(false);
    }
  };

  const tenantLabel = flag.tenant || sessionStorage.getItem(NAME_KEY) || "este laboratório";

  return (
    <div
      role="alert"
      aria-live="polite"
      className="sticky top-0 z-50 w-full border-b border-amber-500/40 bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-100"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <p className="text-xs sm:text-sm truncate">
            <span className="font-semibold">Acesso como administrador</span>
            <span className="opacity-80"> — você está impersonando </span>
            <span className="font-semibold">{tenantLabel}</span>
            <span className="opacity-80">. Suas ações ficam registradas na auditoria.</span>
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleReturn}
          disabled={busy}
          className="h-8 shrink-0 border-amber-600/40 bg-white/60 text-amber-900 hover:bg-white dark:bg-amber-900/40 dark:text-amber-50 dark:hover:bg-amber-900/60"
        >
          <LogOut className="h-3.5 w-3.5 mr-1.5" />
          {busy ? "Saindo..." : "Voltar ao Super Admin"}
        </Button>
      </div>
    </div>
  );
}
