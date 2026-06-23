// ============================================================================
// src/middleware/security.middleware.ts - API Security Middleware
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  addSecurityHeaders,
  setCORSHeaders,
  validateCORS,
  checkRateLimit,
  validateCSRFToken,
  getClientIP,
} from '@/lib/security-middleware';

// ============================================================================
// MIDDLEWARE PRINCIPAL
// ============================================================================

export async function securityMiddleware(
  request: NextRequest,
  handler: (req: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  const ip = getClientIP(request);
  const origin = request.headers.get('origin');
  const method = request.method;

  // =========================================================================
  // 1. PREFLIGHT CORS
  // =========================================================================
  if (method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 });
    return setCORSHeaders(response, origin || '');
  }

  // =========================================================================
  // 2. VALIDAR CORS
  // =========================================================================
  if (origin && !validateCORS(origin)) {
    return new NextResponse(
      JSON.stringify({ error: 'CORS policy violation' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // =========================================================================
  // 3. RATE LIMITING
  // =========================================================================
  if (!checkRateLimit(ip, 100, 60 * 1000)) {
    const response = new NextResponse(
      JSON.stringify({ error: 'Rate limit exceeded. Max 100 requests per minute.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
    response.headers.set('Retry-After', '60');
    return response;
  }

  // =========================================================================
  // 4. VALIDAR CSRF PARA POST/PUT/DELETE
  // =========================================================================
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    const csrfToken = request.headers.get('x-csrf-token');
    
    // CSRF check opcional se header está presente
    if (csrfToken && !validateCSRFToken(csrfToken)) {
      return new NextResponse(
        JSON.stringify({ error: 'Invalid or expired CSRF token' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // =========================================================================
  // 5. EXECUTAR HANDLER
  // =========================================================================
  let response: NextResponse;
  try {
    response = await handler(request);
  } catch (error) {
    console.error('API error:', error);
    response = new NextResponse(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // =========================================================================
  // 6. ADICIONAR SECURITY HEADERS
  // =========================================================================
  response = addSecurityHeaders(response);

  // =========================================================================
  // 7. ADICIONAR CORS HEADERS
  // =========================================================================
  if (origin) {
    response = setCORSHeaders(response, origin);
  }

  // =========================================================================
  // 8. REMOVER SENSITIVE HEADERS
  // =========================================================================
  response.headers.delete('x-powered-by');
  response.headers.delete('server');

  return response;
}

// ============================================================================
// DECORATOR PARA USAR EM ROUTE HANDLERS
// ============================================================================

export function withSecurity(
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    return securityMiddleware(request, handler);
  };
}

// ============================================================================
// VALIDAÇÃO DE AUTHENTICATION HEADER
// ============================================================================

export function validateAuthHeader(request: NextRequest): { valid: boolean; token?: string; error?: string } {
  const authHeader = request.headers.get('authorization');

  if (!authHeader) {
    return { valid: false, error: 'Missing authorization header' };
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return { valid: false, error: 'Invalid authorization header format' };
  }

  const token = parts[1];
  if (!token) {
    return { valid: false, error: 'Missing token' };
  }

  return { valid: true, token };
}

// ============================================================================
// MIDDLEWARE PARA LOGGED-IN ROUTES
// ============================================================================

export function withAuth(
  handler: (req: NextRequest, token: string) => Promise<NextResponse>
) {
  return withSecurity(async (request: NextRequest) => {
    const auth = validateAuthHeader(request);
    
    if (!auth.valid) {
      return new NextResponse(
        JSON.stringify({ error: auth.error }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return handler(request, auth.token!);
  });
}

// ============================================================================
// MIDDLEWARE PARA ADMIN-ONLY ROUTES
// ============================================================================

export function withAdminAuth(
  handler: (req: NextRequest, token: string, userId: string) => Promise<NextResponse>,
  supabase: any
) {
  return withAuth(async (request: NextRequest, token: string) => {
    try {
      const { data } = await supabase.auth.getUser(token);
      
      if (!data.user) {
        return new NextResponse(
          JSON.stringify({ error: 'User not found' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Verificar se é admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
        return new NextResponse(
          JSON.stringify({ error: 'Insufficient permissions' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return handler(request, token, data.user.id);
    } catch (error) {
      console.error('Auth validation failed:', error);
      return new NextResponse(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
  });
}
