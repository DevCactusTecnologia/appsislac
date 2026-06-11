import { useState } from "react";

export interface NovaEntradaSaidaData {
  protocolo: string;
  data: string;
  cliente: string;
  valorTotal: number;
  pagamento: string;
  tipo: "entrada" | "saida";
  tipoDespesa?: string;
  destinoPagamento?: string;
  descricao?: string;
  dataVencimento?: string;
  foiPago?: string;
  dataPagamento?: string;
}
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onClose: () => void;
  tipo: "entrada" | "saida";
  onConfirm: (data: any) => void;
  [key: string]: any; // Permite receber props legadas sem quebrar o TS
}

export default function NovaEntradaSaidaDialog({ open, onClose, tipo, onConfirm, ...props }: Props) {
  const [formData, setFormData] = useState<any>({
    tipo,
    data: new Date().toLocaleDateString('pt-BR'),
    valorTotal: 0,
    descricao: "",
    ...props.initialEntrada, // Suporte para initialEntrada se enviado
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{tipo === "entrada" ? "Nova Entrada" : "Nova Saída"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input 
              value={formData.descricao}
              onChange={e => setFormData({...formData, descricao: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <Label>Valor</Label>
            <Input 
              type="number"
              value={formData.valorTotal}
              onChange={e => setFormData({...formData, valorTotal: Number(e.target.value)})}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => { onConfirm(formData); onClose(); }}>Confirmar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
