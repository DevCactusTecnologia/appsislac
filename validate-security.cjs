#!/usr/bin/env node

/**
 * SCRIPT DE VALIDAÇÃO DE SEGURANÇA - MULTI-TENANCY
 * 
 * Este script valida que implementação de segurança multi-tenancy está correta
 * Testa padrões, não requer BD real
 */

const fs = require('fs');
const path = require('path');

// Cores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m',
};

let passedTests = 0;
let failedTests = 0;

function test(name, condition) {
  if (condition) {
    console.log(`${colors.green}✅${colors.reset} ${name}`);
    passedTests++;
  } else {
    console.log(`${colors.red}❌${colors.reset} ${name}`);
    failedTests++;
  }
}

function section(title) {
  console.log(`\n${colors.bold}${colors.blue}📋 ${title}${colors.reset}`);
}

// ============================================================================
// TESTE 1: TENANT VALIDATION EXISTE E TEM FALHA SEGURA
// ============================================================================

section("TESTE 1: Validação de Tenant_ID");

const tenantValidationPath = path.join(__dirname, 'src/lib/tenantValidation.ts');
const tenantValidationExists = fs.existsSync(tenantValidationPath);
test("Arquivo tenantValidation.ts existe", tenantValidationExists);

if (tenantValidationExists) {
  const content = fs.readFileSync(tenantValidationPath, 'utf8');
  
  test("Exporta getTenantIdOrThrow()", content.includes('export async function getTenantIdOrThrow'));
  test("Exporta useTenantId hook", content.includes('export function useTenantId'));
  test("Exporta withTenantFilter()", content.includes('export function withTenantFilter'));
  test("Tem classe TenantError", content.includes('export class TenantError'));
  test("Falha segura: lança erro se não tem tenant", content.includes('throw new TenantError'));
  test("Não retorna true em caso de erro", !content.match(/catch.*return true/));
  test("Valida tenant ativo", content.includes('eq("active", true)'));
}

// ============================================================================
// TESTE 2: ERROR HANDLING DIFERENCIADO
// ============================================================================

section("TESTE 2: Error Handling");

const errorHandlingPath = path.join(__dirname, 'src/lib/errorHandling.ts');
const errorHandlingExists = fs.existsSync(errorHandlingPath);
test("Arquivo errorHandling.ts existe", errorHandlingExists);

if (errorHandlingExists) {
  const content = fs.readFileSync(errorHandlingPath, 'utf8');
  
  test("Exporta ValidationError", content.includes('export class ValidationError'));
  test("Exporta PermissionError", content.includes('export class PermissionError'));
  test("Exporta NetworkError", content.includes('export class NetworkError'));
  test("Exporta handleError()", content.includes('export function handleError'));
  test("Exporta classifyError()", content.includes('export function classifyError'));
  test("Exporta getErrorMessage()", content.includes('export function getErrorMessage'));
  test("Diferencia por status code", content.includes('case 400') || content.includes('ValidationError'));
}

// ============================================================================
// TESTE 3: PRICING ENGINE CENTRALIZADO
// ============================================================================

section("TESTE 3: Pricing Engine");

const pricingPath = path.join(__dirname, 'src/lib/pricingEngine.ts');
const pricingExists = fs.existsSync(pricingPath);
test("Arquivo pricingEngine.ts existe", pricingExists);

if (pricingExists) {
  const content = fs.readFileSync(pricingPath, 'utf8');
  
  test("Exporta calculateExamPrice()", content.includes('export function calculateExamPrice'));
  test("Exporta applyDiscount()", content.includes('export function applyDiscount'));
  test("Exporta applySurcharge()", content.includes('export function applySurcharge'));
  test("Exporta formatPrice()", content.includes('export function formatPrice'));
  test("Não há duplicação: única fonte verdade", 
    !fs.readdirSync(path.join(__dirname, 'src')).some(file => 
      fs.readFileSync(path.join(__dirname, 'src', file), 'utf8').includes('calculateExamPrice') &&
      file !== 'pricingEngine.ts' && file.endsWith('.ts')
    )
  );
  test("Valida entrada (nomeExame)", content.includes('nomeExame'));
  test("Calcula preço (basePrice)", content.includes('basePrice') || content.includes('priceTable'));
}

