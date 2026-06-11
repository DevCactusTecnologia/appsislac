import { useEffect, useState } from "react";
import { Receipt, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import StandardDialog from "@/components/ui/standard-dialog";
import { Button } from "@/components/ui/button";
import { fmtBRL } from "@/lib/utils";
import { fetchItensFatura, type ConvenioFaturaItem } from "@/data/convenioFaturasStore";

interface Props {
  open: boolean;
  onClose: () => void;
  faturaId: number;
  faturaCodigo: string;
  convenioNome: string;
  total: number;
}

const FaturaDetalheDialog = ({ open, onClose, faturaId, faturaCodigo, convenioNome, total }: Props) => {
  const [itens, setItens] = useState<ConvenioFaturaItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void fetchItensFatura(faturaId).then((rows) => {
      setItens(rows);
      setLoading(false);
    });
  }, [open, faturaId]);

  return (
    <StandardDialog
      open={open}
      onClose={onClose}
      icon={<Receipt className="h-5 w-5 text-primary" />}
      title={`Fatura ${faturaCodigo}`}
      subtitle={`${convenioNome} • ${itens.length} ite${itens.length === 1 ? "m" : "ns"} • ${fmtBRL(total)}`}
      maxWidth="3xl"
      footer={<Button variant="outline" className="rounded-2xl" onClick={onClose}>Fechar</Button>}
    >
      <div className="px-6 py-5">
        <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando itens…
            </div>
          ) : itens.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Nenhum item vinculado a esta fatura.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr className="text-left">
                  <th className="px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground">Data</th>
                  <th className="px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground">Protocolo</th>
                  <th className="px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground">Paciente</th>
                  <th className="px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground">Exame</th>
                  <th className="px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {itens.map(i => (
                  <tr key={i.id} className="border-t border-border/30">
                    <td className="px-4 py-2.5 tabular-nums text-xs text-muted-foreground">
                      {i.atendimentoData ? format(new Date(i.atendimentoData), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-xs">{i.atendimentoProtocolo ?? "—"}</td>
                    <td className="px-4 py-2.5 text-xs">{i.pacienteNome ?? "—"}</td>
                    <td className="px-4 py-2.5 text-xs">{i.exameNome ?? "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-right tabular-nums font-semibold">{fmtBRL(i.valor)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border/60 bg-muted/30">
                  <td colSpan={4} className="px-4 py-3 text-xs font-semibold text-right uppercase tracking-wider text-muted-foreground">Total</td>
                  <td className="px-4 py-3 text-sm text-right font-extrabold tabular-nums">{fmtBRL(total)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </StandardDialog>
  );
};

export default FaturaDetalheDialog;
