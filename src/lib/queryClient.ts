// QueryClient singleton + utilitários de reset por tenant.
//
// Por que centralizar:
// - Usuário pode trocar de conta (e portanto de tenant) na mesma aba.
//   Sem resetar o cache do React Query, dados do tenant anterior podem
//   "vazar" para a tela do novo tenant antes de um refetch.
// - Manter cache agressivo (5min stale / 10min gc) é seguro DESDE QUE
//   limpemos tudo na troca de identidade.
//
// O reset:
// - cancela queries em voo (abort signal),
// - remove TODAS as entradas do cache,
// - força refetch das queries ativas montadas no momento.

import { QueryClient, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { clearTenantContextCache as clearTenantCache } from "@/lib/db/tenantResolver";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
      placeholderData: keepPreviousData,
    },
  },
});

/**
 * Reseta o cache do React Query e do tenant.
 * Chamado em logout / troca de usuário.
 */
async function resetQueryClient(): Promise<void> {
  try {
    await queryClient.cancelQueries();
  } catch {
    /* noop */
  }
  queryClient.clear();
  clearTenantCache();
}

let _installed = false;

/**
 * Instala um listener de auth que limpa o cache sempre que a identidade
 * do usuário muda (logout ou login com outra conta/tenant).
 *
 * Idempotente — pode ser chamado múltiplas vezes.
 */
export function installQueryClientTenantReset(): void {
  if (_installed) return;
  _installed = true;

  let lastUserId: string | null = null;

  supabase.auth.onAuthStateChange((event, session) => {
    const uid = session?.user?.id ?? null;
    const identityChanged = uid !== lastUserId;

    if (event === "SIGNED_OUT" || (identityChanged && lastUserId !== null)) {
      // Logout ou troca de conta: descarta tudo.
      void resetQueryClient();
    }

    lastUserId = uid;
  });
}
