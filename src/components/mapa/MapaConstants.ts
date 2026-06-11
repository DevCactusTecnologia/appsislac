export type TipoMapa = "paciente" | "analista" | "setor" | "exame";

export interface MapaFilters {
  tipo: TipoMapa;
  dataAnalista?: Date;
  dataSetor?: Date;
  dataExame?: Date;
  nomePaciente: string;
  nomeAnalista: string;
  filtroSetor: string;
  setorExame: string;
  analistaExame: string;
  selectedPacienteId?: number;
}

export const normalize = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

// Lista canônica de setores usada como fallback de filtro quando o catálogo
// real ainda não foi carregado. Mocks de "examesPorSetor" e "analistas" foram
// removidos (eram dead-code não consumido por runtime).
export const setoresFiltro = ["BACTERIOLOGIA", "BIOQUÍMICA", "CITOLOGIA", "ESPERMOGRAMA", "HEMATOLOGIA", "IMUNOLOGIA", "MICROBIOLOGIA", "PARASITOLOGIA", "UROANÁLISE"];

export const tipoOptions: { value: TipoMapa; label: string; icon: string }[] = [
  { value: "paciente", label: "Paciente", icon: "👤" },
  { value: "analista", label: "Analista", icon: "🔬" },
  { value: "setor", label: "Setor", icon: "🏢" },
  { value: "exame", label: "Exame", icon: "📋" },
];
