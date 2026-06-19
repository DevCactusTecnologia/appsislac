// Diálogo de detalhes de entrada/saída financeira.
// Extraído de Financeiro.tsx (Fase 4). JSX/comportamento preservados literalmente.
import {
  ArrowUpCircle, FileText, Pencil, CheckCircle, Printer,
  QrCode, Banknote, CreditCard,
} from "lucide-react";
import { cn, fmtBRL, fmtBRLNumber } from "@/lib/utils";
import { printHtmlInHiddenFrame } from "@/lib/printHtml";
import { Button } from "@/components/ui/button";
import StandardDialog from "@/components/ui/standard-dialog";
import type { FinanceiroEntry } from "../../types";
import type { MockAtendimento } from "@/data/types";
import type { DetailExameValor } from "../../services/computeDetailExames";

interface Props {
  open: boolean;
  detailEntry: FinanceiroEntry | null;
  detailAtendimento: MockAtendimento | null;
  detailExames: DetailExameValor[];
  detailTotalExames: number;
  detailSubtotalExames: number;
  detailDescontoExames: number;
  detailTotalPago: number;
  detailSaldo: number;
  onClose: () => void;
  onPagar: () => void;
  onEdit: () => void;
}

export default function DetailEntryDialog({
  open, detailEntry, detailAtendimento, detailExames,
  detailTotalExames, detailSubtotalExames, detailDescontoExames,
  detailTotalPago, detailSaldo,
  onClose, onPagar, onEdit,
}: Props) {
  const handlePrint = () => {
    if (!detailEntry) return;
    const examesHtml = detailAtendimento ? detailExames.map(e => `<div class="line"><span>${e.nome}</span><span>R$ ${fmtBRLNumber(e.valor)}</span></div>`).join("") : "";
    const pagsHtml = detailAtendimento ? (detailAtendimento.pagamentosRealizados ?? []).map(p => `<div class="line"><span>${p.tipo} — ${p.data}</span><span>R$ ${fmtBRLNumber(p.valor)}</span></div>`).join("") : `<div class="line"><span>${detailEntry.pagamento}</span><span>R$ ${fmtBRLNumber(detailEntry.valorTotal)}</span></div>`;
    const html = `<html><head><title>Comprovante</title><style>body{font-family:Arial,sans-serif;padding:24px;font-size:13px;color:#222}h2{text-align:center;margin-bottom:4px}.sub{text-align:center;color:#888;font-size:11px;margin-bottom:16px}.line{display:flex;justify-content:space-between;padding:4px 0}.divider{border-top:1px dashed #ccc;margin:12px 0}.bold{font-weight:bold}</style></head><body><h2>Comprovante de Pagamento</h2><p class="sub">${detailEntry.data}</p><div class="divider"></div><div class="line"><span>Protocolo:</span><span class="bold">${detailEntry.protocolo}</span></div><div class="line"><span>Cliente:</span><span class="bold">${detailEntry.cliente}</span></div><div class="line"><span>Convênio:</span><span>${detailEntry.convenio ?? "—"}</span></div>${examesHtml ? `<div class="divider"></div><div class="line bold"><span>Exames:</span></div>${examesHtml}<div class="divider"></div><div class="line bold"><span>Total exames:</span><span>R$ ${fmtBRLNumber(detailTotalExames)}</span></div>` : ""}<div class="divider"></div><div class="line bold"><span>Pagamentos:</span></div>${pagsHtml}<div class="divider"></div><div class="line bold"><span>Valor:</span><span>R$ ${fmtBRLNumber(detailEntry.valorTotal)}</span></div>${detailAtendimento ? `<div class="line"><span>Total pago:</span><span>R$ ${fmtBRLNumber(detailTotalPago)}</span></div><div class="line bold"><span>Saldo devedor:</span><span style="color:${detailSaldo > 0.01 ? '#dc2626' : '#16a34a'}">R$ ${fmtBRLNumber(Math.max(0,detailSaldo))}</span></div>` : ""}</body></html>`;
    printHtmlInHiddenFrame({ html, frameId: "financeiro-comprovante-print-frame" });
  };

  return (
    <StandardDialog
      open={open}
      onClose={onClose}
      icon={detailEntry?.tipo === "saida"
        ? <ArrowUpCircle className="h-5 w-5 text-destructive" />
        : <FileText className="h-5 w-5 text-primary" />}
      title={detailEntry?.tipo === "saida" ? "Detalhes da despesa" : "Detalhes da entrada"}
      subtitle={detailEntry?.protocolo}
      maxWidth="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} className="rounded-2xl">Fechar</Button>
          <Button variant="outline" className="rounded-2xl gap-2" onClick={handlePrint}>
            <Printer className="h-4 w-4" />Imprimir
          </Button>
          {detailEntry?.tipo === "saida" && detailEntry.foiPago !== "Sim" && (
            <>
              <Button variant="outline" className="rounded-2xl gap-2" onClick={onEdit}>
                <Pencil className="h-4 w-4" />Editar
              </Button>
              <Button className="rounded-2xl gap-2 bg-status-success text-white hover:bg-status-success/90" onClick={onPagar}>
                <CheckCircle className="h-4 w-4" />Pagar agora
              </Button>
            </>
          )}
        </>
      }
    >
      {detailEntry && (
        <div className="px-6 py-5 space-y-4">
          <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">{detailEntry.tipo === "saida" ? "Descrição" : "Cliente"}</span><span className="font-bold text-foreground">{detailEntry.tipo === "saida" ? (detailEntry.descricao || detailEntry.cliente) : detailEntry.cliente}</span></div>
            {detailEntry.tipo === "saida" ? (
              <>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Tipo despesa</span><span className="text-foreground">{detailEntry.tipoDespesa ?? "—"}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Destino</span><span className="text-foreground">{detailEntry.destinoPagamento ?? "—"}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Vencimento</span><span className="text-foreground">{detailEntry.dataVencimento ?? "—"}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Pago?</span><span className={cn("font-semibold", detailEntry.foiPago === "Sim" ? "text-status-success" : "text-destructive")}>{detailEntry.foiPago ?? "—"}</span></div>
                {detailEntry.foiPago === "Sim" && (
                  <>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Data pgto</span><span className="text-foreground">{detailEntry.dataPagamento ?? "—"}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Forma pgto</span><span className="font-medium text-foreground">{detailEntry.pagamento}</span></div>
                  </>
                )}
              </>
            ) : (
              <>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Data</span><span className="text-foreground">{detailEntry.data}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Convênio</span><span className="text-foreground">{detailEntry.convenio ?? "—"}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Forma pgto</span><span className="font-medium text-foreground">{detailEntry.pagamento}</span></div>
              </>
            )}
            <div className="h-px bg-border/40" />
            <div className="flex justify-between text-sm font-bold"><span>Valor</span><span className={detailEntry.tipo === "saida" ? "text-destructive" : "text-foreground"}>{detailEntry.tipo === "saida" ? "- " : ""}{fmtBRL(detailEntry.valorTotal)}</span></div>
          </div>

          {detailAtendimento && (
            <>
              <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
                <p className="text-xs font-semibold text-primary uppercase tracking-wider">Exames</p>
                {detailExames.map((e, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{e.nome}</span>
                    <span className="font-medium text-foreground">{fmtBRL(e.valorOriginal)}</span>
                  </div>
                ))}
                <div className="h-px bg-border/40" />
                {detailDescontoExames > 0 && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="text-foreground">{fmtBRL(detailSubtotalExames)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-status-success">Desconto aplicado</span>
                      <span className="font-medium text-status-success">− {fmtBRL(detailDescontoExames)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-sm font-bold"><span>Total exames</span><span>{fmtBRL(detailTotalExames)}</span></div>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
                <p className="text-xs font-semibold text-primary uppercase tracking-wider">Pagamentos</p>
                {(detailAtendimento.pagamentosRealizados ?? []).map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-2">
                      {p.tipo === "PIX" && <QrCode className="h-3.5 w-3.5" />}
                      {p.tipo === "Dinheiro" && <Banknote className="h-3.5 w-3.5" />}
                      {(p.tipo === "Crédito" || p.tipo === "Débito" || p.tipo.includes("crédito") || p.tipo.includes("débito") || p.tipo.includes("Cartão")) && <CreditCard className="h-3.5 w-3.5" />}
                      {p.tipo} — {p.data}
                    </span>
                    <span className="font-medium text-foreground">{fmtBRL(p.valor)}</span>
                  </div>
                ))}
                <div className="h-px bg-border/40" />
                <div className="flex justify-between text-sm font-bold"><span>Total pago</span><span className="text-status-success">{fmtBRL(detailTotalPago)}</span></div>
              </div>
              <div className="rounded-2xl bg-muted/30 p-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Status atendimento</span><span className="font-medium">{detailAtendimento.statusAtendimento.label}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Status pagamento</span><span className="font-medium">{detailAtendimento.statusPagamento.label}</span></div>
                <div className="h-px bg-border/40" />
                <div className="flex justify-between text-sm font-bold"><span>Saldo devedor</span><span className={detailSaldo > 0.01 ? "text-destructive" : "text-status-success"}>{fmtBRL(Math.max(0, detailSaldo))}</span></div>
              </div>
            </>
          )}
        </div>
      )}
    </StandardDialog>
  );
}
