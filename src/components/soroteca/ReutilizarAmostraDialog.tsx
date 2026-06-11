import { FlaskConical, Clock, MapPin } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import type { Amostra } from "@/data/sorotecaStore";

interface Props {
  open: boolean;
  amostras: Amostra[];
  exameNome: string;
  onReutilizar: (amostraId: string) => void;
  onNovaColeta: () => void;
  onCancel: () => void;
}

function formatRestante(validade: string): string {
  const ms = new Date(validade).getTime() - Date.now();
  if (ms <= 0) return "vencida";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h <= 0) return `${m} min restantes`;
  return `${h}h ${m}min restantes`;
}

function formatColeta(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ReutilizarAmostraDialog({
  open,
  amostras,
  exameNome,
  onReutilizar,
  onNovaColeta,
  onCancel,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <AlertDialogContent className="max-w-md p-0 overflow-hidden">
        <div className="px-6 pt-6 pb-4">
          <AlertDialogHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FlaskConical className="h-5 w-5 text-primary" />
              </div>
              <AlertDialogTitle className="text-base">Amostra disponível na soroteca</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-sm text-muted-foreground break-words">
              Já existe uma amostra disponível para <span className="font-medium text-foreground">{exameNome}</span>.
              Você pode reutilizá-la e evitar uma nova coleta.
            </AlertDialogDescription>
          </AlertDialogHeader>
        </div>

        <div className="px-6 pb-4 space-y-2">
          {amostras.slice(0, 3).map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onReutilizar(a.id)}
              className="w-full text-left rounded-lg border border-border bg-card hover:bg-primary/5 hover:border-primary/40 transition-colors px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground truncate">{a.codigo_barra}</span>
                <span className="text-[11px] text-[hsl(var(--status-success))] font-medium shrink-0">Reutilizar</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Coletada {formatColeta(a.data_coleta)} · {formatRestante(a.data_validade)}
                </span>
                {a.localizacao && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {a.localizacao}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="px-6 py-4 bg-muted/30 border-t border-border flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onNovaColeta}
            className="text-sm font-medium px-3 py-1.5 rounded-md border border-border bg-background hover:bg-muted transition-colors"
          >
            Nova coleta
          </button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
