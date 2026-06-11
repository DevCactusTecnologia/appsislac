// Helpers leves para o cadastro de exames — auto-mnemônico + presets por setor.
// Mapas estáticos. Sem engine, sem herança, sem lógica dinâmica.

const STOPWORDS = new Set([
  "DE","DA","DO","DAS","DOS","E","EM","NO","NA","COM","COMPLETO","COMPLETA","TOTAL","SERICO","SERICA","UM","UMA",
]);

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Gera mnemônico a partir do nome: uppercase, sem acentos, máx 8 chars. */
export function gerarMnemonico(nome: string): string {
  const limpo = stripDiacritics(nome || "").toUpperCase().replace(/[^A-Z0-9 ]+/g, " ").trim();
  if (!limpo) return "";
  const tokens = limpo.split(/\s+/).filter((t) => !STOPWORDS.has(t));
  if (tokens.length === 0) return limpo.slice(0, 8);
  if (tokens.length === 1) return tokens[0].slice(0, 8);
  // múltiplos tokens: iniciais (até 4) + completar com letras do primeiro token
  const iniciais = tokens.slice(0, 4).map((t) => t[0]).join("");
  if (iniciais.length >= 3) return iniciais.slice(0, 8);
  return (iniciais + tokens[0].slice(1)).slice(0, 8);
}

export interface SetorPreset {
  material?: string;
  recipiente?: string; // value de RECIPIENTES
  volumeMinimoMl?: number;
  requerJejum?: boolean;
  horasJejum?: number;
  grupoEtiquetas?: string;
}

/** Presets simples por setor. Aplicados apenas em cadastro novo, e só nos
 *  campos ainda vazios — nunca sobrescreve dado preenchido pelo usuário. */
export const SETOR_PRESETS: Record<string, SetorPreset> = {
  "BIOQUIMICA": { material: "Soro", recipiente: "TUBO_SECO_GEL", volumeMinimoMl: 2, requerJejum: true, horasJejum: 8, grupoEtiquetas: "AMARELO-GEL" },
  "BIOQUÍMICA": { material: "Soro", recipiente: "TUBO_SECO_GEL", volumeMinimoMl: 2, requerJejum: true, horasJejum: 8, grupoEtiquetas: "AMARELO-GEL" },
  "HEMATOLOGIA": { material: "Sangue Total EDTA", recipiente: "TUBO_EDTA", volumeMinimoMl: 3, grupoEtiquetas: "EDTA-ROXO" },
  "COAGULACAO": { material: "Plasma Citrato", recipiente: "TUBO_CITRATO", volumeMinimoMl: 2.7, grupoEtiquetas: "CITRATO-AZUL" },
  "COAGULAÇÃO": { material: "Plasma Citrato", recipiente: "TUBO_CITRATO", volumeMinimoMl: 2.7, grupoEtiquetas: "CITRATO-AZUL" },
  "UROANALISE": { material: "Urina jato médio", recipiente: "FRASCO_ESTERIL", volumeMinimoMl: 30, grupoEtiquetas: "URINA" },
  "UROANÁLISE": { material: "Urina jato médio", recipiente: "FRASCO_ESTERIL", volumeMinimoMl: 30, grupoEtiquetas: "URINA" },
  "PARASITOLOGIA": { material: "Fezes", recipiente: "COLETOR_FEZES", grupoEtiquetas: "FEZES" },
  "MICROBIOLOGIA": { material: "Swab orofaríngeo", recipiente: "MEIO_TRANSPORTE", grupoEtiquetas: "MICRO" },
  "IMUNOLOGIA": { material: "Soro", recipiente: "TUBO_SECO_GEL", volumeMinimoMl: 2, grupoEtiquetas: "AMARELO-GEL" },
  "SOROLOGIA": { material: "Soro", recipiente: "TUBO_SECO_GEL", volumeMinimoMl: 2, grupoEtiquetas: "AMARELO-GEL" },
  "HORMÔNIOS": { material: "Soro", recipiente: "TUBO_SECO_GEL", volumeMinimoMl: 2, grupoEtiquetas: "AMARELO-GEL" },
  "HORMONIOS": { material: "Soro", recipiente: "TUBO_SECO_GEL", volumeMinimoMl: 2, grupoEtiquetas: "AMARELO-GEL" },
  "GASOMETRIA": { material: "Sangue Total Heparina", recipiente: "TUBO_HEPARINA", volumeMinimoMl: 1, grupoEtiquetas: "GASO" },
};

export function getPresetForSetor(setor: string): SetorPreset | null {
  if (!setor) return null;
  const key = stripDiacritics(setor).toUpperCase();
  return SETOR_PRESETS[setor.toUpperCase()] ?? SETOR_PRESETS[key] ?? null;
}