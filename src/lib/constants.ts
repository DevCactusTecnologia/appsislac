/**
 * Constantes centralizadas do sistema
 * Elimina magic strings e facilita manutenção
 */

// ============================================
// PERMISSÕES
// ============================================

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
  
  // Coleta
  REGISTER_COLLECTION: "registrar_coleta",
  
  // Resultados
  CONSULT_RESULTS: "consultar_resultados",
  
  // Lab
  LAB_SUPPORT_ACCESS: "lab_apoio_acesso",
  WORK_MAP_ACCESS: "mapa_trabalho_acesso",
  
  // Financeiro
  FINANCIAL_MANAGEMENT: "gestao_financeira",
  REGISTER_PAYMENT: "registrar_pagamento",
  VIEW_FINANCIAL: "visualizar_financeiro",
  
  // Orçamentos
  CREATE_QUOTE: "criar_orcamento",
  VIEW_QUOTES: "visualizar_orcamentos",
  
  // Site
  SITE_REQUESTS_ACCESS: "solicitacoes_site_acesso",
  
  // Relatórios
  VIEW_PRODUCTION_REPORTS: "relatorios_producao",
} as const;

// ============================================
// PERFIS/ROLES
// ============================================

export const ROLES = {
  ADMIN: "admin",
  ANALYST: "analista",
  RECEPTIONIST: "recepcionista",
  FINANCIAL: "financeiro",
  SUPER_ADMIN: "super_admin",
} as const;

// ============================================
// STATUS
// ============================================

export const STATUSES = {
  ACTIVE: "ativo",
  INACTIVE: "inativo",
  PENDING: "pendente",
  PROCESSING: "processando",
  COMPLETED: "concluido",
  CANCELLED: "cancelado",
  ARCHIVED: "arquivado",
} as const;

export const TENANT_STATUSES = {
  ACTIVE: "ativo",
  INACTIVE: "inativo",
  SUSPENDED: "suspenso",
} as const;

export const APPOINTMENT_STATUSES = {
  DRAFT: "Rascunho",
  SCHEDULED: "Agendado",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
} as const;

export const RESULT_STATUSES = {
  PENDING: "Pendente",
  RELEASED: "Liberado",
  REVIEWED: "Revisado",
  SENT: "Enviado",
} as const;

export const CRITICAL_STATUSES = {
  NORMAL: "Normal",
  CRITICAL: "Crítico",
  ALERT: "Alerta",
} as const;

// ============================================
// TIPOS E CATEGORIAS
// ============================================

export const USER_TYPES = {
  STAFF: "colaborador",
  PATIENT: "paciente",
} as const;

export const UNIT_TYPES = {
  LAB: "laboratório",
  CLINIC: "clínica",
} as const;

export const GENDER = {
  MALE: "M",
  FEMALE: "F",
  OTHER: "O",
} as const;

export const PATIENT_TYPES = {
  REGULAR: "regular",
  HEALTH_PLAN: "convenio",
  PARTICULAR: "particular",
} as const;

// ============================================
// LIMITES E CONFIGURAÇÕES
// ============================================

export const LIMITS = {
  MAX_PATIENTS_PER_PAGE: 50,
  MAX_APPOINTMENTS_PER_DAY: 500,
  MAX_EXAMS_PER_APPOINTMENT: 100,
  MAX_FILE_SIZE_MB: 50,
  MAX_LOGIN_ATTEMPTS: 5,
  LOGIN_ATTEMPT_WINDOW_MINUTES: 15,
  SESSION_TIMEOUT_MINUTES: 60,
  TOKEN_REFRESH_THRESHOLD_MINUTES: 5,
  API_RATE_LIMIT_PER_MINUTE: 100,
} as const;

export const CACHE_DURATION = {
  SHORT: 5 * 60 * 1000,      // 5 minutos
  MEDIUM: 15 * 60 * 1000,    // 15 minutos
  LONG: 60 * 60 * 1000,      // 1 hora
  VERY_LONG: 24 * 60 * 60 * 1000, // 24 horas
} as const;

