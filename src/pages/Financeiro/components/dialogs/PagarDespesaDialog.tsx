// Diálogo "Confirmar pagamento" de despesa (Pagar agora).
// Extraído de Financeiro.tsx (Fase 4). JSX preservado literalmente.
import { CheckCircle, Wallet, Receipt } from "lucide-react";
import { cn, fmtBRL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import StandardDialog from "@/components/ui/standard-dialog";
import SearchableSelect from "@/components/financeiro/SearchableSelect";
import { maskDateBR, isValidDateBR } from "../../helpers";
import type { FinanceiroEntry } from "../../types";
import type { DictionaryHandlers } from "./types";

interface Props {
  open: boolean;
  payTarget: FinanceiroEntry | null;
  payForma: string;
  setPayForma: (v: string) => void;
  payData: string;
  setPayData: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  dict: DictionaryHandlers;
}

export default function PagarDespesaDialog({
  open, payTarget, payForma, setPayForma, payData, setPayData,
  onClose, onConfirm, dict,
}: Props) {
  const { formasPagamento, deletableFormas, openCriar, handleDeleteItem } = dict;

  return (
    <StandardDialog
      open={open}
      onClose={onClose}
      icon={<CheckCircle className="h-5 w-5 text-status-success" />}
      title="Confirmar pagamento"
      subtitle={payTarget ? `Protocolo ${payTarget.protocolo}` : undefined}
      maxWidth="lg"
      footer={
        <>
          <Button variant="outline" className="rounded-2xl" onClick={onClose}>Cancelar</Button>
          <Button className="rounded-2xl gap-2 bg-status-success text-white hover:bg-status-success/90" onClick={onConfirm}>
            <CheckCircle className="h-4 w-4" />Confirmar pagamento
          </Button>
        </>
      }
    >
      {payTarget && (
        <div className="px-6 py-5 space-y-4">
          <div className="rounded-2xl border border-border/50 bg-muted/15 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Despesa</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Descrição</span>
                <span className="font-semibold text-foreground truncate ml-3">{payTarget.descricao || payTarget.cliente}</span>
              </div>
              {payTarget.tipoDespesa && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tipo</span>
                  <span className="text-foreground">{payTarget.tipoDespesa}</span>
                </div>
              )}
              {payTarget.destinoPagamento && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Destino</span>
                  <span className="text-foreground">{payTarget.destinoPagamento}</span>
                </div>
              )}
              {payTarget.dataVencimento && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Vencimento</span>
                  <span className="text-foreground">{payTarget.dataVencimento}</span>
                </div>
              )}
              <div className="flex justify-between text-sm pt-1 border-t border-border/50">
                <span className="text-muted-foreground">Valor</span>
                <span className="font-bold text-foreground tabular-nums">{fmtBRL(payTarget.valorTotal)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/50 bg-muted/15 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Pagamento</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Forma de pagamento <span className="text-destructive">*</span></Label>
                <SearchableSelect
                  value={payForma}
                  onChange={setPayForma}
                  onCreateRequest={(typed) => openCriar("forma_pagamento", typed, (nome) => setPayForma(nome))}
                  options={formasPagamento}
                  placeholder="Selecione"
                  allowCreate
                  deletableOptions={deletableFormas}
                  onDelete={v => void handleDeleteItem("forma_pagamento", v)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pay-data" className="text-xs font-medium text-muted-foreground">Data do pagamento <span className="text-destructive">*</span></Label>
                <Input
                  id="pay-data"
                  inputMode="numeric"
                  placeholder="dd/mm/aaaa"
                  maxLength={10}
                  value={payData}
                  onChange={e => setPayData(maskDateBR(e.target.value))}
                  aria-invalid={!isValidDateBR(payData)}
                  className={cn("rounded-xl h-10", !isValidDateBR(payData) && "border-destructive focus-visible:ring-destructive")}
                />
                {!isValidDateBR(payData) && (
                  <p className="text-[11px] text-destructive">Data inválida. Use dd/mm/aaaa.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </StandardDialog>
  );
}
