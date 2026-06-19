// Diálogo de estorno formal — Fase 9.
// Substitui o antigo "Excluir" em Saídas e Recebimentos. Pede motivo obrigatório
// e dispara `financeiro_estornar` no servidor (registra em financeiro_estornos).
import { useState } from "react";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import StandardDialog from "@/components/ui/standard-dialog";

interface Props {
  open: boolean;
  protocolo: string;
  tipoLabel: string; // "Despesa" | "Recebimento" | "Fatura"
  onClose: () => void;
  onConfirm: (motivo: string) => Promise<void> | void;
}

export default function EstornarDialog({ open, protocolo, tipoLabel, onClose, onConfirm }: Props) {
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);

  const handleClose = () => {
    if (busy) return;
    setMotivo("");
    onClose();
  };

  const handleConfirm = async () => {
    const m = motivo.trim();
    if (!m) return;
    setBusy(true);
    try {
      await onConfirm(m);
      setMotivo("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <StandardDialog
      open={open}
      onClose={handleClose}
      icon={<Undo2 className="h-5 w-5 text-amber-600" />}
      title={`Estornar ${tipoLabel.toLowerCase()}`}
      subtitle={`Protocolo ${protocolo}`}
      maxWidth="sm"
      footer={
        <>
          <Button variant="outline" className="rounded-2xl" onClick={handleClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={busy || !motivo.trim()}
            className="rounded-2xl bg-amber-600 text-white hover:bg-amber-700"
          >
            {busy ? "Estornando…" : "Estornar"}
          </Button>
        </>
      }
    >
      <div className="px-6 py-5 space-y-3">
        <p className="text-sm text-muted-foreground">
          O estorno mantém o registro original e cria um lançamento formal de reversão.
          Esta operação fica auditada.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="estorno-motivo" className="text-xs font-semibold">
            Motivo do estorno
          </Label>
          <textarea
            id="estorno-motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: lançamento duplicado, valor incorreto, cancelamento solicitado…"
            rows={3}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            autoFocus
          />
        </div>
      </div>
    </StandardDialog>
  );
}
