/**
 * Sistema centralizado de erro handling
 * Diferencia tipos de erro para melhor UX e debugging
 */

// ============================================
// TIPOS DE ERRO DEFINIDOS
// ============================================

export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public userMessage: string,
    public statusCode: number = 500,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(
    public field: string,
    message: string,
    userMessage?: string
  ) {
    super(
      "VALIDATION_ERROR",
      `Validação falhou no campo '${field}': ${message}`,
      userMessage || `${field} é inválido`,
      400,
      { field }
    );
    this.name = "ValidationError";
  }
}

export class PermissionError extends AppError {
  constructor(message?: string, userMessage?: string) {
    super(
      "PERMISSION_ERROR",
      message || "Permissão negada",
      userMessage || "Você não tem permissão para realizar esta ação",
      403
    );
    this.name = "PermissionError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(
      "NOT_FOUND",
      `${resource} não encontrado`,
      `${resource} não encontrado ou já foi deletado`,
      404,
      { resource }
    );
    this.name = "NotFoundError";
  }
}

export class NetworkError extends AppError {
  constructor(message?: string) {
    super(
      "NETWORK_ERROR",
      message || "Erro de conexão",
      "Sem conexão com servidor - tente novamente",
      503
    );
    this.name = "NetworkError";
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, originalError?: Error) {
    super(
      "DATABASE_ERROR",
      message,
      "Erro ao acessar banco de dados - tente novamente",
      500,
      { originalError: originalError?.message }
    );
    this.name = "DatabaseError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string, userMessage?: string) {
    super(
      "CONFLICT_ERROR",
      message,
      userMessage || "Dados em conflito - tente novamente",
      409
    );
    this.name = "ConflictError";
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter?: number) {
    super(
      "RATE_LIMIT",
      "Rate limit atingido",
      `Muitas requisições - aguarde ${retryAfter || 60} segundos`,
      429,
      { retryAfter }
    );
    this.name = "RateLimitError";
  }
}

// ============================================
// CLASSIFICADOR DE ERROS
// ============================================

export function classifyError(error: unknown): AppError {
  // ✅ Já é AppError
  if (error instanceof AppError) {
    return error;
  }
  
  // ✅ Erro de validação (Zod)
  if (error instanceof Error && error.message.includes("validation")) {
    return new ValidationError(
      "input",
      error.message,
      "Dados inválidos fornecidos"
    );
  }
  
  // ✅ Erro de rede
  if (error instanceof TypeError && error.message.includes("fetch")) {
    return new NetworkError(error.message);
  }
  
  // ✅ Erro 404
  if (error instanceof Error && error.message.includes("not found")) {
    return new NotFoundError("Item");
  }
  
  // ✅ Erro de permissão
  if (error instanceof Error && error.message.includes("permission")) {
    return new PermissionError(error.message);
  }
  
  // ✅ Erro do Supabase
  if (error instanceof Error && error.message.includes("Supabase")) {
    return new DatabaseError(error.message, error);
  }
  
  // ❓ Erro desconhecido
  if (error instanceof Error) {
    return new AppError(
      "UNKNOWN_ERROR",
      error.message,
      "Erro inesperado - suporte já foi notificado",
      500,
      { originalError: error.message, stack: error.stack }
    );
  }
  
  // ❓ Não é nem Error
  return new AppError(
    "UNKNOWN_ERROR",
    String(error),
    "Erro inesperado - suporte já foi notificado",
    500
  );
}

// ============================================
// HANDLERS DE ERRO
// ============================================

export function getErrorMessage(error: unknown): string {
  const appError = classifyError(error);
  return appError.userMessage;
}

export function getErrorDetails(error: unknown): AppError {
  return classifyError(error);
}

export function logError(error: unknown, context?: string): void {
  const appError = classifyError(error);
  
  // Sempre log em console em dev
  if (process.env.NODE_ENV === "development") {
    console.error(`[${appError.code}]${context ? ` [${context}]` : ""}:`, {
      message: appError.message,
      userMessage: appError.userMessage,
      statusCode: appError.statusCode,
      details: appError.details,
      stack: appError.stack,
    });
  }
  
  // Enviar para Sentry em produção (depois)
  if (appError.statusCode >= 500) {
    console.error(`[CRITICAL] Erro crítico detectado:`, appError.message);
  }
}

// ============================================
// ASYNC WRAPPER COM ERROR HANDLING
// ============================================

export function withErrorHandling<T, Args extends any[]>(
  fn: (...args: Args) => Promise<T>
): (...args: Args) => Promise<{ ok: boolean; data?: T; error?: AppError }> {
  return async (...args: Args) => {
    try {
      const data = await fn(...args);
      return { ok: true, data };
    } catch (error) {
      const appError = classifyError(error);
      logError(appError);
      return { ok: false, error: appError };
    }
  };
}

// ============================================
// VALIDAÇÃO COM ERRO CUSTOMIZADO
// ============================================

export function assertExists<T>(
  value: T | null | undefined,
  field: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new NotFoundError(field);
  }
}

export function assertPermission(
  condition: boolean,
  message?: string
): asserts condition {
  if (!condition) {
    throw new PermissionError(message);
  }
}

export function assertValidation(
  condition: boolean,
  field: string,
  message: string
): asserts condition {
  if (!condition) {
    throw new ValidationError(field, message);
  }
}
