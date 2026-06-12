// Diálogo de confirmação de exclusão de saída financeira.
// Extraído de Financeiro.tsx (Fase 4). JSX preservado literalmente.
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import StandardDialog from "@/components/ui/standard-dialog";

interface Props {
  open: boolean;
  protocolo: string;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeleteEntryDialog({ open, protocolo, onClose, onConfirm }: Props) {
  return (
    <StandardDialog
      open={open}
      onClose={onClose}
      icon={<AlertTriangle className="h-5 w-5 text-destructive" />}
      title="Excluir registro"
      subtitle={`Protocolo ${protocolo}`}
      maxWidth="sm"
      footer={
        <>
          <Button variant="outline" className="rounded-2xl" onClick={onClose}>Cancelar</Button>
          <Button onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-2xl">Excluir</Button>
        </>
      }
    >
      <div className="px-6 py-5 text-sm text-muted-foreground">
        Tem certeza que deseja excluir <span className="font-semibold text-foreground">{protocolo}</span>? Esta ação não pode ser desfeita.
      </div>
    </StandardDialog>
  );
}
