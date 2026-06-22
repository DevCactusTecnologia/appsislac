// Fase UX — aviso único por dia/usuário/unidade quando o recepcionista
// inicia um Novo Atendimento com o caixa fechado.
//
// Regras (estritas):
//  • Não bloqueia o fluxo.
//  • Aparece 1x por dia por usuário por unidade (localStorage).
//  • Reutiliza o fluxo de abertura já existente (AbrirCaixaDialog).
//  • Não cria rotas, tabelas, eventos financeiros nem altera RLS.
import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Unlock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getUnidades } from "@/data/unidadeStore";
import { getCaixaAbertaPorUnidade } from "@/data/caixaSessoesStore";
import { AbrirCaixaDialog } from "@/components/caixa/CaixaOperacionalCard";

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function CaixaAlertaNovoAtendimento() {
  const { user, hasPermission } = useAuth();
  const podeOperar = hasPermission?.("gestao_financeira") ?? false;

  const unidades = getUnidades();
  const unidadeAtivaUser = user?.unidadeAtiva ?? "";
  const unidadeResolvida =
    unidades.find((u) => u.id === unidadeAtivaUser) ??
    unidades.find((u) => u.padrao) ??
    unidades[0] ??
    null;
  const unidadeId = unidadeResolvida?.id ?? "";
  const unidadeNome = unidadeResolvida?.nome ?? "Unidade";

  const [openAviso, setOpenAviso] = useState(false);
  const [openAbrir, setOpenAbrir] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!podeOperar || !unidadeId || !user?.id) return;
      const key = `caixa_alerta_${todayKey()}_${unidadeId}_${user.id}`;
      try {
        if (typeof window !== "undefined" && window.localStorage.getItem(key)) return;
      } catch { /* storage indisponível → segue silencioso */ }
      try {
        const sessao = await getCaixaAbertaPorUnidade(unidadeId);
        if (cancel) return;
        if (!sessao) {
          try { window.localStorage.setItem(key, "1"); } catch { /* noop */ }
          setOpenAviso(true);
        }
      } catch { /* erro já tratado em store */ }
    })();
    return () => { cancel = true; };
  }, [podeOperar, unidadeId, user?.id]);

  if (!podeOperar || !unidadeId) return null;

  return (
    <>
      <Dialog open={openAviso} onOpenChange={(o) => !o && setOpenAviso(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Caixa fechado</DialogTitle>
            <DialogDescription className="space-y-2 pt-1">
              <span className="block">A unidade <strong>{unidadeNome}</strong> não possui caixa aberto.</span>
              <span className="block">
                Pagamentos em <strong>Dinheiro</strong> e <strong>PIX</strong> realizados sem caixa aberto
                não serão incluídos no fechamento do caixa.
              </span>
              <span className="block">Deseja abrir o caixa agora?</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpenAviso(false)}>
              Continuar sem Caixa
            </Button>
            <Button className="gap-2" onClick={() => { setOpenAviso(false); setOpenAbrir(true); }}>
              <Unlock className="h-4 w-4" /> Abrir Caixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AbrirCaixaDialog
        open={openAbrir}
        onClose={() => setOpenAbrir(false)}
        unidadeId={unidadeId}
        unidadeNome={unidadeNome}
        onAberto={() => setOpenAbrir(false)}
      />
    </>
  );
}
