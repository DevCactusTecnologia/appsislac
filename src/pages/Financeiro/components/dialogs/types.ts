// Handlers compartilhados pelos diálogos do Financeiro (dicionários dinâmicos).
// Extraído de Financeiro.tsx (Fase 4 — slicing por aba/diálogo).
// Comportamento idêntico — apenas tipagem dos handlers passados como prop.
export type CategoriaDicionario =
  | "tipo_despesa"
  | "destino_pagamento"
  | "forma_pagamento";

export interface DictionaryHandlers {
  tiposDespesa: string[];
  destinosPagamento: string[];
  formasPagamento: string[];
  deletableTipos: string[];
  deletableDestinos: string[];
  deletableFormas: string[];
  openCriar: (
    cat: CategoriaDicionario,
    initialValue: string,
    onSuccess?: (nome: string) => void,
  ) => void;
  handleDeleteItem: (cat: CategoriaDicionario, nome: string) => Promise<void>;
}
