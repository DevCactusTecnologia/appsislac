// Capability Registry — Edge side (única fonte de verdade)
// SSOT: este arquivo é o único lugar onde Capabilities podem ser declaradas.
// Frontend consome o Manifest derivado por buildManifest()/Edge ai-manifest.

export type CapabilityCategory =
  | "paciente" | "atendimento" | "exames" | "resultados"
  | "soroteca" | "financeiro" | "whatsapp" | "producao" | "configuracao";

export type CapabilityVisibility =
  | "always" | "contextual" | "hidden" | "disabled" | "experimental";

export interface CapabilityActionRef {
  /** Identificador estável da Action (tool/RPC/serviço oficial). */
  id: string;
  /** Tool name exposto ao LLM (formato registry id com "_"). */
  tool?: string;
}

export interface CapabilityMeta {
  id: string;                       // ex.: "paciente.search"
  title: string;                    // texto humano curto (UI)
  description: string;              // descrição (UI + LLM)
  permission: string | null;        // chave em PERMISSIONS (null = sem requisito)
  category: CapabilityCategory;
  visibility: CapabilityVisibility;
  priority: number;                 // menor = mais relevante
  baselineSeconds: number;          // tempo manual estimado
  baselineClicks: number;           // cliques manuais estimados
  needsApproval: boolean;           // mutações exigem confirmação humana
  /** Aparece como Ação Rápida no Modo Assistente? */
  quickAction: boolean;
  /** Pode aparecer como Sugestão contextual? */
  supportsSuggestions: boolean;
  /** Ícone lucide-react (nome). */
  icon: string;
  /** Token semântico para cor (sem hex). */
  color: "primary" | "secondary" | "muted" | "destructive";
  /** Actions resolvidas a partir desta Capability. */
  actions: CapabilityActionRef[];
  /** Template de prompt para o Modo Assistente. */
  promptTemplate?: string;
}

export const CAPABILITIES: CapabilityMeta[] = [
  {
    id: "paciente.search",
    title: "Pesquisar paciente",
    description: "Busca pacientes do tenant atual por nome, CPF ou telefone.",
    permission: "visualizar_pacientes",
    category: "paciente",
    visibility: "always",
    priority: 10,
    baselineSeconds: 20,
    baselineClicks: 4,
    needsApproval: false,
    quickAction: true,
    supportsSuggestions: true,
    icon: "Search",
    color: "primary",
    actions: [{ id: "paciente.search", tool: "paciente_search" }],
    promptTemplate: "Pesquisar paciente: ",
  },
  {
    id: "paciente.create",
    title: "Cadastrar paciente",
    description: "Cria um novo paciente no tenant atual.",
    permission: "cadastrar_paciente",
    category: "paciente",
    visibility: "always",
    priority: 20,
    baselineSeconds: 90,
    baselineClicks: 12,
    needsApproval: true,
    quickAction: true,
    supportsSuggestions: false,
    icon: "UserPlus",
    color: "primary",
    actions: [{ id: "paciente.create", tool: "paciente_create" }],
    promptTemplate: "Cadastrar paciente. ",
  },
  {
    id: "atendimento.count",
    title: "Contar atendimentos",
    description: "Conta atendimentos do tenant por período (hoje, semana, mês, ano, total) e/ou status.",
    permission: "visualizar_atendimentos",
    category: "atendimento",
    visibility: "always",
    priority: 30,
    baselineSeconds: 15,
    baselineClicks: 3,
    needsApproval: false,
    quickAction: false,
    supportsSuggestions: true,
    icon: "Hash",
    color: "primary",
    actions: [{ id: "atendimento.count", tool: "atendimento_count" }],
    promptTemplate: "Quantos atendimentos ",
  },
  {
    id: "atendimento.summary",
    title: "Resumo de atendimentos",
    description: "Resumo agregado de atendimentos por status, com filtro de período.",
    permission: "visualizar_atendimentos",
    category: "atendimento",
    visibility: "always",
    priority: 31,
    baselineSeconds: 25,
    baselineClicks: 5,
    needsApproval: false,
    quickAction: false,
    supportsSuggestions: true,
    icon: "BarChart3",
    color: "primary",
    actions: [{ id: "atendimento.summary", tool: "atendimento_summary" }],
    promptTemplate: "Resumo dos atendimentos ",
  },
];

// ---------------------------------------------------------------------------
// Validação obrigatória — falha em build/cold-start se faltar campo.
// ---------------------------------------------------------------------------
const REQUIRED_FIELDS: (keyof CapabilityMeta)[] = [
  "id", "title", "description", "category", "visibility", "priority",
  "baselineSeconds", "baselineClicks", "actions",
];

(function validateRegistry() {
  const seen = new Set<string>();
  for (const cap of CAPABILITIES) {
    for (const f of REQUIRED_FIELDS) {
      if (cap[f] === undefined || cap[f] === null) {
        throw new Error(`[registry] Capability "${cap?.id ?? "?"}" sem campo obrigatório: ${String(f)}`);
      }
    }
    if (seen.has(cap.id)) throw new Error(`[registry] Capability duplicada: ${cap.id}`);
    seen.add(cap.id);
    if (!Array.isArray(cap.actions) || cap.actions.length === 0) {
      throw new Error(`[registry] Capability "${cap.id}" sem actions`);
    }
  }
})();

export function findCapability(id: string): CapabilityMeta | undefined {
  return CAPABILITIES.find((c) => c.id === id);
}

// ---------------------------------------------------------------------------
// Manifest — payload público (somente metadados de interface).
// Nunca expor: tools internas, SQL, services, secrets.
// ---------------------------------------------------------------------------
export interface ManifestItem {
  id: string;
  title: string;
  description: string;
  category: CapabilityCategory;
  visibility: CapabilityVisibility;
  priority: number;
  icon: string;
  color: CapabilityMeta["color"];
  enabled: boolean;
  needsApproval: boolean;
  quickAction: boolean;
  supportsSuggestions: boolean;
  baselineSeconds: number;
  baselineClicks: number;
  permission: string | null;
  promptTemplate?: string;
}

export interface Manifest {
  version: string;
  generatedAt: string;
  items: ManifestItem[];
}

export const MANIFEST_VERSION = "2.1.0";

export function buildManifest(allowedIds: Set<string>): Manifest {
  const items: ManifestItem[] = CAPABILITIES
    .filter((c) => c.visibility !== "hidden")
    .map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      category: c.category,
      visibility: c.visibility,
      priority: c.priority,
      icon: c.icon,
      color: c.color,
      enabled: c.visibility !== "disabled" && allowedIds.has(c.id),
      needsApproval: c.needsApproval,
      quickAction: c.quickAction,
      supportsSuggestions: c.supportsSuggestions,
      baselineSeconds: c.baselineSeconds,
      baselineClicks: c.baselineClicks,
      permission: c.permission,
      promptTemplate: c.promptTemplate,
    }))
    .sort((a, b) => a.priority - b.priority);
  return { version: MANIFEST_VERSION, generatedAt: new Date().toISOString(), items };
}