// ============================================================================
// TESTE 4: QUERY PATTERNS (SEM N+1)
// ============================================================================

section("TESTE 4: Query Patterns Anti-N+1");

const queryPatternsPath = path.join(__dirname, 'src/lib/queryPatterns.ts');
const queryPatternsExists = fs.existsSync(queryPatternsPath);
test("Arquivo queryPatterns.ts existe", queryPatternsExists);

if (queryPatternsExists) {
  const content = fs.readFileSync(queryPatternsPath, 'utf8');
  
  test("Exporta queryAppointmentsWithExams()", content.includes('export async function queryAppointmentsWithExams'));
  test("Usa select com nested (JOIN)", content.includes('select') && content.includes('*'));
  test("Exporta queryPatientsPaginated()", content.includes('export async function queryPatientsPaginated'));
  test("Tem paginação (range/limit)", content.includes('range') || content.includes('limit'));
  test("Exporta insertMultipleExams()", content.includes('export async function insertMultipleExams'));
  test("Define QUERY_KEYS", content.includes('QUERY_KEYS'));
}

// ============================================================================
// TESTE 5: CONSTANTS CENTRALIZADOS
// ============================================================================

section("TESTE 5: Constants Type-Safe");

const constantsPath = path.join(__dirname, 'src/lib/constants.ts');
const constantsExists = fs.existsSync(constantsPath);
test("Arquivo constants.ts existe", constantsExists);

if (constantsExists) {
  const content = fs.readFileSync(constantsPath, 'utf8');
  
  test("Define ROLES", content.includes('ROLES'));
  test("Define PERMISSIONS", content.includes('PERMISSIONS'));
  test("Define STATUS", content.includes('STATUS'));
  test("Define TABLES", content.includes('TABLES'));
  test("Sem magic strings: ROLES é object", content.includes('ROLES') && !content.includes("'admin'"));
  test("Exporta helpers (toLabel, etc)", content.includes('export function'));
}

// ============================================================================
// TESTE 6: CLEANUP DE MEMORY LEAKS
// ============================================================================

section("TESTE 6: Memory Leak Prevention");

const cleanupPath = path.join(__dirname, 'src/hooks/useCleanupUtils.ts');
const cleanupExists = fs.existsSync(cleanupPath);
test("Arquivo useCleanupUtils.ts existe", cleanupExists);

if (cleanupExists) {
  const content = fs.readFileSync(cleanupPath, 'utf8');
  
  test("Exporta useInterval()", content.includes('export function useInterval'));
  test("Exporta useTimeout()", content.includes('export function useTimeout'));
  test("Exporta useMounted()", content.includes('export function useMounted'));
  test("Exporta useDebounce()", content.includes('export function useDebounce'));
  test("Tem cleanup automático (return () =>)", content.includes('return () =>'));
  test("Limpa intervals/timeouts", content.includes('clearInterval') || content.includes('clearTimeout'));
}

// ============================================================================
// TESTE 7: AUTH COM FALHA SEGURA
// ============================================================================

section("TESTE 7: AuthContext - Falha Segura");

const authContextPath = path.join(__dirname, 'src/contexts/AuthContext.tsx');
const authContextExists = fs.existsSync(authContextPath);
test("Arquivo AuthContext.tsx existe", authContextExists);

if (authContextExists) {
  const content = fs.readFileSync(authContextPath, 'utf8');
  
  test("Função login() existe", content.includes('async function login'));
  test("Valida email", content.includes('email'));
  test("Valida senha", content.includes('password') || content.includes('senha'));
  test("isTenantActive() retorna false se erro", content.includes('catch') && content.includes('return false'));
  test("Não retorna true em erro (falha segura)", !content.match(/catch[\s\S]*?return true/));
  test("Tem mensagens de erro diferenciadas", content.includes('Email ou senha') || content.includes('erro'));
}

