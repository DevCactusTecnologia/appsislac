/**
 * ERRO HANDLING CENTRALIZADO
 * 
 * Diferencia entre tipos de erro e fornece mensagens apropriadas ao usuário
 */

/**
 * Tipos de erro customizados
 */
export class ValidationError extends Error {
  constructor(
    public field: string,
    message: string
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export class PermissionError extends Error {
  constructor(message: string = "Você não tem permissão para realizar esta ação") {
    super(message);
    this.name = "PermissionError";
  }
}

export class NetworkError extends Error {
  constructor(message: string = "Erro de conexão - verifique sua internet") {
    super(message);
    this.name = "NetworkError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string = "Recurso não encontrado") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  constructor(message: string = "Conflito ao salvar dados - tente novamente") {
    super(message);
    this.name = "ConflictError";
  }
}

export class UnexpectedError extends Error {
  constructor(
    message: string = "Erro inesperado - suporte foi notificado",
    public originalError?: Error
  ) {
    super(message);
    this.name = "UnexpectedError";
  }
}

/**
 * Classificador de erro - converte erros brutos em tipos específicos
 */
export function classifyError(error: any): Error {
  // Erro customizado já classificado
  if (
    error instanceof ValidationError ||
    error instanceof PermissionError ||
    error instanceof NetworkError ||
    error instanceof NotFoundError ||
    error instanceof ConflictError ||
    error instanceof UnexpectedError
  ) {
    return error;
  }

  // Erro do Supabase
  if (error?.status === 400) {
    const message = error?.message || "Dados inválidos";
    return new ValidationError("unknown", message);
  }

  if (error?.status === 401 || error?.status === 403) {
    return new PermissionError(error?.message);
  }

  if (error?.status === 404) {
    return new NotFoundError(error?.message);
  }

  if (error?.status === 409) {
    return new ConflictError(error?.message);
  }

  // Erro de rede
  if (
    error?.message?.includes("NetworkError") ||
    error?.message?.includes("Failed to fetch") ||
    error?.message?.includes("network")
  ) {
    return new NetworkError(error?.message);
  }

  // Erro desconhecido
  console.error("❌ Erro não classificado:", error);
  return new UnexpectedError("Erro inesperado", error);
}

/**
 * Handler de erro centralizado
 * USE SEMPRE: handleError(error, 'contexto da operação')
 */
export function handleError(
  error: any,
  context: string
): { message: string; type: string } {
  const classified = classifyError(error);

  // Log apropriado
  if (classified instanceof UnexpectedError) {
    console.error(`❌ [${context}] Erro inesperado:`, classified.originalError);
    // Enviar para Sentry/monitoring quando implementado
  } else {
    console.warn(`⚠️  [${context}] ${classified.name}:`, classified.message);
  }

  // Mensagem amigável ao usuário
  let userMessage = classified.message;

  if (classified instanceof ValidationError) {
    userMessage = `Campo ${classified.field}: ${classified.message}`;
  } else if (classified instanceof PermissionError) {
    userMessage = "Você não tem permissão para realizar esta ação";
  } else if (classified instanceof NetworkError) {
    userMessage = "Problema de conexão - verifique sua internet e tente novamente";
  } else if (classified instanceof NotFoundError) {
    userMessage = "Recurso não encontrado ou foi deletado";
  } else if (classified instanceof ConflictError) {
    userMessage = "Conflito ao salvar - os dados podem ter sido alterados por outro usuário";
  }

  return {
    message: userMessage,
    type: classified.name,
  };
}

/**
 * Wrapper para try-catch automático em funções assíncronas
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context: string
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      const handled = handleError(error, context);
      throw new UnexpectedError(handled.message, error as Error);
    }
  }) as T;
}

/**
 * Converter erro para mensagem amigável
 */
export function getErrorMessage(error: any): string {
  const handled = handleError(error, "unknown");
  return handled.message;
}

/**
 * Type guard para checar tipo de erro
 */
export function isValidationError(error: any): error is ValidationError {
  return error instanceof ValidationError;
}

export function isPermissionError(error: any): error is PermissionError {
  return error instanceof PermissionError;
}

export function isNetworkError(error: any): error is NetworkError {
  return error instanceof NetworkError;
}
