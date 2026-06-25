import { useState, useEffect, useMemo } from "react";
import { Filter, Ruler, Info } from "lucide-react";
import StandardDialog from "@/components/ui/standard-dialog";
import { getValoresReferencia, type ValorReferencia } from "@/data/valoresReferenciaStore";
import { loadParametros, getParametros, ExameParametro } from "@/data/exameParametrosStore";
import MatrizValoresReferencia from "./MatrizValoresReferencia";
import GerenciarReguasDialog from "./GerenciarReguasDialog";

interface FiltrosDialogProps {
  open: boolean;
  onClose: () => void;
  exameNome?: string;
  exameId?: string;
  defaultMaximized?: boolean;
  embedded?: boolean;
}

/**
 * Valores de Referência — interface única (Matriz).
 *
 * Decisão (Fase 2 — OECV): as 3 abas anteriores (Por filtro / Matriz / Lista)
 * mostravam o mesmo dado em formatos diferentes e confundiam o usuário novo.
 * A matriz é a única visão canônica: cobre o modelo mental real (1 parâmetro
 * por vez, cruzando sexo × faixa etária) e é a única que mostra a cobertura
 * (gaps por sexo), prevenindo o erro silencioso de faltar faixa.
 *
 * "Nova faixa" deixou de ser ação global: cada célula vazia da matriz JÁ é
 * o ponto de criação (basta digitar min/max e sair do campo).
 */
const FiltrosDialog = ({
  open, onClose, exameNome = "", exameId, defaultMaximized = true, embedded = false,
}: FiltrosDialogProps) => {
  const [referencias, setReferencias] = useState<ValorReferencia[]>([]);
  const [parametros, setParametros] = useState<ExameParametro[]>([]);
  const [reguasOpen, setReguasOpen] = useState(false);

  const refreshReferencias = () => {
    const all = getValoresReferencia();
    setReferencias(
      exameNome ? all.filter((v) => v.exameNome.toLowerCase() === exameNome.toLowerCase()) : all,
    );
  };

  useEffect(() => {
    if (!open) return;
    refreshReferencias();
    if (exameId) loadParametros(exameId).then(() => setParametros(getParametros(exameId)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, exameNome, exameId]);

  const nomesParametros = useMemo(() => parametros.map((p) => p.rotulo), [parametros]);

  const headerActions = (
    <button
      onClick={() => setReguasOpen(true)}
      className="h-9 px-3 rounded-xl border border-border/60 bg-muted/30 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:border-border transition-all duration-200 flex items-center gap-1.5"
    >
      <Ruler className="h-3.5 w-3.5" /> Réguas
    </button>
  );

  const footer = (
    <button
      onClick={onClose}
      className="h-10 px-4 rounded-xl border border-border/60 text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all duration-200"
    >
      Fechar
    </button>
  );

  const body = (
    <div className="px-6 py-5 space-y-4">
      {/* Onboarding leve — explica em 1 frase o que esta tela faz. */}
      <div className="rounded-2xl border border-[hsl(var(--status-info))]/30 bg-[hsl(var(--status-info))]/5 p-3 flex gap-2.5 items-start">
        <Info className="h-4 w-4 text-[hsl(var(--status-info))] shrink-0 mt-0.5" />
        <div className="text-[12px] text-foreground/85 leading-relaxed">
          Configure os limites de cada parâmetro por <strong>sexo</strong> e <strong>idade</strong>.
          A barra de cobertura mostra em <span className="text-[hsl(var(--status-success))] font-medium">verde</span> as faixas
          atendidas e em <span className="text-[hsl(var(--status-danger))] font-medium">vermelho</span> os intervalos sem regra.
          Digite os valores nas células e clique fora — o salvamento é automático.
          {embedded && (
            <div className="mt-2 flex justify-end">{headerActions}</div>
          )}
        </div>
      </div>

      <MatrizValoresReferencia
        exameNome={exameNome}
        parametros={nomesParametros}
        referencias={referencias}
        onAbrirGerenciador={() => setReguasOpen(true)}
        onMutate={refreshReferencias}
      />
    </div>
  );

  if (embedded) {
    if (!open) return null;
    return (
      <>
        <div className="flex flex-col h-full bg-card">
          <div className="flex-1 min-h-0 overflow-auto">{body}</div>
        </div>
        <GerenciarReguasDialog open={reguasOpen} onClose={() => setReguasOpen(false)} />
      </>
    );
  }

  return (
    <>
      <StandardDialog
        open={open}
        onClose={onClose}
        icon={<Filter className="h-5 w-5 text-[hsl(var(--status-info))]" />}
        title="Valores de referência"
        subtitle={exameNome || "Todos os exames"}
        headerActions={headerActions}
        footer={footer}
        maxWidth="7xl"
        allowMaximize={true}
        defaultMaximized={defaultMaximized}
      >
        {body}
      </StandardDialog>
      <GerenciarReguasDialog open={reguasOpen} onClose={() => setReguasOpen(false)} />
    </>
  );
};

export default FiltrosDialog;
