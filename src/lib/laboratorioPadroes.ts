// Padrões laboratoriais consolidados — alinhados com normas LIS (Laboratory Information System).
// Usados nos formulários de cadastro de exames para garantir nomenclatura uniforme.

/** Setores técnicos laboratoriais oficiais (SBPC/ML, RDC ANVISA 786/2023, PALC).
 *  Apenas áreas onde efetivamente se processa/analisa amostras biológicas.
 *  Não inclui categorias de exame (ex.: ALERGIA) nem rótulos genéricos (ex.: OUTROS). */
export const SETORES_LABORATORIAIS = [
  "BIOQUÍMICA",
  "HEMATOLOGIA",
  "COAGULAÇÃO",
  "UROANÁLISE",
  "PARASITOLOGIA",
  "MICROBIOLOGIA",
  "IMUNOLOGIA",
  "SOROLOGIA",
  "HORMÔNIOS",
  "BIOLOGIA MOLECULAR",
  "ANATOMIA PATOLÓGICA",
  "GASOMETRIA",
  "TOXICOLOGIA",
] as const;

/** Materiais biológicos padronizados (nomenclatura SBPC). */
export const MATERIAIS_PADRAO = [
  "Soro",
  "Plasma EDTA",
  "Plasma Citrato",
  "Plasma Fluoreto",
  "Plasma Heparina",
  "Sangue Total EDTA",
  "Sangue Total Heparina",
  "Sangue Capilar",
  "Urina jato médio",
  "Urina 24h",
  "Urina amostra isolada",
  "Fezes",
  "Líquor (LCR)",
  "Escarro",
  "Swab nasal",
  "Swab orofaríngeo",
  "Swab vaginal",
  "Secreção uretral",
  "Saliva",
  "Líquido sinovial",
  "Líquido pleural",
  "Líquido ascítico",
  "Aspirado de medula óssea",
  "Tecido / Biópsia",
  "Outro",
] as const;

/** Recipientes / tubos padronizados (sistema de cores universal — BD Vacutainer). */
export const RECIPIENTES = [
  { value: "TUBO_SECO_GEL", label: "Tubo seco com gel separador", cor: "Amarela", corHex: "#F4D03F" },
  { value: "TUBO_SECO", label: "Tubo seco (sem aditivo)", cor: "Vermelha", corHex: "#E74C3C" },
  { value: "TUBO_EDTA", label: "Tubo com EDTA K2/K3", cor: "Roxa", corHex: "#8E44AD" },
  { value: "TUBO_CITRATO", label: "Tubo com Citrato de Sódio 3,2%", cor: "Azul", corHex: "#3498DB" },
  { value: "TUBO_FLUORETO", label: "Tubo com Fluoreto + EDTA", cor: "Cinza", corHex: "#7F8C8D" },
  { value: "TUBO_HEPARINA", label: "Tubo com Heparina (Lítio/Sódio)", cor: "Verde", corHex: "#27AE60" },
  { value: "TUBO_VHS", label: "Tubo para VHS (Citrato 3,8%)", cor: "Preta", corHex: "#2C3E50" },
  { value: "FRASCO_ESTERIL", label: "Frasco coletor estéril", cor: "—", corHex: "#BDC3C7" },
  { value: "FRASCO_URINA_24H", label: "Galão para urina 24h (2L)", cor: "—", corHex: "#BDC3C7" },
  { value: "COLETOR_FEZES", label: "Coletor universal de fezes", cor: "—", corHex: "#BDC3C7" },
  { value: "MEIO_TRANSPORTE", label: "Meio de transporte (Stuart/Amies)", cor: "—", corHex: "#BDC3C7" },
  { value: "TUBO_HEMOCULTURA", label: "Frasco hemocultura aeróbio/anaeróbio", cor: "—", corHex: "#BDC3C7" },
  { value: "OUTRO", label: "Outro", cor: "—", corHex: "#BDC3C7" },
] as const;

/** Metodologias analíticas (RDC ANVISA — exigido em laudo). */
export const METODOLOGIAS = [
  "Cinética enzimática (UV)",
  "Colorimétrico (Ponto final)",
  "Turbidimetria",
  "Nefelometria",
  "ELISA",
  "Quimioluminescência (CLIA)",
  "Eletroquimioluminescência (ECL)",
  "Imunofluorescência (IFI)",
  "Imunocromatografia",
  "Aglutinação em látex",
  "Hemaglutinação passiva",
  "Citometria de fluxo",
  "Automação hematológica (Impedância)",
  "Microscopia óptica",
  "Microscopia de campo escuro",
  "Coloração de Gram",
  "Coloração de Ziehl-Neelsen (BAAR)",
  "Cultura microbiológica",
  "Antibiograma (disco-difusão)",
  "PCR convencional",
  "PCR em tempo real (RT-PCR)",
  "Sequenciamento (NGS)",
  "Eletroforese",
  "Cromatografia (HPLC)",
  "Espectrometria de massas",
  "Potenciometria (Eletrodo íon-seletivo)",
  "Gasometria (Eletrodo)",
  "Outro",
] as const;

/** Sexo aplicável ao exame. */
export const SEXOS_APLICAVEIS = [
  { value: "AMBOS", label: "Ambos os sexos" },
  { value: "MASCULINO", label: "Apenas Masculino" },
  { value: "FEMININO", label: "Apenas Feminino" },
] as const;

/** Aplica máscara visual ao código CBHPM (X.XX.XX.XX-X). */
export const formatCbhpm = (raw: string): string => {
  const digits = (raw || "").replace(/\D+/g, "").slice(0, 8);
  if (!digits) return "";
  const p1 = digits.slice(0, 1);
  const p2 = digits.slice(1, 3);
  const p3 = digits.slice(3, 5);
  const p4 = digits.slice(5, 7);
  const p5 = digits.slice(7, 8);
  let out = p1;
  if (p2) out += `.${p2}`;
  if (p3) out += `.${p3}`;
  if (p4) out += `.${p4}`;
  if (p5) out += `-${p5}`;
  return out;
};

/** Valida formato CBHPM (vazio é permitido). */
export const validarCbhpm = (codigo: string): { ok: boolean; mensagem?: string } => {
  const c = (codigo || "").trim();
  if (!c) return { ok: true };
  if (!/^\d\.\d{2}\.\d{2}\.\d{2}-\d$/.test(c)) {
    return { ok: false, mensagem: "Formato CBHPM esperado: X.XX.XX.XX-X (8 dígitos)." };
  }
  return { ok: true };
};

/** LOINC: 1 a 5 dígitos + hífen + 1 dígito verificador (ex.: 2345-7). Vazio é permitido. */
export const validarLoinc = (codigo: string): { ok: boolean; mensagem?: string } => {
  const c = (codigo || "").trim();
  if (!c) return { ok: true };
  if (!/^\d{1,5}-\d$/.test(c)) {
    return { ok: false, mensagem: "Formato LOINC esperado: até 5 dígitos + hífen + 1 dígito (ex.: 2345-7)." };
  }
  return { ok: true };
};

/** Estabilidades comuns (sugestões para autocomplete). */
export const ESTABILIDADES_SUGESTOES = [
  "Temperatura ambiente: 8h",
  "Refrigerado (2-8°C): 24h",
  "Refrigerado (2-8°C): 48h",
  "Refrigerado (2-8°C): 7 dias",
  "Congelado (-20°C): 30 dias",
  "Congelado (-80°C): 6 meses",
] as const;
