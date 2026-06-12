// Diálogo de edição de saída financeira.
// Extraído de Financeiro.tsx (Fase 4). JSX/comportamento preservados literalmente.
import { ArrowUpCircle, FileText, CheckCircle } from "lucide-react";
import { Wallet, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
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
  editingEntry: FinanceiroEntry | null;
  setEditingEntry: (e: FinanceiroEntry | null | ((prev: FinanceiroEntry | null) => FinanceiroEntry | null)) => void;
  onClose: () => void;
  onSave: () => void;
  dict: DictionaryHandlers;
}

export default function EditEntryDialog({
  open, editingEntry, setEditingEntry, onClose, onSave, dict,
}: Props) {
  const {
    tiposDespesa, destinosPagamento, formasPagamento,
    deletableTipos, deletableDestinos, deletableFormas,
    openCriar, handleDeleteItem,
  } = dict;

  return (
    <StandardDialog
      open={open}
      onClose={onClose}
      icon={<ArrowUpCircle className="h-5 w-5 text-destructive" />}
      title="Editar saída"
      subtitle={editingEntry ? `Protocolo ${editingEntry.protocolo}` : "Altere os dados da despesa"}
      maxWidth="2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} className="rounded-2xl">Cancelar</Button>
          <Button onClick={onSave} className="rounded-2xl">Salvar alterações</Button>
        </>
      }
    >
      {editingEntry && (
        <div className="px-6 py-5 space-y-4">
          {/* Card: Classificação */}
          <div className="rounded-2xl border border-border/50 bg-muted/15 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Classificação</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Tipo de despesa <span className="text-destructive">*</span></Label>
                <SearchableSelect
                  value={editingEntry.tipoDespesa || ""}
                  onChange={v => setEditingEntry({ ...editingEntry, tipoDespesa: v })}
                  onCreateRequest={(typed) => openCriar("tipo_despesa", typed, (nome) => setEditingEntry((prev) => prev ? { ...prev, tipoDespesa: nome } : prev))}
                  options={tiposDespesa}
                  placeholder="Digite ou selecione..."
                  allowCreate
                  deletableOptions={deletableTipos}
                  onDelete={v => {
                    void handleDeleteItem("tipo_despesa", v);
                    if (editingEntry.tipoDespesa === v) setEditingEntry({ ...editingEntry, tipoDespesa: "" });
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Destino do pagamento</Label>
                <SearchableSelect
                  value={editingEntry.destinoPagamento || ""}
                  onChange={v => setEditingEntry({ ...editingEntry, destinoPagamento: v })}
                  onCreateRequest={(typed) => openCriar("destino_pagamento", typed, (nome) => setEditingEntry((prev) => prev ? { ...prev, destinoPagamento: nome } : prev))}
                  options={destinosPagamento}
                  placeholder="Digite ou selecione..."
                  allowCreate
                  deletableOptions={deletableDestinos}
                  onDelete={v => {
                    void handleDeleteItem("destino_pagamento", v);
                    if (editingEntry.destinoPagamento === v) setEditingEntry({ ...editingEntry, destinoPagamento: "" });
                  }}
                />
              </div>
            </div>
          </div>

          {/* Card: Detalhes */}
          <div className="rounded-2xl border border-border/50 bg-muted/15 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Detalhes</span>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-cliente" className="text-xs font-medium text-muted-foreground">Cliente / Fornecedor</Label>
              <Input
                id="edit-cliente"
                value={editingEntry.cliente}
                maxLength={120}
                onChange={e => setEditingEntry({ ...editingEntry, cliente: e.target.value })}
                className="rounded-xl h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-descricao" className="text-xs font-medium text-muted-foreground">Descrição</Label>
              <Input
                id="edit-descricao"
                value={editingEntry.descricao || ""}
                maxLength={200}
                placeholder="Ex. Conta de luz — Janeiro/2026"
                onChange={e => setEditingEntry({ ...editingEntry, descricao: e.target.value })}
                className="rounded-xl h-10"
              />
            </div>
          </div>

          {/* Card: Valores e Datas */}
          <div className="rounded-2xl border border-border/50 bg-muted/15 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Valores e Datas</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-valor" className="text-xs font-medium text-muted-foreground">Valor (R$)</Label>
                <Input
                  id="edit-valor"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editingEntry.valorTotal}
                  onChange={e => setEditingEntry({ ...editingEntry, valorTotal: parseFloat(e.target.value) || 0 })}
                  className="rounded-xl h-10 font-semibold"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-vencimento" className="text-xs font-medium text-muted-foreground">Vencimento</Label>
                <Input
                  id="edit-vencimento"
                  inputMode="numeric"
                  placeholder="dd/mm/aaaa"
                  maxLength={10}
                  value={editingEntry.dataVencimento || ""}
                  onChange={e => setEditingEntry({ ...editingEntry, dataVencimento: maskDateBR(e.target.value) })}
                  aria-invalid={!isValidDateBR(editingEntry.dataVencimento || "")}
                  className={cn("rounded-xl h-10", !isValidDateBR(editingEntry.dataVencimento || "") && "border-destructive focus-visible:ring-destructive")}
                />
                {!isValidDateBR(editingEntry.dataVencimento || "") && (
                  <p className="text-[11px] text-destructive">Data inválida. Use dd/mm/aaaa.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Forma de pagamento</Label>
                <SearchableSelect
                  value={editingEntry.pagamento === "—" ? "" : editingEntry.pagamento}
                  onChange={v => setEditingEntry({ ...editingEntry, pagamento: v })}
                  onCreateRequest={(typed) => openCriar("forma_pagamento", typed, (nome) => setEditingEntry((prev) => prev ? { ...prev, pagamento: nome } : prev))}
                  options={formasPagamento}
                  placeholder="Selecione"
                  allowCreate
                  deletableOptions={deletableFormas}
                  onDelete={v => void handleDeleteItem("forma_pagamento", v)}
                />
              </div>
            </div>
          </div>

          {/* Card: Status do pagamento */}
          <div className="rounded-2xl border border-border/50 bg-muted/15 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-primary" />
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status do pagamento</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Foi pago?</Label>
                <div className="flex gap-2">
                  {(["Sim", "Não"] as const).map(opt => {
                    const active = (editingEntry.foiPago || "Não") === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          const today = new Date();
                          const hoje = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;
                          setEditingEntry({
                            ...editingEntry,
                            foiPago: opt,
                            dataPagamento: opt === "Não" ? "" : (editingEntry.dataPagamento || hoje),
                          });
                        }}
                        className={cn(
                          "flex-1 h-10 rounded-xl border text-sm font-medium transition-all",
                          active
                            ? opt === "Sim"
                              ? "bg-status-success/10 border-status-success/40 text-status-success"
                              : "bg-muted/60 border-border text-foreground"
                            : "bg-background border-border text-muted-foreground hover:bg-muted/30",
                        )}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
              {editingEntry.foiPago === "Sim" && (
                <div className="space-y-1.5">
                  <Label htmlFor="edit-data-pgto" className="text-xs font-medium text-muted-foreground">Data do pagamento</Label>
                  <Input
                    id="edit-data-pgto"
                    inputMode="numeric"
                    placeholder="dd/mm/aaaa"
                    maxLength={10}
                    value={editingEntry.dataPagamento || ""}
                    onChange={e => setEditingEntry({ ...editingEntry, dataPagamento: maskDateBR(e.target.value) })}
                    aria-invalid={!isValidDateBR(editingEntry.dataPagamento || "")}
                    className={cn("rounded-xl h-10", !isValidDateBR(editingEntry.dataPagamento || "") && "border-destructive focus-visible:ring-destructive")}
                  />
                  {!isValidDateBR(editingEntry.dataPagamento || "") && (
                    <p className="text-[11px] text-destructive">Data inválida. Use dd/mm/aaaa.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </StandardDialog>
  );
}
