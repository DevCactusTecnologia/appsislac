// Catálogo central de placeholders aceitos nos Mapas de Trabalho.
// Toda inserção é feita via toolbar — usuário NUNCA digita {{ }} manualmente.
// Esta é a fonte única de verdade para o sistema (validação + UI + render).

import type { JsonValue, PlaceholderData } from "@/types/domain";

export interface PlaceholderDef {
  tag: string; // Ex.: "paciente.nome" → renderizado como {{paciente.nome}}
  label: string;
  group: "Paciente" | "Atendimento" | "Exame" | "Resultado" | "Sistema" | "Convênio" | "Solicitante" | "Unidade" | "Laboratório" | "Pagamentos" | "Totais";
  description?: string;
}

export const PLACEHOLDERS: PlaceholderDef[] = [
  // Paciente
  { tag: "paciente.nome", label: "Nome do paciente", group: "Paciente" },
  { tag: "paciente.idade", label: "Idade", group: "Paciente" },
  { tag: "paciente.sexo", label: "Sexo", group: "Paciente" },
  { tag: "paciente.cpf", label: "CPF", group: "Paciente" },
  { tag: "paciente.nascimento", label: "Data de nascimento", group: "Paciente" },
  { tag: "paciente.protocolo", label: "Protocolo do paciente", group: "Paciente" },
  { tag: "paciente.guia", label: "Guia do paciente", group: "Paciente" },
  // Atendimento
  { tag: "protocolo", label: "Protocolo", group: "Atendimento" },
  { tag: "guia", label: "Guia", group: "Atendimento" },
  { tag: "atendimento.data", label: "Data do atendimento", group: "Atendimento" },
  { tag: "atendimento.prioridade", label: "Prioridade do atendimento", group: "Atendimento" },
  { tag: "convenio.nome", label: "Convênio", group: "Atendimento" },
  { tag: "analista.nome", label: "Nome do analista", group: "Atendimento" },
  { tag: "ordem", label: "Ordem (nº sequencial)", group: "Atendimento", description: "Número sequencial do paciente no mapa (1, 2, 3...)" },
  // Exame
  { tag: "exame.nome", label: "Nome do exame", group: "Exame" },
  { tag: "exame.codigo", label: "Código do exame", group: "Exame" },
  { tag: "exame.material", label: "Material", group: "Exame" },
  // Parâmetro (loop dinâmico por exame)
  { tag: "parametro.abreviacao", label: "Abreviação do parâmetro", group: "Exame" },
  { tag: "parametro.rotulo", label: "Rótulo do parâmetro", group: "Exame" },
  { tag: "parametro.chave", label: "Chave do parâmetro", group: "Exame" },
  // Resultado (campos dinâmicos por exame — usuário pode adicionar livre via "Inserir resultado")
  { tag: "resultado.campo", label: "Campo de resultado (genérico)", group: "Resultado" },
  // Sistema
  { tag: "sistema.dataImpressao", label: "Data de impressão", group: "Sistema" },
  { tag: "sistema.usuario", label: "Usuário que imprimiu", group: "Sistema" },
];

const PLACEHOLDER_TAGS = new Set(PLACEHOLDERS.map((p) => p.tag));

// Aceita também resultado.<qualquerCampo> e parametro.<qualquerCampo> dinâmicos
const RESULTADO_DYNAMIC = /^resultado\.[a-zA-Z][\w]*$/;
const PARAMETRO_DYNAMIC = /^parametro\.[a-zA-Z][\w]*$/;

/** Extrai todos os placeholders {{...}} presentes em um HTML. */
export function extractPlaceholders(html: string): string[] {
  if (!html) return [];
  const re = /\{\{\s*([\w.]+)\s*\}\}/g;
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) found.add(m[1]);
  return Array.from(found);
}

/** Valida se todos os placeholders extraídos são conhecidos. */
export function validatePlaceholders(html: string): {
  valid: boolean;
  invalid: string[];
  used: string[];
} {
  const used = extractPlaceholders(html);
  const invalid = used.filter(
    (tag) =>
      !PLACEHOLDER_TAGS.has(tag) &&
      !RESULTADO_DYNAMIC.test(tag) &&
      !PARAMETRO_DYNAMIC.test(tag)
  );
  return { valid: invalid.length === 0, invalid, used };
}

/** Substitui placeholders por dados reais (renderização client-side para preview/impressão). */
export function renderPlaceholders(
  html: string,
  data: PlaceholderData
): string {
  if (!html) return "";
  return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
    const parts = path.split(".");
    let cur: JsonValue | undefined = data;
    for (const p of parts) {
      if (cur == null) return "";
      if (typeof cur !== "object" || Array.isArray(cur)) return "";
      cur = (cur as Record<string, JsonValue | undefined>)[p];
    }
    return cur == null ? "" : String(cur);
  });
}
