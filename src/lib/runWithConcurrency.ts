/**
 * Executa um array de tarefas async com limite de concorrência. Preserva a
 * ordem dos resultados (mesmo índice do input). Útil para evitar saturar o
 * lock de auth do Supabase e o pool de conexões quando precisamos persistir
 * dezenas/centenas de updates (ex.: análise/colete em lote de 70+ exames).
 */
export async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const max = Math.max(1, Math.min(limit, items.length));
  const runners = Array.from({ length: max }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}
