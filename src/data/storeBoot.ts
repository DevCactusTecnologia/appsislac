// Boot único dos stores baseados em Supabase (cache síncrono).
// Chamado uma vez no startup do App, antes do render principal.

import { _initUnidadesStore } from "./unidadeStore";
import { _initConveniosStore } from "./convenioStore";
import { _initLabsApoioStore } from "./labApoioStore";
import { _initExamesCatalogoStore } from "./exameCatalogoStore";
import { _initTabelaPrecoStore } from "./tabelaPrecoStore";
import { _initValoresReferenciaStore } from "./valoresReferenciaStore";
import { _initPacientesStore } from "./pacienteStore";
import { _initEspecialistasStore } from "./especialistaStore";
import { _initAtendimentosStore, installAtendimentosRealtime, stopAtendimentosRealtime } from "./atendimentoStore";
import { _initUsuariosStore } from "./usuariosStore";
import { _initMotivosCancelamentoStore } from "./motivosCancelamentoStore";
import { _initDocumentoTemplatesStore } from "./documentoTemplatesStore";
import { _initRecoletasMotivosStore } from "./recoletasMotivosStore";
import { _initRecoletasStore } from "./recoletasStore";
import { preloadEditWindow } from "@/lib/atendimentoPolicy";
import { getCurrentTenantNome, getCurrentTenantId, installTenantAuthInvalidation } from "@/lib/db/tenantResolver";
import { showError } from "@/lib/showError";
import { resetLazyStore } from "./lazyStores";
import { supabase } from "@/integrations/supabase/client";
import { loadLabConfigFromDb } from "./labConfigStore";

let bootPromise: Promise<void> | null = null;

// Reset do registry lazy em logout / troca de usuário — garante que o próximo
// acesso à rota dispare uma nova hidratação para o novo tenant.
let _lazyResetInstalled = false;
function installLazyStoreReset(): void {
  if (_lazyResetInstalled) return;
  _lazyResetInstalled = true;
  let lastUserId: string | null = null;
  supabase.auth.onAuthStateChange((event, session) => {
    // Hardening: ignora explicitamente eventos que não exigem reciclagem
    // de canais/cache (TOKEN_REFRESHED, USER_UPDATED). Evita churn de
    // WebSocket Realtime a cada refresh de JWT.
    if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") return;
    const uid = session?.user?.id ?? null;
    if (event === "SIGNED_OUT" || uid !== lastUserId) {
      resetLazyStore();
      // Para o canal realtime do tenant anterior — evita receber payloads
      // após troca de identidade. Será reinstalado pelo próximo bootDataStores.
      try { stopAtendimentosRealtime(); } catch { /* noop */ }
    }
    lastUserId = uid;
  });
}

export function bootDataStores(): Promise<void> {
  if (bootPromise) return bootPromise;
  // Garante invalidação do cache de tenant no logout/troca de usuário
  installTenantAuthInvalidation();
  installLazyStoreReset();

  // Boot em duas ondas para acelerar o tempo até interativo:
  //  - ESSENCIAL: o que toda tela depende para renderizar layout/sidebar
  //    (unidades, convênios, exames, pacientes, atendimentos).
  //  - SECUNDÁRIO: stores que só são usados em telas específicas
  //    (mapas, recoletas, documentos, financeiro listas etc.) — carregam
  //    em background sem bloquear a primeira pintura.
  // ─── BLOCO 1 (FASE FINAL) — Kill-switch do boot global de atendimentos ───
  // Quando `paginated_atendimentos` está ON e `USE_LEGACY_STORE` está OFF,
  // o cache global NÃO é hidratado no boot. Telas migradas usam RPC paginada
  // + `reloadAtendimentoById` para dialogs. Realtime continua ativo e atua
  // como buffer leve (Bloco 2 da missão).
  //
  // Precedência: USE_LEGACY_STORE=1 sempre vence — restaura o comportamento
  // antigo (boot completo) para rollback instantâneo, sem deploy.
  // Leitura via localStorage para manter compatibilidade com `loadTenantFeatureFlags`
  // (que roda assíncrono após o boot). Fail-safe: qualquer erro → boot ligado.
  let SHOULD_BOOT_ATENDIMENTOS = true;
  try {
    if (typeof window !== "undefined") {
      const legacy = window.localStorage.getItem("ff:USE_LEGACY_STORE");
      const paginated = window.localStorage.getItem("ff:paginated_atendimentos");
      const legacyOn = legacy === "1" || legacy === "true";
      const paginatedOn = paginated === "1" || paginated === "true";
      if (paginatedOn && !legacyOn) SHOULD_BOOT_ATENDIMENTOS = false;
    }
  } catch { /* fail-safe: mantém boot ligado */ }

  const essencial = Promise.all([
    _initUnidadesStore(),
    _initConveniosStore(),
    _initLabsApoioStore(),
    _initExamesCatalogoStore(),
    _initPacientesStore(),
    SHOULD_BOOT_ATENDIMENTOS ? _initAtendimentosStore() : Promise.resolve(),
    _initUsuariosStore(),
  ]);

  if (!SHOULD_BOOT_ATENDIMENTOS) {
    // eslint-disable-next-line no-console
    console.info("[storeBoot] atendimentos: boot global DESLIGADO (paginated_atendimentos ON)");
  }

  const secundario = () => Promise.all([
    _initTabelaPrecoStore(),
    _initValoresReferenciaStore(),
    _initEspecialistasStore(),
    _initMotivosCancelamentoStore(),
    _initDocumentoTemplatesStore(),
    _initRecoletasMotivosStore(),
    _initRecoletasStore(),
  ]).catch((err) => {
    showError(err, { scope: "storeBoot.carregarSecundarios", silent: true });
  });

  bootPromise = essencial.then(() => {
    // Secundários só rodam em idle — não competem com o primeiro paint
    // nem com a navegação inicial pós-login.
    const runSecundario = () => { void secundario(); };
    const w = typeof window !== "undefined" ? (window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    }) : undefined;
    if (w?.requestIdleCallback) w.requestIdleCallback(runSecundario, { timeout: 4000 });
    else setTimeout(runSecundario, 1200);
    // Hidrata cache local de Dados do Laboratório a partir do banco
    void loadLabConfigFromDb();
    // Pré-carrega configuração de janela de edição (não-bloqueante)
    preloadEditWindow();
    // Pré-carrega nome do tenant (laboratório próprio) para uso em badges/etiquetas
    void getCurrentTenantNome();
    // Ativa realtime de atendimentos com filtro server-side por tenant.
    // Adia até resolver o tenantId — evita abrir canal sem filtro (escalabilidade).
    void getCurrentTenantId()
      .then((tid) => { try { installAtendimentosRealtime(tid); } catch { /* noop */ } })
      .catch(() => { /* fail-safe: sem realtime, mas app funciona */ });
    // eslint-disable-next-line no-console
    console.info("[storeBoot] Cadastros essenciais carregados; secundários em background");
  }).catch((err) => {
    showError(err, { scope: "storeBoot.carregarCadastros", silent: true });
    // Mesmo com falha, resolvemos para não travar a UI — stores ficam vazios.
  });
  return bootPromise;
}
