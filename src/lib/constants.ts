/**
 * CONSTANTES CENTRALIZADAS
 * 
 * REGRA: Nunca use magic strings
 * SEMPRE: Importe constantes deste arquivo
 */

// ============================================================================
// ROLES E PERFIS
// ============================================================================

export const ROLES = {
  ADMIN: "admin",
  ANALYST: "analista",
  RECEPTIONIST: "recepcionista",
  FINANCIAL: "financeiro",
  SUPER_ADMIN: "super_admin",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

// ============================================================================
// PERMISSÕES
// ============================================================================

export const PERMISSIONS = {
  // Dashboard
  VIEW_DASHBOARD: "visualizar_dashboard",

  // Pacientes
  VIEW_PATIENTS: "visualizar_pacientes",
  CREATE_PATIENT: "cadastrar_paciente",
  EDIT_PATIENT: "editar_paciente",

  // Atendimentos
  VIEW_APPOINTMENTS: "visualizar_atendimentos",
  CREATE_APPOINTMENT: "criar_atendimento",
  EDIT_APPOINTMENT: "editar_atendimento",

  // Exames
  ANALYZE_SAMPLE: "analisar_amostra",
  RELEASE_RESULT: "liberar_resultado",
  PRINT_REPORT: "imprimir_laudo",
  REGISTER_COLLECTION: "registrar_coleta",
  QUERY_RESULTS: "consultar_resultados",

  // Financeiro
  FINANCIAL_MANAGEMENT: "gestao_financeira",
  REGISTER_PAYMENT: "registrar_pagamento",
  VIEW_FINANCIAL: "visualizar_financeiro",

  // Orçamentos
  CREATE_BUDGET: "criar_orcamento",
  VIEW_BUDGETS: "visualizar_orcamentos",

  // Módulos
  LAB_SUPPORT_ACCESS: "lab_apoio_acesso",
  WORK_MAP_ACCESS: "mapa_trabalho_acesso",
  SITE_REQUESTS_ACCESS: "solicitacoes_site_acesso",

  // Relatórios
  VIEW_REPORTS: "relatorios_producao",

  // Wildcard
  ADMIN_ALL: "*",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// ============================================================================
// STATUS
// ============================================================================

export const STATUS = {
  ACTIVE: "ativo",
  INACTIVE: "inativo",
  PENDING: "pendente",
  ARCHIVED: "arquivado",
} as const;

export type Status = (typeof STATUS)[keyof typeof STATUS];

// ============================================================================
// STATUS DE ATENDIMENTO
// ============================================================================

export const APPOINTMENT_STATUS = {
  INITIAL: "inicial",
  COLLECTION: "coleta",
  ANALYSIS: "analise",
  CRITICAL: "critico",
  RESULT: "resultado",
  RELEASED: "liberado",
  PRINTED: "impresso",
  COMPLETED: "completo",
  CANCELLED: "cancelado",
} as const;

export type AppointmentStatus =
  (typeof APPOINTMENT_STATUS)[keyof typeof APPOINTMENT_STATUS];

// ============================================================================
// STATUS DE RESULTADO
// ============================================================================

export const RESULT_STATUS = {
  PENDING: "pendente",
  REVIEW: "revisao",
  CRITICAL: "critico",
  RELEASED: "liberado",
  PRINTED: "impresso",
} as const;

export type ResultStatus = (typeof RESULT_STATUS)[keyof typeof RESULT_STATUS];

// ============================================================================
// STATUS FINANCEIRO
// ============================================================================

export const FINANCIAL_STATUS = {
  PENDING: "pendente",
  PAID: "pago",
  OVERDUE: "vencido",
  CANCELLED: "cancelado",
} as const;

export type FinancialStatus =
  (typeof FINANCIAL_STATUS)[keyof typeof FINANCIAL_STATUS];

// ============================================================================
// TIPOS DE UNIDADE
// ============================================================================

export const UNIT_TYPES = {
  HEADQUARTERS: "matriz",
  CLINIC: "clinica",
  COLLECTION_POINT: "ponto_coleta",
} as const;

export type UnitType = (typeof UNIT_TYPES)[keyof typeof UNIT_TYPES];

// ============================================================================
// TABELAS DE PREÇO
// ============================================================================

export const PRICE_TABLE_TYPES = {
  OWN: "Própria",
  AGREEMENT: "Convênio",
  SPECIAL: "Especial",
} as const;

export type PriceTableType =
  (typeof PRICE_TABLE_TYPES)[keyof typeof PRICE_TABLE_TYPES];

// ============================================================================
// TIPOS DE DESCONTO
// ============================================================================

export const DISCOUNT_TYPES = {
  PERCENTAGE: "percentual",
  FIXED: "fixo",
} as const;

export type DiscountType = (typeof DISCOUNT_TYPES)[keyof typeof DISCOUNT_TYPES];

// ============================================================================
// TIPOS DE ACRÉSCIMO
// ============================================================================

export const SURCHARGE_TYPES = {
  PERCENTAGE: "percentual",
  FIXED: "fixo",
} as const;

export type SurchargeType =
  (typeof SURCHARGE_TYPES)[keyof typeof SURCHARGE_TYPES];

// ============================================================================
// TIPOS DE INTEGRAÇÃO
// ============================================================================

export const INTEGRATION_TYPES = {
  HERMES_PARDINI: "hermes_pardini",
  DBSYNC: "dbsync",
} as const;

export type IntegrationType =
  (typeof INTEGRATION_TYPES)[keyof typeof INTEGRATION_TYPES];

// ============================================================================
// PADRÕES DE VALIDAÇÃO
// ============================================================================

export const VALIDATION_PATTERNS = {
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^(\d{10,11})$/,
  CPF: /^(\d{3}\.?\d{3}\.?\d{3}-?\d{2})$/,
  CEP: /^(\d{5}-?\d{3})$/,
} as const;

// ============================================================================
// LIMITES E CONFIGURAÇÕES
// ============================================================================

export const LIMITS = {
  MAX_ITEMS_PER_PAGE: 50,
  MAX_SEARCH_RESULTS: 100,
  MAX_BATCH_SIZE: 1000,
  SESSION_TIMEOUT_MS: 1000 * 60 * 30, // 30 min
  TOKEN_REFRESH_THRESHOLD_MS: 1000 * 60 * 5, // 5 min antes de expirar
} as const;

// ============================================================================
// ENDPOINTS E TABELAS
// ============================================================================

export const TABLES = {
  TENANTS: "tenants",
  PROFILES: "profiles",
  USER_ROLES: "user_roles",
  PATIENTS: "pacientes",
  APPOINTMENTS: "atendimentos",
  EXAMS: "exames",
  EXAM_PRICES: "exames_tabela_preco",
  RESULTS: "resultados",
  CONVENIOS: "convenios",
  UNITS: "unidades",
  USERS: "usuarios",
  AUDIT_LOG: "audit_log",
} as const;

// ============================================================================
// MENSAGENS
// ============================================================================

export const MESSAGES = {
  SUCCESS: {
    SAVED: "Dados salvos com sucesso",
    DELETED: "Dados deletados com sucesso",
    UPDATED: "Dados atualizados com sucesso",
    CREATED: "Dados criados com sucesso",
  },
  ERROR: {
    VALIDATION: "Verifique os dados e tente novamente",
    PERMISSION: "Você não tem permissão para realizar esta ação",
    NETWORK: "Erro de conexão - tente novamente",
    NOT_FOUND: "Recurso não encontrado",
    CONFLICT: "Conflito ao salvar - tente novamente",
    UNEXPECTED: "Erro inesperado - suporte foi notificado",
  },
  LOADING: "Carregando...",
  EMPTY: "Nenhum resultado encontrado",
} as const;

// ============================================================================
// CORES E TEMA
// ============================================================================

export const COLORS = {
  SUCCESS: "#10b981",
  ERROR: "#ef4444",
  WARNING: "#f59e0b",
  INFO: "#3b82f6",
  PENDING: "#f59e0b",
  ACTIVE: "#10b981",
  INACTIVE: "#6b7280",
} as const;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Type-safe object keys
 */
export function getEnumKeys<T extends Record<string, string>>(
  enumObj: T
): (keyof T)[] {
  return Object.keys(enumObj) as (keyof T)[];
}

/**
 * Type-safe object values
 */
export function getEnumValues<T extends Record<string, string>>(
  enumObj: T
): T[keyof T][] {
  return Object.values(enumObj) as T[keyof T][];
}

/**
 * Converter para label amigável
 */
export function toLabel(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
