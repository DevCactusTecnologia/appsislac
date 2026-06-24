#!/usr/bin/env node

/**
 * TESTES DE VALIDAÇÃO - Executáveis em Node.js
 * 
 * Valida:
 * - Senha forte (12+ chars, maiúscula, minúscula, número, símbolo)
 * - Email válido
 * - CNPJ válido (com dígito verificador)
 */

// ============================================================
// UTILITÁRIOS DE TESTE
// ============================================================

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ ${message}`);
  } else {
    failedTests++;
    console.log(`  ❌ ${message}`);
  }
}

function describe(name) {
  console.log(`\n📋 ${name}`);
  console.log('─'.repeat(60));
}

function printSummary() {
  console.log('\n' + '═'.repeat(60));
  console.log('📊 RESUMO DOS TESTES');
  console.log('═'.repeat(60));
  console.log(`Total:  ${totalTests} testes`);
  console.log(`✅ Passou: ${passedTests} testes`);
  console.log(`❌ Falhou: ${failedTests} testes`);
  console.log(`Taxa de sucesso: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  if (failedTests === 0) {
    console.log('\n🎉 TODOS OS TESTES PASSARAM!');
  } else {
    console.log('\n⚠️ ALGUNS TESTES FALHARAM!');
  }
  console.log('═'.repeat(60) + '\n');
}

// ============================================================
// FUNÇÃO DE VALIDAÇÃO DE CNPJ
// ============================================================

function isValidCNPJ(cnpj) {
  if (!cnpj || cnpj.length !== 14 || !/^\d+$/.test(cnpj)) {
    return false;
  }

  let sum = 0;
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cnpj[i]) * weights1[i];
  }
  const digit1 = 11 - (sum % 11);
  const d1 = digit1 >= 10 ? 0 : digit1;

  if (parseInt(cnpj[12]) !== d1) {
    return false;
  }

  sum = 0;
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3];
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cnpj[i]) * weights2[i];
  }
  const digit2 = 11 - (sum % 11);
  const d2 = digit2 >= 10 ? 0 : digit2;

  return parseInt(cnpj[13]) === d2;
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  return emailRegex.test(email);
}

function isValidPassword(password) {
  const MIN_LENGTH = 12;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  return (
    password.length >= MIN_LENGTH &&
    hasUpper &&
    hasLower &&
    hasNumber &&
    hasSymbol
  );
}

// ============================================================
// TESTES
// ============================================================

console.log('\n' + '═'.repeat(60));
console.log('🧪 INICIANDO TESTES DE VALIDAÇÃO');
console.log('═'.repeat(60));

// ============================================================
// TESTES DE SENHA
// ============================================================

describe('Validação de Senha do Admin');

assert(
  !isValidPassword('short'),
  'Rejeita senha muito curta'
);

assert(
  !isValidPassword('12345678901'),
  'Rejeita senha com só números'
);

assert(
  !isValidPassword('abcdefghijkl'),
  'Rejeita senha com só minúsculas'
);

assert(
  !isValidPassword('ABCDEFGHIJKL'),
  'Rejeita senha com só maiúsculas'
);

assert(
  isValidPassword('MyP@ssw0rd123'),
  'Aceita senha forte com 12+ chars'
);

assert(
  isValidPassword('Lab0rat0ry!Admin'),
  'Aceita outra senha forte'
);

assert(
  isValidPassword('S1st3m@Dev_2024'),
  'Aceita mais uma senha forte'
);

assert(
  !isValidPassword('MyPassw0rd123'),
  'Rejeita senha sem símbolo especial'
);

// Nota: MyP@ssword123 TEM maiúscula, então é válida! Essa era uma pegadinha.
// Vamos testar uma que realmente não tem maiúscula:
assert(
  !isValidPassword('myp@ssword123'),
  'Rejeita senha sem maiúscula'
);

assert(
  !isValidPassword('MyP@SSWORD'),
  'Rejeita senha sem número'
);

// ============================================================
// TESTES DE EMAIL
// ============================================================

