// AI-SISLAC Capability Registry — única fonte de verdade do Assistente.
// Reduzido ao mínimo operacional (id, description, permission, category,
// needsApproval, tool). Nada de UI, baselines, ícones, manifests ou actions[].

export type CapabilityCategory =
  | "paciente" | "atendimento" | "resultados";

export interface CapabilityMeta {
  id: string;
  description: string;
  permission: string | null;
  category: CapabilityCategory;
  needsApproval: boolean;
  tool: string;
}

export const CAPABILITIES: CapabilityMeta[] = [
  {
    id: "paciente.search",
    description: "Busca pacientes do tenant atual por nome, CPF ou telefone.",
    permission: "visualizar_pacientes",
    category: "paciente",
    needsApproval: false,
    tool: "paciente_search",
  },
  {
    id: "paciente.create",
    description: "Cria um novo paciente no tenant atual.",
    permission: "cadastrar_paciente",
    category: "paciente",
    needsApproval: true,
    tool: "paciente_create",
  },
  {
    id: "paciente.exames",
    description: "Lista os exames realizados por um paciente.",
    permission: "visualizar_pacientes",
    category: "paciente",
    needsApproval: false,
    tool: "paciente_exames",
  },
  {
    id: "atendimento.count",
    description: "Conta atendimentos por período (hoje/semana/mês/ano/total) e/ou status.",
    permission: "visualizar_atendimentos",
    category: "atendimento",
    needsApproval: false,
    tool: "atendimento_count",
  },
  {
    id: "atendimento.summary",
    description: "Resumo agregado de atendimentos por status, com filtro de período.",
    permission: "visualizar_atendimentos",
    category: "atendimento",
    needsApproval: false,
    tool: "atendimento_summary",
  },
  {
    id: "resultado.open",
    description: "Abre a tela de resultado do paciente (por protocolo ou paciente+exame).",
    permission: "liberar_resultado",
    category: "resultados",
    needsApproval: false,
    tool: "resultado_open",
  },
  {
    id: "resultado.set",
    description: "Insere/atualiza 1..N parâmetros de UM exame de um paciente. Exige confirmação.",
    permission: "liberar_resultado",
    category: "resultados",
    needsApproval: true,
    tool: "resultado_set",
  },
];

// Validação cold-start: ids únicos.
(function validateRegistry() {
  const seen = new Set<string>();
  for (const cap of CAPABILITIES) {
    if (seen.has(cap.id)) throw new Error(`[registry] Capability duplicada: ${cap.id}`);
    seen.add(cap.id);
  }
})();

export function findCapabilityByTool(toolKey: string): CapabilityMeta | undefined {
  return CAPABILITIES.find((c) => c.tool === toolKey);
}
