// Tipos públicos do atendimentoStore (Fase 4 split).
// Mantidos com a MESMA assinatura/posicionamento que o arquivo monolítico
// anterior para preservar imports `from "@/data/atendimentoStore"`.

export type StatusExterno =
  | "NAO_APLICAVEL"
  | "AGUARDANDO_ENVIO"
  | "ENVIADO"
  | "EM_ANALISE_LAB"
  | "RESULTADO_RECEBIDO"
  | "IMPORTADO"
  | "FINALIZADO"
  | "ERRO_INTEGRACAO";

export interface AtendimentoExameRow {
  id: number;
  atendimento_id: number;
  /** UUID do exame no catálogo. Pode ser nulo em rows muito antigas. */
  exame_id: string | null;
  nome_exame: string;
  /** UUID do material em `materiais_amostra` (SSOT). */
  material_id: string | null;
  /** Nome derivado (display) — resolvido em runtime a partir de `material_id`. */
  material: string;

  status: "pendente" | "coletado" | "em_bancada" | "analisado" | "em_analise" | "finalizado" | "cancelado";
  data_coleta: string | null;
  data_analise: string | null;
  data_liberacao: string | null;
  motivo_cancelamento: string | null;
  resultados: Record<string, unknown>;
  ordem: number;
  analista: string;
  /** Solicitante específico deste exame (vazio = todos os solicitantes do atendimento). */
  solicitante: string;
  // Snapshot terceirizado
  tipo_processo: "INTERNO" | "TERCEIRIZADO";
  lab_apoio_id: string | null;
  integracao_ativa: boolean;
  status_externo: StatusExterno;
  protocolo_externo: string | null;
  data_envio: string | null;
  data_retorno: string | null;
  resultado_importado: boolean;
  arquivo_resultado_path: string | null;
  /** Override manual de PDF (laudo do apoio anexado pelo operador). */
  pdf_override_url: string | null;
  pdf_override_uploaded_at?: string | null;
  pdf_override_uploaded_by?: string | null;
  pdf_override_motivo?: string | null;
  /** Snapshot regulatório (RDC 786/2023) — congelado pelo trigger ao salvar/finalizar. */
  metodologia_snapshot?: string | null;
  unidade_snapshot?: string | null;
  /** True quando o exame teve resultado liberado e foi reaberto/editado. */
  retificado?: boolean;
  /** Timestamp ISO da última retificação. */
  retificado_at?: string | null;
}

export interface AtendimentoExamePatch {
  status?: "pendente" | "coletado" | "em_bancada" | "analisado" | "em_analise" | "finalizado" | "cancelado";
  resultados?: Record<string, unknown>;
  motivo_cancelamento?: string | null;
  data_coleta?: string | null;
  data_analise?: string | null;
  data_liberacao?: string | null;
  analista?: string;
  retificado?: boolean;
}

export interface TerceirizadoActionResult {
  ok: boolean;
  error?: string;
  protocolo_externo?: string;
  status_externo?: StatusExterno;
}

export interface ExameOperacionalRow {
  id: number;                  // id da linha em atendimento_exames
  atendimento_id: number;
  protocolo: string;
  paciente_id: number | null;
  paciente_nome: string;
  paciente_cpf: string;        // CPF (somente dígitos) — usado para resolver telefone
  paciente_sexo: string;       // não persistido; default "M" (não usado nas telas operacionais hoje)
  paciente_nascimento: string; // ISO yyyy-mm-dd
  unidade_id: string;
  responsavel: string;         // analista (vazio se não definido)
  exames: Array<{
    id: number;
    nome: string;
    exame_id: string | null;
    amostra_id: string | null;
    material_id: string | null;
    material: string;

    status: "pendente" | "coletado" | "em_bancada" | "analisado" | "em_analise" | "finalizado" | "cancelado";
    data_coleta: string | null;
    data_analise: string | null;
    motivo_cancelamento: string | null;
    updated_at: string | null;
    tipo_processo: "INTERNO" | "TERCEIRIZADO";
    lab_apoio_id: string | null;
  }>;
}

export interface TerceirizadoOperacionalRow extends AtendimentoExameRow {
  protocolo: string;
  paciente_nome: string;
  paciente_cpf: string;
  paciente_nascimento: string | null;
  unidade_id: string | null;
}