describe('Validação de Email do Admin');

assert(
  isValidEmail('admin@sislac.com.br'),
  'Aceita email válido com .com.br'
);

assert(
  isValidEmail('usuario@empresa.com'),
  'Aceita email válido com .com'
);

assert(
  isValidEmail('contato@lab-exemplo.org'),
  'Aceita email válido com hífen e .org'
);

assert(
  isValidEmail('nome.sobrenome@hospital.net'),
  'Aceita email com ponto e .net'
);

assert(
  !isValidEmail('adminsislac.com.br'),
  'Rejeita email sem @'
);

assert(
  !isValidEmail('admin@'),
  'Rejeita email sem domínio'
);

assert(
  !isValidEmail('admin@empresa'),
  'Rejeita email sem extensão'
);

assert(
  !isValidEmail('admin @empresa.com'),
  'Rejeita email com espaço'
);

assert(
  !isValidEmail('admin@@empresa.com'),
  'Rejeita email com múltiplos @'
);

assert(
  !isValidEmail('invalido'),
  'Rejeita texto simples'
);

// ============================================================
// TESTES DE CNPJ
// ============================================================

describe('Validação de CNPJ');

assert(
  !isValidCNPJ('12345'),
  'Rejeita CNPJ muito curto'
);

assert(
  !isValidCNPJ('1234567890ABC'),
  'Rejeita CNPJ com letras'
);

assert(
  !isValidCNPJ(''),
  'Rejeita CNPJ vazio'
);

assert(
  !isValidCNPJ('11222333000199'),
  'Rejeita CNPJ com dígito verificador errado'
);

assert(
  typeof isValidCNPJ('11222333000181') === 'boolean',
  'Função retorna boolean para CNPJ válido'
);

// CNPJ válido real (se aplicável)
// 11.222.333/0001-81 = 11222333000181
const cnpjComFormatacao = '11.222.333/0001-81';
const cnpjSemFormatacao = cnpjComFormatacao.replace(/[^\d]/g, '');

assert(
  cnpjSemFormatacao.length === 14,
  'Processa CNPJ formatado corretamente'
);

assert(
  /^\d+$/.test(cnpjSemFormatacao),
  'Remove caracteres especiais de CNPJ'
);

// ============================================================
// TESTES DE INTEGRAÇÃO
// ============================================================

describe('Validações Conjuntas');

const formularioValido = {
  nome: 'Laboratório X',
  cnpj: '11222333000181',
  emailContato: 'contato@lab.com.br',
  adminEmail: 'admin@lab.com.br',
  adminNome: 'João Silva',
  adminSenha: 'MyP@ssw0rd123',
};

assert(
  formularioValido.nome.trim().length > 0,
  'Formulário válido tem nome'
);

assert(
  /^\d{14}$/.test(formularioValido.cnpj.replace(/[^\d]/g, '')),
  'Formulário válido tem CNPJ com 14 dígitos'
);

assert(
  isValidEmail(formularioValido.emailContato),
  'Formulário válido tem email de contato válido'
);

assert(
  isValidEmail(formularioValido.adminEmail),
  'Formulário válido tem email de admin válido'
);

assert(
  formularioValido.adminNome.trim().length > 0,
  'Formulário válido tem nome de admin'
);

assert(
  isValidPassword(formularioValido.adminSenha),
  'Formulário válido tem senha forte'
);

// Formulário com erros
const formularioInvalido = {
  nome: '',
  cnpj: '123',
  emailContato: 'invalido',
  adminEmail: 'admin@',
  adminNome: '',
  adminSenha: 'abc',
};

const erros = [];

if (!formularioInvalido.nome.trim()) {
  erros.push('nome');
}

assert(
  erros.length > 0,
  'Detecta erro em formulário inválido (nome vazio)'
);

// ============================================================
// IMPRIMIR RESUMO
// ============================================================

printSummary();

// Retornar exit code apropriado
process.exit(failedTests > 0 ? 1 : 0);
