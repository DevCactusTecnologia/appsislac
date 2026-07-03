/**
 * GUIA DE BOAS PRÁTICAS - APPSISLAC
 * 
 * Leia este arquivo sempre antes de escrever código!
 * Tudo aqui foi corrigido e consolidado
 */

// ============================================================================
// 1. SEGURANÇA E MULTI-TENANCY
// ============================================================================

/**
 * ❌ ERRADO:
 */
// const supabase = useSupabaseClient();
// const pacientes = await supabase.from("pacientes").select("*");
// // Pode vazar dados de outro tenant!

/**
 * ✅ CORRETO:
 */
// import { getTenantIdOrThrow, withTenantFilter } from "@/lib/tenantValidation";
//
// const tenantId = await getTenantIdOrThrow();
// const pacientes = await withTenantFilter(
//   supabase.from("pacientes").select("*"),
//   tenantId
// );

// ============================================================================
// 2. ERRO HANDLING
// ============================================================================

/**
 * ❌ ERRADO:
 */
// try {
//   const resultado = await operacao();
// } catch (e) {
//   console.error(e);
//   return null;
// }

/**
 * ✅ CORRETO:
 */
// import { handleError } from "@/lib/errorHandling";
// import { useAppContext } from "@/contexts/AppContext";
//
// const { notifyError } = useAppContext();
//
// try {
//   const resultado = await operacao();
// } catch (error) {
//   const handled = handleError(error, "operação crítica");
//   notifyError(error, "operação crítica");
// }

// ============================================================================
// 3. CÁLCULO DE PREÇO
// ============================================================================

/**
 * ❌ ERRADO - Duplicado em 4 lugares:
 */
// function getPrice(nome, tabela) {
//   return getTabelaByConvenio(nome) || getTabelaPropria(nome) || 0;
// }
// // E depois chamado de forma diferente em cada lugar!

/**
 * ✅ CORRETO - Único lugar:
 */
// import { usePricing } from "@/hooks/usePricing";
//
// function MyComponent() {
//   const { calculatePrice, formatPrice } = usePricing();
//
//   const preco = calculatePrice({
//     nomeExame: "Hemograma",
//     convenioNome: "Unimed",
//     metaValor: undefined,
//   });
//
//   return <span>{formatPrice(preco)}</span>;
// }

// ============================================================================
// 4. QUERIES AO BANCO
// ============================================================================

/**
 * ❌ ERRADO - N+1 Query:
 */
// const atendimentos = await supabase
//   .from("atendimentos")
//   .select("*")
//   .eq("tenant_id", tenantId);
//
// const comExames = await Promise.all(
//   atendimentos.map(a =>
//     supabase.from("exames").select("*").eq("atendimento_id", a.id)
//   )
// );
// // 1 + N queries!

/**
 * ✅ CORRETO - 1 Query:
 */
// import { queryAppointmentsWithExams } from "@/lib/queryPatterns";
//
// const result = await queryAppointmentsWithExams(tenantId);
// // Já vem com exames inclusos!

// ============================================================================
// 5. COMPARTILHAMENTO DE ESTADO (Props Drilling)
// ============================================================================

/**
 * ❌ ERRADO - Props Drilling:
 */
// <Page
//   user={user}
//   tenant={tenant}
//   permissions={permissions}
//   onNotify={onNotify}
//   onError={onError}
// >
//   <Section user={user} tenant={tenant} permissions={permissions} onNotify={onNotify}>
//     <Component user={user} tenant={tenant} permissions={permissions} onError={onError} />
//   </Section>
// </Page>

/**
 * ✅ CORRETO - Context:
 */
// import { useAppContext } from "@/contexts/AppContext";
//
// function Component() {
//   const { tenantId, hasPermission, notifyError } = useAppContext();
//   // Sem props!
// }

// ============================================================================
// 6. MEMORY LEAKS EM USEEFFECT
// ============================================================================

/**
 * ❌ ERRADO:
 */
// useEffect(() => {
//   const interval = setInterval(() => {
//     loadData();
//   }, 5000);
// }, []); // Memory leak!

