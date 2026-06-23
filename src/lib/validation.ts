// ============================================================================
// src/lib/validation.ts - Input Validation Schemas com ZOD
// ============================================================================

import { z } from 'zod';

// ============================================================================
// SCHEMAS BÁSICOS
// ============================================================================

export const UUIDSchema = z.string().uuid('UUID inválido');
export const EmailSchema = z.string().email('Email inválido');
export const PasswordSchema = z
  .string()
  .min(12, 'Senha deve ter mínimo 12 caracteres')
  .regex(/[A-Z]/, 'Senha deve ter letra maiúscula')
  .regex(/[a-z]/, 'Senha deve ter letra minúscula')
  .regex(/[0-9]/, 'Senha deve ter número')
  .regex(/[!@#$%^&*]/, 'Senha deve ter caractere especial (!@#$%^&*)');

export const CPFSchema = z
  .string()
  .regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 'CPF inválido');

export const PhoneSchema = z
  .string()
  .regex(/^(\d{2})\s?9?\d{4}-?\d{4}$/, 'Telefone inválido');

export const CepSchema = z
  .string()
  .regex(/^\d{5}-?\d{3}$/, 'CEP inválido');

// ============================================================================
// SCHEMAS DE AUTENTICAÇÃO
// ============================================================================

export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'Senha obrigatória'),
  tenantId: UUIDSchema.optional(),
});

export const RegisterSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  name: z.string().min(3, 'Nome deve ter mínimo 3 caracteres').max(255),
  tenantId: UUIDSchema,
});

export const ResetPasswordSchema = z.object({
  email: EmailSchema,
  newPassword: PasswordSchema,
  token: z.string().min(32, 'Token inválido'),
});

// ============================================================================
// SCHEMAS DE PACIENTES
// ============================================================================

export const PacienteCreateSchema = z.object({
  nome: z
    .string()
    .min(3, 'Nome deve ter mínimo 3 caracteres')
    .max(255, 'Nome deve ter máximo 255 caracteres')
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/, 'Nome contém caracteres inválidos'),
  email: EmailSchema.optional(),
  cpf: CPFSchema.optional(),
  telefone: PhoneSchema.optional(),
  celular: PhoneSchema.optional(),
  dataNascimento: z.string().datetime().optional(),
  sexo: z.enum(['M', 'F', 'O']).optional(),
  cep: CepSchema.optional(),
  estado: z.string().length(2, 'Estado deve ter 2 caracteres'),
  cidade: z.string().min(2).max(255),
  bairro: z.string().min(2).max(255).optional(),
  endereco: z.string().min(3).max(255).optional(),
  numero: z.string().min(1).max(10).optional(),
  complemento: z.string().max(255).optional(),
  tenantId: UUIDSchema,
});

export const PacienteUpdateSchema = PacienteCreateSchema.partial();

// ============================================================================
// SCHEMAS DE ATENDIMENTOS
// ============================================================================

export const AtendimentoCreateSchema = z.object({
  pacienteId: z.number().int().positive(),
  unidadeId: z.number().int().positive(),
  especiaistaId: z.number().int().positive().optional(),
  descricao: z
    .string()
    .min(10, 'Descrição deve ter mínimo 10 caracteres')
    .max(2000, 'Descrição deve ter máximo 2000 caracteres'),
  tipo: z.enum(['CONSULTA', 'EXAME', 'PROCEDIMENTO']),
  dataAtendimento: z.string().datetime(),
  statusPagamento: z.enum(['PENDENTE', 'PAGO', 'CANCELADO']).default('PENDENTE'),
  observacoes: z.string().max(2000).optional(),
  tenantId: UUIDSchema,
});

export const AtendimentoUpdateSchema = AtendimentoCreateSchema.partial();

// ============================================================================
// SCHEMAS DE FATURAMENTO
// ============================================================================

export const FaturaCreateSchema = z.object({
  atendimentoId: z.number().int().positive(),
  valor: z
    .number()
    .positive('Valor deve ser positivo')
    .max(999999.99, 'Valor máximo é 999.999,99'),
  descricao: z.string().min(3).max(500),
  dataVencimento: z.string().datetime(),
  convenioId: z.number().int().positive().optional(),
  observacoes: z.string().max(2000).optional(),
  tenantId: UUIDSchema,
});

export const FaturaUpdateSchema = FaturaCreateSchema.partial();

// ============================================================================
// SCHEMAS DE ORÇAMENTO
// ============================================================================

export const OrcamentoCreateSchema = z.object({
  pacienteId: z.number().int().positive(),
  descricao: z.string().min(10).max(2000),
  valor: z.number().positive('Valor deve ser positivo'),
  dataValidade: z.string().datetime(),
  itens: z
    .array(
      z.object({
        descricao: z.string().min(3).max(255),
        valor: z.number().positive(),
        quantidade: z.number().int().positive().default(1),
      })
    )
    .min(1, 'Mínimo 1 item'),
  tenantId: UUIDSchema,
});

// ============================================================================
// SCHEMAS DE CONFIGURAÇÃO
// ============================================================================

export const UnidadeCreateSchema = z.object({
  nome: z.string().min(3).max(255),
  endereco: z.string().min(5).max(255),
  numero: z.string().min(1).max(10),
  complemento: z.string().max(255).optional(),
  bairro: z.string().min(2).max(100),
  cidade: z.string().min(2).max(100),
  estado: z.string().length(2),
  cep: CepSchema,
  telefone: PhoneSchema.optional(),
  email: EmailSchema.optional(),
  responsavel: z.string().min(3).max(255).optional(),
  status: z.enum(['ATIVA', 'INATIVA']).default('ATIVA'),
  tenantId: UUIDSchema,
});

// ============================================================================
// HELPER: Validar e sanitizar
// ============================================================================

export function validateAndSanitize<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

export function tryValidate<T>(schema: z.ZodSchema<T>, data: unknown): { success: boolean; data?: T; errors?: z.ZodError } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error };
    }
    throw error;
  }
}

export function getValidationErrors(error: z.ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  error.issues.forEach((issue) => {
    const path = issue.path.join('.');
    if (!errors[path]) {
      errors[path] = [];
    }
    errors[path].push(issue.message);
  });
  return errors;
}
