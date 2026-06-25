import { useState, useEffect, useMemo } from "react";
import { Filter, Ruler, Info, Settings2 } from "lucide-react";
import StandardDialog from "@/components/ui/standard-dialog";
import { getValoresReferencia, type ValorReferencia } from "@/data/valoresReferenciaStore";
import { loadParametros, getParametros, ExameParametro } from "@/data/exameParametrosStore";
import ValoresReferenciaPanel from "./ValoresReferenciaPanel";
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
 * Valores de Referência — interface "Padrão + Variações".
 *
 * Redesign (REDESIGN_VALORES_REFERENCIA.md): cada parâmetro mostra 1 card
 * "Padrão" + cards de variação por categoria (Gestante, Criança, Idoso…).
 * O resolver escolhe a categoria de maior prioridade compatível com o paciente.
 *
 * O modo "Avançado" (Matriz por sexo × régua etária) fica colapsável para
 * casos exóticos (Sysmex/Lareval) sem poluir o caminho principal.
 */
const FiltrosDialog = ({
  open, onClose, exameNome = "", exameId, defaultMaximized = true, embedded = false,
}: FiltrosDialogProps) => {
  const [referencias, setReferencias] = useState<ValorReferencia[]>([]);
  const [parametros, setParametros] = useState<ExameParametro[]>([]);
  const [reguasOpen, setReguasOpen] = useState(false);
  const [avancado, setAvancado] = useState(false);

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
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => setAvancado((v) => !v)}
        className={`h-9 px-3 rounded-xl border text-[12px] font-medium flex items-center gap-1.5 transition-all ${
          avancado
            ? "border-primary/50 bg-primary/10 text-primary"
            : "border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground hover:border-border"
        }`}
      >
        <Settings2 className="h-3.5 w-3.5" /> {avancado ? "Modo simples" : "Avançado"}
      </button>
      {avancado && (
        <button
          onClick={() => setReguasOpen(true)}
          className="h-9 px-3 rounded-xl border border-border/60 bg-muted/30 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:border-border flex items-center gap-1.5"
        >
          <Ruler className="h-3.5 w-3.5" /> Réguas
        </button>
      )}
    </div>
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
      {!avancado ? (
        <>
          <div className="rounded-2xl border border-[hsl(var(--status-info))]/30 bg-[hsl(var(--status-info))]/5 p-3 flex gap-2.5 items-start">
            <Info className="h-4 w-4 text-[hsl(var(--status-info))] shrink-0 mt-0.5" />
            <div className="text-[12px] text-foreground/85 leading-relaxed">
              Cada parâmetro tem um <strong>Padrão</strong> (vale para todos) e variações opcionais por categoria
              (Gestante, Criança, Idoso…). Na hora de validar o resultado, o sistema escolhe a categoria
              compatível com o paciente <em>de maior prioridade</em>.
              {embedded && <div className="mt-2 flex justify-end">{headerActions}</div>}
            </div>
          </div>
          <ValoresReferenciaPanel
            exameNome={exameNome}
            parametros={parametros}
            referencias={referencias}
            onMutate={refreshReferencias}
          />
        </>
      ) : (
        <>
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3 flex gap-2.5 items-start">
            <Settings2 className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[12px] text-foreground/85 leading-relaxed">
              <strong>Modo Avançado</strong>: matriz por sexo × régua etária livre. Use só para protocolos
              específicos (Sysmex, Lareval) que exigem faixas etárias customizadas.
              {embedded && <div className="mt-2 flex justify-end">{headerActions}</div>}
            </div>
          </div>
          <MatrizValoresReferencia
            exameNome={exameNome}
            parametros={nomesParametros}
            referencias={referencias}
            onAbrirGerenciador={() => setReguasOpen(true)}
            onMutate={refreshReferencias}
          />
        </>
      )}
    </div>
  );

  if (embedded) {
    if (!open) return null;
    return (
      <>
        <div className="flex flex-col h-full bg-card">
          <div className="flex-1 min-h-0 overflow-auto">{body}</div>
        </div>
        <GerenciarReguasDialog open={reguasOpen} onClose={() => setReguasOpen(false)} exameNome={exameNome} />
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
      <GerenciarReguasDialog open={reguasOpen} onClose={() => setReguasOpen(false)} exameNome={exameNome} />
    </>
  );
};

export default FiltrosDialog;
