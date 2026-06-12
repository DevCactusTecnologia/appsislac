// Estado dos diálogos do Financeiro (Fase 4 — passo 2).
// Extraído de Financeiro.tsx — apenas colocação de useState.
// Zero mudança de comportamento.
import { useState } from "react";
import type { FinanceiroEntry } from "../types";

export function useFinanceiroDialogs() {
  // Edit
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FinanceiroEntry | null>(null);
  // Delete
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingProtocolo, setDeletingProtocolo] = useState<string>("");
  // Detail
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailEntry, setDetailEntry] = useState<FinanceiroEntry | null>(null);
  // Pagar
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<FinanceiroEntry | null>(null);
  const [payForma, setPayForma] = useState<string>("PIX");
  const [payData, setPayData] = useState<string>("");
  // Receber (A Receber)
  const [receberDialogOpen, setReceberDialogOpen] = useState(false);
  const [receberInitial, setReceberInitial] = useState<{
    tipo: "paciente" | "convenio" | "protocolo";
    protocolo?: string;
  } | null>(null);
  // Nova entrada/saída
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTipo, setDialogTipo] = useState<"entrada" | "saida">("entrada");
  // Fechar fatura
  const [fecharFaturaOpen, setFecharFaturaOpen] = useState(false);
  const [fecharFaturaAlvo, setFecharFaturaAlvo] = useState<
    { convenioId: number; convenioNome: string } | null
  >(null);
  // Drill-down de fatura nas Entradas
  const [faturaDetalheOpen, setFaturaDetalheOpen] = useState(false);
  const [faturaDetalheAlvo, setFaturaDetalheAlvo] = useState<
    { id: number; codigo: string; convenio: string; total: number } | null
  >(null);
  // Mini modal "Criar item"
  const [criarOpen, setCriarOpen] = useState(false);
  const [criarCategoria, setCriarCategoria] = useState<
    "tipo_despesa" | "destino_pagamento" | "forma_pagamento"
  >("tipo_despesa");
  const [criarInitialValue, setCriarInitialValue] = useState("");
  const [criarOnSuccess, setCriarOnSuccess] = useState<((nome: string) => void) | null>(null);
  // Seleção de saídas (ações em lote)
  const [saidasSelecionadas, setSaidasSelecionadas] = useState<Set<string>>(new Set());

  return {
    editDialogOpen, setEditDialogOpen,
    editingEntry, setEditingEntry,
    deleteDialogOpen, setDeleteDialogOpen,
    deletingProtocolo, setDeletingProtocolo,
    detailDialogOpen, setDetailDialogOpen,
    detailEntry, setDetailEntry,
    payDialogOpen, setPayDialogOpen,
    payTarget, setPayTarget,
    payForma, setPayForma,
    payData, setPayData,
    receberDialogOpen, setReceberDialogOpen,
    receberInitial, setReceberInitial,
    dialogOpen, setDialogOpen,
    dialogTipo, setDialogTipo,
    fecharFaturaOpen, setFecharFaturaOpen,
    fecharFaturaAlvo, setFecharFaturaAlvo,
    faturaDetalheOpen, setFaturaDetalheOpen,
    faturaDetalheAlvo, setFaturaDetalheAlvo,
    criarOpen, setCriarOpen,
    criarCategoria, setCriarCategoria,
    criarInitialValue, setCriarInitialValue,
    criarOnSuccess, setCriarOnSuccess,
    saidasSelecionadas, setSaidasSelecionadas,
  };
}

export type FinanceiroDialogsState = ReturnType<typeof useFinanceiroDialogs>;
