// Capability Registry — espelho mínimo no frontend (somente metadados de UI).
// A fonte de verdade está em supabase/functions/ai-chat/registry.ts.
// Aqui só vivem os dados necessários para Quick Actions e Sugestões.

import { PERMISSIONS } from "@/lib/constants";

export interface ClientCapability {
  id: string;
  skill: string;
  label: string;
  description: string;
  permission: string | null;
  needsApproval: boolean;
  category: "read" | "write" | "automation";
  baselineSeconds: number;
  baselineClicks: number;
  enabled: boolean;
  /** Mensagem que o usuário envia ao clicar na Ação Rápida. */
  promptTemplate?: string;
}

export const CLIENT_CAPABILITIES: ClientCapability[] = [
  {
    id: "paciente.search",
    skill: "paciente",
    label: "Pesquisar paciente",
    description: "Encontre um paciente por nome, CPF ou telefone.",
    permission: PERMISSIONS.VIEW_PATIENTS,
    needsApproval: false,
    category: "read",
    baselineSeconds: 20,
    baselineClicks: 4,
    enabled: true,
    promptTemplate: "Pesquisar paciente: ",
  },
  {
    id: "paciente.create",
    skill: "paciente",
    label: "Cadastrar paciente",
    description: "Cadastre um novo paciente.",
    permission: PERMISSIONS.CREATE_PATIENT,
    needsApproval: true,
    category: "write",
    baselineSeconds: 90,
    baselineClicks: 12,
    enabled: true,
    promptTemplate: "Cadastrar paciente. ",
  },
  {
    id: "atendimento.create",
    skill: "atendimento",
    label: "Criar atendimento",
    description: "Placeholder — disponível na próxima fase.",
    permission: null,
    needsApproval: true,
    category: "write",
    baselineSeconds: 0,
    baselineClicks: 0,
    enabled: false,
  },
];