/**
 * ✅ CORRETO:
 */
// import { useInterval } from "@/hooks/useCleanupUtils";
//
// useInterval(() => {
//   loadData();
// }, 5000); // Cleanup automático!

// ============================================================================
// 7. CONSTANTES
// ============================================================================

/**
 * ❌ ERRADO - Magic Strings:
 */
// if (user.perfil === "admin") {
//   // ...
// }
// if (status === "ativo") {
//   // ...
// }

/**
 * ✅ CORRETO - Constantes:
 */
// import { ROLES, STATUS } from "@/lib/constants";
//
// if (user.perfil === ROLES.ADMIN) {
//   // Type-safe!
// }
// if (status === STATUS.ACTIVE) {
//   // Autocomplete!
// }

// ============================================================================
// 8. TYPESCRIPT - REMOVER 'ANY'
// ============================================================================

/**
 * ❌ ERRADO:
 */
// function processar(data: any): any {
//   return data.campo;
// }

/**
 * ✅ CORRETO:
 */
// interface DadosEntrada {
//   campo: string;
//   valor: number;
// }
//
// function processar(data: DadosEntrada): string {
//   return data.campo;
// }

// ============================================================================
// 9. ASYNC/AWAIT E PROMISES
// ============================================================================

/**
 * ❌ ERRADO - Promise callback hell:
 */
// operacao1()
//   .then(r1 => operacao2(r1))
//   .then(r2 => operacao3(r2))
//   .catch(e => console.error(e));

/**
 * ✅ CORRETO - Async/await:
 */
// try {
//   const r1 = await operacao1();
//   const r2 = await operacao2(r1);
//   const r3 = await operacao3(r2);
// } catch (error) {
//   handleError(error, "operações sequenciais");
// }

// ============================================================================
// 10. PERMISSÕES
// ============================================================================

/**
 * ❌ ERRADO - Verificação genérica:
 */
// if (user.permissoes.includes("admin")) {
//   // Pode quebrar se nome mudar
// }

/**
 * ✅ CORRETO - Centralizado:
 */
// import { useAppContext } from "@/contexts/AppContext";
// import { PERMISSIONS } from "@/lib/constants";
//
// const { hasPermission } = useAppContext();
//
// if (hasPermission(PERMISSIONS.VIEW_DASHBOARD)) {
//   // Type-safe e centralizad o!
// }

// ============================================================================
// 11. COMPONENTES GRANDES
// ============================================================================

/**
 * ❌ ERRADO - Componente de 976 linhas:
 */
// export function ExamesTab() {
//   // ... 976 linhas de lógica, rendering, etc
//   // Impossível testar, manter, reusar
// }

/**
 * ✅ CORRETO - Quebrado em pedaços:
 */
// export function ExamesTab() {
//   // 100 linhas - apenas orquestração
//   return (
//     <>
//       <ExamesFilter {...} />
//       <ExamesTable {...} />
//       <NovoExameDialog {...} />
//     </>
//   );
// }

// ============================================================================
// 12. LOGGING E DEBUGGING
// ============================================================================

/**
 * ✅ BOAS PRÁTICAS:
 */
// // INFO: informações importantes
// console.log("✓ [Auth] Usuário logado:", user.id);
//
// // WARNING: algo pode estar errado
// console.warn("⚠️  [Auth] Tenant inativo", tenantId);
//
// // ERROR: algo definitivamente errou
// console.error("❌ [Auth] Erro crítico", error);
//
// // DEBUG: apenas em dev
// if (import.meta.env.DEV) {
//   console.debug("[Dev] Estado atual:", state);
// }

// ============================================================================
// 13. TESTABILIDADE
// ============================================================================

/**
 * ✅ TORNAR TESTÁVEL:
 */
// // 1. Extrair lógica de pura em função
// export function calculateTotalPrice(exams: ExamPrice[]): number {
//   return sumExamPrices(exams);
// }
//
// // 2. Injetar dependências
// export function useFinanceiro(queryFn = queryFinanceiroData) {
//   // Pode passar mock em testes
// }
//
// // 3. Usar constantes em lugar de magic strings
// export const BATCH_SIZE = 1000;

