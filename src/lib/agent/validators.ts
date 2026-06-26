// src/lib/agent/validators.ts

const BLOCKED_KEYWORDS = [
  'codigo',
  'fonte',
  'senha',
  'token',
  'chave',
  'api_key',
  'secret',
  'admin',
  'delete from',
  'drop',
  'truncate',
];

const DANGEROUS_SQL = ['DELETE', 'DROP', 'INSERT', 'UPDATE', 'TRUNCATE', 'ALTER'];

export class AgentValidators {
  static validatePrompt(prompt: string): { valid: boolean; reason?: string } {
    const lower = prompt.toLowerCase();
    
    for (const keyword of BLOCKED_KEYWORDS) {
      if (lower.includes(keyword)) {
        return { 
          valid: false, 
          reason: `Pergunta contém termo não permitido: "${keyword}"` 
        };
      }
    }
    
    if (prompt.length < 3) {
      return { valid: false, reason: 'Pergunta muito curta' };
    }
    
    if (prompt.length > 500) {
      return { valid: false, reason: 'Pergunta muito longa (máx 500 caracteres)' };
    }
    
    return { valid: true };
  }

  static validateSQL(sql: string): { valid: boolean; reason?: string } {
    const upper = sql.toUpperCase().trim();
    
    if (!upper.startsWith('SELECT')) {
      return { valid: false, reason: 'Apenas consultas (SELECT) permitidas' };
    }
    
    for (const dangerous of DANGEROUS_SQL) {
      if (upper.includes(dangerous)) {
        return { valid: false, reason: `SQL contém operação não permitida: ${dangerous}` };
      }
    }
    
    if (!upper.includes('WHERE')) {
      return { valid: false, reason: 'SQL deve ter cláusula WHERE' };
    }
    
    return { valid: true };
  }

  static validateUserPermission(
    userRole: string,
    action: string
  ): { allowed: boolean; reason?: string } {
    const permissions: Record<string, string[]> = {
      'admin': ['read', 'write', 'delete', 'print', 'report'],
      'operador': ['read', 'write', 'print', 'report'],
      'leitor': ['read', 'print', 'report'],
    };
    
    const allowed = permissions[userRole]?.includes(action);
    
    return {
      allowed: !!allowed,
      reason: !allowed ? `Seu role (${userRole}) não pode executar: ${action}` : undefined,
    };
  }
}
