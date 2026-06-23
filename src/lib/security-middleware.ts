// ============================================================================
// src/lib/security-middleware.ts - Security Middleware
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// ============================================================================
// RATE LIMITING - Memory cache para IPs
// ============================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitCache = new Map<string, RateLimitEntry>();
const LOGIN_ATTEMPT_LIMIT = 5;
const LOGIN_ATTEMPT_WINDOW = 15 * 60 * 1000; // 15 minutos
const API_RATE_LIMIT = 100;
const API_RATE_WINDOW = 60 * 1000; // 1 minuto

function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export function checkRateLimit(ip: string, limit: number, window: number): boolean {
  const now = Date.now();
  const entry = rateLimitCache.get(ip);

  if (!entry || entry.resetAt < now) {
    rateLimitCache.set(ip, { count: 1, resetAt: now + window });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count++;
  return true;
}

export function getRateLimitRemaining(ip: string, limit: number): number {
  const entry = rateLimitCache.get(ip);
  if (!entry || entry.resetAt < Date.now()) {
    return limit;
  }
  return Math.max(0, limit - entry.count);
}

// ============================================================================
// JWT TOKEN REFRESH
// ============================================================================

export interface TokenPayload {
  sub: string; // user id
  email: string;
  tenant_id: string;
  exp: number;
  iat: number;
}

export function isTokenExpiring(token: string, thresholdMs: number = 5 * 60 * 1000): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    const expiresAt = payload.exp * 1000;
    const now = Date.now();

    return expiresAt - now < thresholdMs;
  } catch {
    return false;
  }
}

export function getTokenExpiration(token: string): Date | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return new Date(payload.exp * 1000);
  } catch {
    return null;
  }
}

export async function refreshToken(supabase: ReturnType<typeof createClient>, refreshToken: string) {
  try {
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error) throw error;
    return data.session;
  } catch (error) {
    console.error('Token refresh failed:', error);
    return null;
  }
}

// ============================================================================
// CSRF PROTECTION
// ============================================================================

const csrfTokens = new Map<string, { token: string; expiresAt: number }>();

export function generateCSRFToken(): string {
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');
  const id = crypto.randomUUID();

  csrfTokens.set(id, {
    token,
    expiresAt: Date.now() + 60 * 60 * 1000, // 1 hora
  });

  // Limpar tokens expirados
  for (const [key, value] of csrfTokens.entries()) {
    if (value.expiresAt < Date.now()) {
      csrfTokens.delete(key);
    }
  }

  return token;
}

export function validateCSRFToken(token: string): boolean {
  for (const [, value] of csrfTokens.entries()) {
    if (value.token === token && value.expiresAt > Date.now()) {
      return true;
    }
  }
  return false;
}

// ============================================================================
// BRUTE FORCE PROTECTION
// ============================================================================

interface LoginAttempt {
  count: number;
  lastAttempt: number;
  locked: boolean;
  lockedUntil?: number;
}

const loginAttempts = new Map<string, LoginAttempt>();
const LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutos
const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW = 15 * 60 * 1000; // 15 minutos

export function recordLoginAttempt(email: string, ip: string, success: boolean): { allowed: boolean; reason?: string } {
  const key = `${email}:${ip}`;
  const now = Date.now();
  let attempt = loginAttempts.get(key);

  if (!attempt) {
    attempt = { count: 0, lastAttempt: now, locked: false };
  }

  // Verificar se está bloqueado
  if (attempt.locked && attempt.lockedUntil && attempt.lockedUntil > now) {
    return {
      allowed: false,
      reason: `Conta temporariamente bloqueada. Tente novamente em ${Math.ceil((attempt.lockedUntil - now) / 1000 / 60)} minutos.`,
    };
  }

  // Resetar se passou a janela
  if (attempt.lastAttempt + ATTEMPT_WINDOW < now) {
    attempt = { count: 0, lastAttempt: now, locked: false };
  }

  // Incrementar contador se falhou
  if (!success) {
    attempt.count++;
    attempt.lastAttempt = now;

    if (attempt.count >= MAX_ATTEMPTS) {
      attempt.locked = true;
      attempt.lockedUntil = now + LOCKOUT_DURATION;
      loginAttempts.set(key, attempt);

      return {
        allowed: false,
        reason: 'Muitas tentativas de login. Tente novamente em 30 minutos.',
      };
    }
  } else {
    // Reset no sucesso
    attempt.count = 0;
    attempt.locked = false;
  }

  loginAttempts.set(key, attempt);
  return { allowed: true };
}

// ============================================================================
// SECURITY HEADERS MIDDLEWARE
// ============================================================================

export function addSecurityHeaders(response: NextResponse): NextResponse {
  // HSTS - Force HTTPS
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );

  // Content Security Policy
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://supabase.co https://api.supabase.co;"
  );

  // X-Content-Type-Options
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // X-Frame-Options
  response.headers.set('X-Frame-Options', 'DENY');

  // X-XSS-Protection
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Referrer-Policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions-Policy
  response.headers.set(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=()'
  );

  return response;
}

// ============================================================================
// CORS CONFIGURATION
// ============================================================================

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://app.appsislac.com',
  'https://admin.appsislac.com',
  // Adicione mais conforme necessário
];

export function validateCORS(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes(origin);
}

export function setCORSHeaders(response: NextResponse, origin: string): NextResponse {
  if (validateCORS(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS'
    );
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization'
    );
    response.headers.set('Access-Control-Max-Age', '86400');
  }
  return response;
}

// ============================================================================
// INPUT SANITIZATION
// ============================================================================

export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/[`"']/g, ''); // Remove quotes
}

export function sanitizeJSON(obj: any): any {
  if (typeof obj === 'string') {
    return sanitizeInput(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeJSON);
  }
  if (typeof obj === 'object' && obj !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[sanitizeInput(key)] = sanitizeJSON(value);
    }
    return sanitized;
  }
  return obj;
}

// ============================================================================
// REQUEST VALIDATION MIDDLEWARE
// ============================================================================

export function validateRequest(request: NextRequest, requiredHeaders: string[] = []) {
  const ip = getClientIP(request);

  // Validar rate limit
  if (!checkRateLimit(ip, API_RATE_LIMIT, API_RATE_WINDOW)) {
    return {
      valid: false,
      error: 'Rate limit exceeded',
      status: 429,
    };
  }

  // Validar headers necessários
  for (const header of requiredHeaders) {
    if (!request.headers.has(header)) {
      return {
        valid: false,
        error: `Missing required header: ${header}`,
        status: 400,
      };
    }
  }

  return { valid: true };
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

export function validateSessionAge(createdAt: number, maxAge: number = 24 * 60 * 60 * 1000): boolean {
  const age = Date.now() - createdAt;
  return age < maxAge;
}

export function shouldRefreshToken(expiresAt: number, thresholdMs: number = 5 * 60 * 1000): boolean {
  const timeUntilExpiry = expiresAt - Date.now();
  return timeUntilExpiry < thresholdMs;
}
