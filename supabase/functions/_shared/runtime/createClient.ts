// Runtime 2.0 — Server chokepoint para @supabase/supabase-js.
//
// Este é o ÚNICO módulo autorizado a importar `createClient` da SDK
// dentro de `supabase/functions/`. Todas as edge functions importam
// `createClient` daqui. Objetivos:
//   1. Governança: um único ponto rastreável de criação de clientes.
//   2. Versão pinada: elimina drift entre 2.45.0 / 2.45.4 / 2.103.3.
//   3. Preparar o terreno para roteamento tenant-aware (shared vs dedicated)
//      sem alterar call sites (mesma estratégia da Fase B no frontend).
//
// Regra: nenhum outro arquivo em `supabase/functions/**` pode importar
// `createClient` diretamente da esm.sh. A auditoria da Fase C valida isso.

export { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