// ============================================================================
// 14. PERFORMANCE
// ============================================================================

/**
 * ✅ OTIMIZAÇÕES:
 */
// // 1. Memoizar componentes pesados
// export const ExpensiveComponent = React.memo(function Comp() {
//   // ...
// });
//
// // 2. Memoizar callbacks
// const handleClick = useCallback(() => {}, [dep1, dep2]);
//
// // 3. Debounce de input
// const debouncedSearch = useDebounce(searchValue, 300);
//
// // 4. Lazy loading de componentes
// const HeavyComponent = lazy(() => import("./Heavy"));
//
// // 5. Virtual lists para grandes listas
// <VirtualList items={10000} />

// ============================================================================
// 15. CONVENÇÕES DE CÓDIGO
// ============================================================================

/**
 * ✅ PREFIXOS E SUFIXOS:
 */
// // Queries e listeners
// const usePatients = () => {};
// const useAppointments = () => {};
//
// // Contextos
// export const AppContext = createContext(...);
// export function useAppContext() {}
//
// // Tipos/Interfaces
// interface PatientData {}
// type PatientId = string;
//
// // Constantes
// export const MAX_ITEMS = 100;
// export const ROLES = { ADMIN: "admin" };
//
// // Variáveis booleanas
// const isLoading = false;
// const hasPermission = false;
// const canEdit = true;
//
// // Funções
// function loadPatients() {}
// function isValidPrice() {}
// function formatPrice() {}

// ============================================================================
// 16. COMMENTS - QUANDO USAR
// ============================================================================

/**
 * ✅ BOM COMMENT:
 */
// // IMPORTANTE: Tenant ID deve ser validado SEMPRE
// // porque o RLS pode bloquear se usar ID errado
// const tenantId = await getTenantIdOrThrow();

/**
 * ❌ RUIM COMMENT:
 */
// // Pega o user
// const user = getUser();

// ============================================================================
// 17. IMPORTS
// ============================================================================

/**
 * ✅ ORDEM CORRETA:
 */
// 1. React imports
import React from "react";

// 2. Third-party imports
// import { SomeComponent } from "shadcn/ui";

// 3. Supabase imports
// import { supabase } from "@/integrations/supabase/client";

// 4. App imports
// import { getTenantIdOrThrow } from "@/lib/tenantValidation";
// import { PERMISSIONS } from "@/lib/constants";

// ============================================================================
// 18. EXEMPLO COMPLETO
// ============================================================================

/**
 * EXEMPLO: Componente bem feito
 */
// import React, { useCallback } from "react";
// import { useAppContext } from "@/contexts/AppContext";
// import { usePricing } from "@/hooks/usePricing";
// import { queryPatientsPaginated } from "@/lib/queryPatterns";
// import { PERMISSIONS } from "@/lib/constants";
// import { handleError } from "@/lib/errorHandling";
//
// export function PatientsPage() {
//   const { tenantId, hasPermission, notifyError } = useAppContext();
//   const { formatPrice } = usePricing();
//   const [patients, setPatients] = React.useState([]);
//   const [loading, setLoading] = React.useState(false);
//
//   // Proteger com permissão
//   if (!hasPermission(PERMISSIONS.VIEW_PATIENTS)) {
//     return <div>Sem permissão</div>;
//   }
//
//   // Carregar com tratamento de erro
//   const load = useCallback(async () => {
//     try {
//       setLoading(true);
//       const result = await queryPatientsPaginated(tenantId, 1, 50);
//       setPatients(result.data);
//     } catch (error) {
//       notifyError(error, "carregar pacientes");
//     } finally {
//       setLoading(false);
//     }
//   }, [tenantId, notifyError]);
//
//   // Efeito com cleanup
//   React.useEffect(() => {
//     load();
//   }, [load]);
//
//   if (loading) return <div>Carregando...</div>;
//
//   return (
//     <div>
//       {patients.map(p => (
//         <div key={p.id}>{p.nome}</div>
//       ))}
//     </div>
//   );
// }