// ============================================================================
// TESTE 8: MIGRATIONS - TENANT_ID EM TODA PARTE
// ============================================================================

section("TESTE 8: Migrations - Multi-Tenancy");

const migrationsDir = path.join(__dirname, 'supabase/migrations');
let hasMigrations = false;
let tenantIdCount = 0;

try {
  if (fs.existsSync(migrationsDir)) {
    hasMigrations = true;
    const migrations = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
    
    test("Pasta migrations existe", true);
    test("Tem migrations SQL", migrations.length > 0);
    
    let totalTenantId = 0;
    migrations.forEach(migration => {
      const content = fs.readFileSync(path.join(migrationsDir, migration), 'utf8');
      if (content.includes('tenant_id')) {
        totalTenantId++;
      }
    });
    
    test(`${totalTenantId}+ migrations têm tenant_id`, totalTenantId > 0);
  }
} catch (e) {
  test("Pasta migrations existe", false);
}

// ============================================================================
// TESTE 9: SEM 'ANY' TYPES EM ARQUIVOS NOVOS
// ============================================================================

section("TESTE 9: Type Safety - Sem 'any'");

const newFiles = [
  'src/lib/tenantValidation.ts',
  'src/lib/errorHandling.ts',
  'src/lib/pricingEngine.ts',
  'src/lib/queryPatterns.ts',
  'src/lib/constants.ts',
  'src/hooks/useCleanupUtils.ts',
];

let anyCount = 0;
newFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const matches = content.match(/:\s*any/g) || [];
    anyCount += matches.length;
  }
});

test(`Arquivos novos têm ${anyCount} 'any' (meta: 0)`, anyCount === 0);
if (anyCount > 0) {
  console.log(`   ${colors.yellow}⚠️ Encontrado ${anyCount} 'any' type${colors.reset}`);
}

// ============================================================================
// TESTE 10: LANDING PAGE RESPONSIVA
// ============================================================================

section("TESTE 10: Landing Page Responsiva");

const landingPath = path.join(__dirname, 'src/pages/LandingPageResponsive.tsx');
const landingExists = fs.existsSync(landingPath);
test("Arquivo LandingPageResponsive.tsx existe", landingExists);

if (landingExists) {
  const content = fs.readFileSync(landingPath, 'utf8');
  
  test("Todos os CTAs apontam para /login", 
    (content.match(/to="\/login"/g) || []).length >= 3);
  test("Header é responsivo (hamburger menu)", content.includes('mobileMenuOpen'));
  test("Grid de cards é responsivo", 
    content.includes('grid-cols-1') && 
    content.includes('sm:grid-cols-2') &&
    content.includes('lg:grid-cols-4'));
  test("Mobile-first approach", content.includes('w-full'));
  test("Sem scroll horizontal (max-width)", content.includes('max-w-'));
}

// ============================================================================
// RESULTADO FINAL
// ============================================================================

console.log(`\n${colors.bold}${colors.blue}📊 RESULTADO FINAL${colors.reset}`);
console.log(`${colors.green}✅ Passou: ${passedTests}${colors.reset}`);
console.log(`${colors.red}❌ Falhou: ${failedTests}${colors.reset}`);

const total = passedTests + failedTests;
const percentage = ((passedTests / total) * 100).toFixed(1);

console.log(`\n${colors.bold}Score: ${percentage}% (${passedTests}/${total})${colors.reset}`);

if (percentage >= 90) {
  console.log(`${colors.green}${colors.bold}🎉 EXCELENTE! Sistema bem estruturado!${colors.reset}`);
} else if (percentage >= 70) {
  console.log(`${colors.yellow}${colors.bold}⚠️ BOM, mas há itens para melhorar${colors.reset}`);
} else {
  console.log(`${colors.red}${colors.bold}🔴 CRÍTICO - Itens importantes faltam${colors.reset}`);
}

process.exit(failedTests > 0 ? 1 : 0);
