import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  // Runtime 2.0 — Fase D: uma única forma oficial de resolver tenant,
  // criar clients, autenticar e acessar Storage. Toda a superfície é
  // `import { db, getTenantContext, ... } from "@/runtime/db"`.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/runtime/db/strategies/shared.ts",
      "src/runtime/db/resolver.ts",
      "src/integrations/supabase/**",
      // Exceção auditada: cria client transitório (memstorage) para validar
      // credenciais de analista sem substituir a sessão do operador logado.
      "src/lib/validarCredenciaisAnalista.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/integrations/supabase/client",
              message:
                "Runtime 2.0: use `import { db } from '@/runtime/db'` em vez do client direto.",
            },
            {
              name: "@supabase/supabase-js",
              importNames: ["createClient"],
              message:
                "Runtime 2.0: criação de clients só via `@/runtime/db`. Imports de `type` continuam permitidos.",
            },
          ],
          patterns: [
            {
              group: ["@/lib/db", "@/lib/db/*"],
              message:
                "Runtime 2.0 (Fase D): `@/lib/db` foi consolidado em `@/runtime/db`.",
            },
          ],
        },
      ],
    },
  },
);
