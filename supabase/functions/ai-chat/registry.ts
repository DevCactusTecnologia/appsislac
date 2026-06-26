// Capability Registry — Edge side (única fonte de verdade)
// Cada Skill declara Capabilities, Actions, permissões, baseline e confirmação.
// O LLM só conhece o que está aqui.

export interface CapabilityMeta {
  id: string;                      // ex.: "paciente.search"
  skill: string;                   // ex.: "paciente"
  label: string;                   // texto humano curto
  description: string;             // descrição usada pelo LLM
  permission: string | null;       // chave em PERMISSIONS
  needsApproval: boolean;          // mutações exigem confirmação humana
  category: "read" | "write" | "automation";
  baselineSeconds: number;         // tempo manual estimado
  baselineClicks: number;          // cliques manuais estimados
}

export const CAPABILITIES: CapabilityMeta[] = [
  {
    id: "paciente.search",
    skill: "paciente",
    label: "Pesquisar paciente",
    description: "Busca pacientes do tenant atual por nome, CPF ou telefone.",
    permission: "visualizar_pacientes",
    needsApproval: false,
    category: "read",
    baselineSeconds: 20,
    baselineClicks: 4,
  },
  {
    id: "paciente.create",
    skill: "paciente",
    label: "Cadastrar paciente",
    description: "Cria um novo paciente no tenant atual.",
    permission: "cadastrar_paciente",
    needsApproval: true,
    category: "write",
    baselineSeconds: 90,
    baselineClicks: 12,
  },
];

export function findCapability(id: string): CapabilityMeta | undefined {
  return CAPABILITIES.find((c) => c.id === id);
}
