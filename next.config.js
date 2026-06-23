// ============================================================================
// next.config.js - Configuração de Segurança
// ============================================================================

/** @type {import('next').NextConfig} */
const nextConfig = {
  // =========================================================================
  // SECURITY HEADERS
  // =========================================================================
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // HTTPS Strict Transport Security
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
              "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
              "img-src 'self' data: https:",
              "font-src 'self' data: https://fonts.googleapis.com https://fonts.gstatic.com",
              "connect-src 'self' https://supabase.co https://*.supabase.co https://api.supabase.co",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
          // Prevent MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Prevent clickjacking
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // Enable XSS protection
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // Referrer Policy
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Permissions Policy (formerly Feature Policy)
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(), microphone=(), camera=(), payment=()',
          },
          // Remove Server header
          {
            key: 'X-Powered-By',
            value: 'AppSISLAC',
          },
        ],
      },
    ];
  },

  // =========================================================================
  // REDIRECTS (HTTP → HTTPS)
  // =========================================================================
  async redirects() {
    return [
      {
        source: '/:path*',
        destination: 'https://:host/:path*',
        permanent: false,
        basePath: false,
      },
    ];
  },

  // =========================================================================
  // REWRITES (API Security)
  // =========================================================================
  async rewrites() {
    return {
      beforeFiles: [
        // Bloquear acesso direto a arquivos sensíveis
        {
          source: '/api/auth/:path*',
          destination: '/api/auth/:path*',
        },
      ],
    };
  },

  // =========================================================================
  // MIDDLEWARE
  // =========================================================================
  reactStrictMode: true,
  swcMinify: true,

  // =========================================================================
  // ENVIRONMENT VARIABLES
  // =========================================================================
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },

  // =========================================================================
  // IMAGE OPTIMIZATION
  // =========================================================================
  images: {
    domains: ['*.supabase.co', 'cdn.jsdelivr.net'],
    formats: ['image/avif', 'image/webp'],
  },

  // =========================================================================
  // COMPRESSION
  // =========================================================================
  compress: true,

  // =========================================================================
  // PRODUCTION ONLY SETTINGS
  // =========================================================================
  poweredByHeader: false,
  productionBrowserSourceMaps: false,

  // =========================================================================
  // EXPERIMENTAL FEATURES
  // =========================================================================
  experimental: {
    // Melhorar performance
    optimizePackageImports: [
      '@supabase/supabase-js',
      'zod',
    ],
  },
};

module.exports = nextConfig;
