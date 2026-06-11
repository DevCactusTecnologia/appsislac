/**
 * SSOT — Helpers de formatação
 *
 * Concentra TODA a formatação humana usada na UI.
 * Nenhum componente deve reimplementar máscara/format inline.
 *
 * Ver: docs/architecture/simplification-master-plan.md (Fase 11)
 */

// ─── Números/strings auxiliares ───
const onlyDigits = (s: string | null | undefined): string => (s ?? "").replace(/\D/g, "");

// ─── CPF ───
export function formatCPF(value: string | null | undefined): string {
  const d = onlyDigits(value).padStart(11, "0").slice(0, 11);
  if (!d) return "";
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

// ─── CNPJ ───
export function formatCNPJ(value: string | null | undefined): string {
  const d = onlyDigits(value).padStart(14, "0").slice(0, 14);
  if (!d) return "";
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

// ─── Telefone BR (fixo ou celular) ───
export function formatTelefone(value: string | null | undefined): string {
  const d = onlyDigits(value).slice(0, 11);
  if (!d) return "";
  if (d.length <= 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`.trim();
  }
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// ─── Datas ───
export function formatData(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function formatHora(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDataHora(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "";
  return `${formatData(d)} ${formatHora(d)}`;
}

export function formatDataHoraSegundos(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${formatData(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ─── Idade ───
/** Retorna anos completos entre nascimento (ISO/yyyy-mm-dd) e hoje. */
export function calcularIdade(nascimentoISO: string | null | undefined, ref: Date = new Date()): number {
  if (!nascimentoISO) return 0;
  const n = new Date(nascimentoISO);
  if (Number.isNaN(n.getTime())) return 0;
  let anos = ref.getFullYear() - n.getFullYear();
  const m = ref.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < n.getDate())) anos--;
  return anos;
}

/** Formato humano "32 anos" / "8 meses" / "12 dias" conforme magnitude. */
export function formatIdade(nascimentoISO: string | null | undefined, ref: Date = new Date()): string {
  if (!nascimentoISO) return "";
  const n = new Date(nascimentoISO);
  if (Number.isNaN(n.getTime())) return "";
  const anos = calcularIdade(nascimentoISO, ref);
  if (anos >= 2) return `${anos} anos`;
  const meses = (ref.getFullYear() - n.getFullYear()) * 12 + (ref.getMonth() - n.getMonth());
  if (meses >= 1) return `${meses} ${meses === 1 ? "mês" : "meses"}`;
  const dias = Math.max(0, Math.floor((ref.getTime() - n.getTime()) / 86_400_000));
  return `${dias} ${dias === 1 ? "dia" : "dias"}`;
}

// ─── Moeda BRL ───
export function formatMoeda(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value.replace(/\./g, "").replace(",", ".")) : (value ?? 0);
  if (!Number.isFinite(n)) return "R$ 0,00";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Moeda sem o prefixo "R$". */
export function formatMoedaSemSimbolo(value: number | null | undefined): string {
  const n = value ?? 0;
  if (!Number.isFinite(n)) return "0,00";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Percentual ───
export function formatPercentual(value: number | null | undefined, decimais = 1): string {
  const n = value ?? 0;
  if (!Number.isFinite(n)) return "0%";
  return `${n.toLocaleString("pt-BR", { minimumFractionDigits: decimais, maximumFractionDigits: decimais })}%`;
}

// ─── Sanitização auxiliar ───
export function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
