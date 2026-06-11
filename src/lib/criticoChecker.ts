// Re-export shim — file moved to src/domains/result/services/criticoChecker.ts
// Mantido para retro-compat de imports antigos. Novo código deve importar
// diretamente do domínio.
export {
  avaliarCritico,
  isCritico,
  type NivelCritico,
} from "@/domains/result/services/criticoChecker";