// ============================================
// MENSAGENS PADRÃO
// ============================================

export const MESSAGES = {
  // Sucesso
  SUCCESS_CREATED: "Criado com sucesso",
  SUCCESS_UPDATED: "Atualizado com sucesso",
  SUCCESS_DELETED: "Deletado com sucesso",
  SUCCESS_SAVED: "Salvo com sucesso",
  
  // Erro
  ERROR_LOADING: "Erro ao carregar dados",
  ERROR_SAVING: "Erro ao salvar",
  ERROR_DELETING: "Erro ao deletar",
  ERROR_NETWORK: "Erro de conexão",
  ERROR_PERMISSION: "Sem permissão",
  ERROR_NOT_FOUND: "Não encontrado",
  
  // Validação
  VALIDATION_REQUIRED: "Campo obrigatório",
  VALIDATION_INVALID_EMAIL: "Email inválido",
  VALIDATION_INVALID_PHONE: "Telefone inválido",
  VALIDATION_INVALID_CPF: "CPF inválido",
  VALIDATION_PASSWORD_WEAK: "Senha muito fraca",
  
  // Confirmação
  CONFIRM_DELETE: "Tem certeza que deseja deletar?",
  CONFIRM_LOGOUT: "Deseja realmente sair?",
} as const;

// ============================================
// REGEX PATTERNS
// ============================================

export const PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^(\d{2})\s(\d{4,5})-(\d{4})$/,
  CPF: /^\d{3}\.\d{3}\.\d{3}-\d{2}$/,
  CEP: /^\d{5}-\d{3}$/,
  UUID: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
  URL: /^https?:\/\/.+/,
  NUMERIC: /^\d+$/,
  ALPHANUMERIC: /^[a-zA-Z0-9]+$/,
} as const;

// ============================================
// API ENDPOINTS
// ============================================

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: "/auth/login",
    LOGOUT: "/auth/logout",
    REFRESH: "/auth/refresh",
    RESET_PASSWORD: "/auth/reset-password",
  },
  PATIENTS: {
    LIST: "/patients",
    GET: "/patients/:id",
    CREATE: "/patients",
    UPDATE: "/patients/:id",
    DELETE: "/patients/:id",
  },
  APPOINTMENTS: {
    LIST: "/appointments",
    GET: "/appointments/:id",
    CREATE: "/appointments",
    UPDATE: "/appointments/:id",
    DELETE: "/appointments/:id",
  },
  RESULTS: {
    LIST: "/results",
    GET: "/results/:id",
    RELEASE: "/results/:id/release",
  },
} as const;

// ============================================
// EVENTOS E HOOKS
// ============================================

export const EVENTS = {
  PATIENT_CREATED: "patient.created",
  PATIENT_UPDATED: "patient.updated",
  PATIENT_DELETED: "patient.deleted",
  APPOINTMENT_CREATED: "appointment.created",
  APPOINTMENT_UPDATED: "appointment.updated",
  RESULT_RELEASED: "result.released",
  PAYMENT_REGISTERED: "payment.registered",
} as const;

// ============================================
// HELPERS
// ============================================

export function getPermissionLabel(permission: string): string {
  const entries = Object.entries(PERMISSIONS);
  const match = entries.find(([_, v]) => v === permission);
  return match ? match[0].replace(/_/g, " ").toLowerCase() : permission;
}

export function getRoleLabel(role: string): string {
  const entries = Object.entries(ROLES);
  const match = entries.find(([_, v]) => v === role);
  return match ? match[0].replace(/_/g, " ").toLowerCase() : role;
}

export function getStatusLabel(status: string): string {
  const allStatuses = { ...STATUSES, ...APPOINTMENT_STATUSES, ...RESULT_STATUSES };
  const entries = Object.entries(allStatuses);
  const match = entries.find(([_, v]) => v === status);
  return match ? match[0].replace(/_/g, " ").toLowerCase() : status;
}
