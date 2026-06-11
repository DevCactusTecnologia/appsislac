// Templates de Mapas de Trabalho — réplica fiel dos arquivos .blade.php do legado.
//
// Cada template abaixo reproduz o HTML/estrutura visual dos arquivos:
//   • hemogram.blade.php       → HEMOGRAMA COMPLETO (individual)
//   • hiv.blade.php            → HIV (individual)
//   • fezes.blade.php          → PARASITOLÓGICO DE FEZES (individual)
//   • urina.blade.php          → URINA DE JATO MÉDIO / EAS (individual)
//   • others-exams.blade.php   → MAPA DO ANALISTA (lote — demais exames)
//
// Os placeholders {{ ... }} são substituídos pelo motor (mapaGenerator.ts) na
// hora da impressão. Aqui mantemos UMA linha modelo da tabela (LOOP=1) para
// que o usuário possa editar visualmente OU via código-fonte.

import type { MapaTipo } from "@/data/mapaTrabalhoStore";

export interface MapaTemplate {
  id: string;
  nome: string;
  tipo: MapaTipo;
  descricao: string;
  conteudo: string; // HTML com placeholders
}

// ─── Cabeçalho institucional comum a todos os mapas ────────────────────────
const cabecalho = (titulo: string) => `
  <div style="text-align:center; margin-bottom:6px;">
    <h2 style="margin:0; font-size:13px; text-transform:uppercase; letter-spacing:0.5px;">${titulo}</h2>
    <p style="margin:2px 0 0 0; font-size:9px; color:#444;">
      Impresso em <strong>{{sistema.dataImpressao}}</strong> por <strong>{{sistema.usuario}}</strong>
    </p>
  </div>
`;

// ─── 1) HEMOGRAMA — réplica de hemogram.blade.php ─────────────────────────
const hemogramaTabela = `
<table style="width:100%; border-collapse:collapse; font-size:9px; font-family:Arial, sans-serif;">
  <tbody>
    <tr style="background-color:#F2F2F2; text-align:center; font-weight:600;">
      <td rowspan="3" style="border:1px solid #000; width:2%;">1</td>
      <td rowspan="2" style="border:1px solid #000; background-color:#FFF; text-align:left; font-weight:500; width:14%;">
        <div style="padding:5px;">
          <div style="display:flex; justify-content:space-between; font-size:9px;">
            <div><strong>PROTOCOLO:</strong> {{paciente.protocolo}}</div>
            <div style="font-weight:bolder; background-color:#CCC; padding:0 4px;">GUIA: {{paciente.guia}}</div>
          </div>
          <div style="font-size:9px;">{{paciente.nome}}</div>
          <div style="font-size:9px;">{{paciente.sexo}} {{paciente.idade}}</div>
        </div>
      </td>
      <td style="width:6%; border:1px solid #000;">HEMAC</td>
      <td style="width:6%; border:1px solid #000;">HEMOG</td>
      <td style="width:6%; border:1px solid #000;">HEMAT</td>
      <td style="width:6%; border:1px solid #000;">RDW</td>
      <td style="width:6%; border:1px solid #000;">LEUC</td>
      <td style="width:6%; border:1px solid #000;">MIEL</td>
      <td style="width:6%; border:1px solid #000;">META</td>
      <td style="width:6%; border:1px solid #000;">BAST</td>
      <td style="width:6%; border:1px solid #000;">SEGM</td>
      <td style="width:6%; border:1px solid #000;">EOSI</td>
      <td style="width:6%; border:1px solid #000;">BASO</td>
      <td style="width:6%; border:1px solid #000;">LINF</td>
      <td style="width:6%; border:1px solid #000;">MONO</td>
      <td style="width:6%; border:1px solid #000;">PLAQ</td>
    </tr>
    <tr>
      <td style="border:1px solid #000; height:26px;"></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
    </tr>
    <tr>
      <td style="border:1px solid #000; text-align:right; padding-right:5px;">Observações</td>
      <td colspan="14" style="border:1px solid #000; height:15px;"></td>
    </tr>
    <tr><td colspan="16" style="border:1px solid #000; height:10px;"></td></tr>
  </tbody>
</table>
`;

// ─── 2) HIV — réplica de hiv.blade.php ────────────────────────────────────
const hivTabela = `
<table style="width:100%; border-collapse:collapse; font-size:9px; font-family:Arial, sans-serif;">
  <tbody>
    <tr style="background-color:#F2F2F2; text-align:center; font-weight:600;">
      <td rowspan="2" style="width:1%; border:1px solid #000;">1</td>
      <td rowspan="2" style="width:15%; border:1px solid #000; background-color:#FFF; text-align:left; font-weight:500;">
        <div style="padding:5px;">
          <div style="display:flex; justify-content:space-between; font-size:9px;">
            <div><strong>PROTOCOLO:</strong> {{paciente.protocolo}}</div>
            <div style="font-weight:bolder; background-color:#CCC; padding:0 4px;">GUIA: {{paciente.guia}}</div>
          </div>
          <div style="font-size:9px;">{{paciente.nome}}</div>
          <div style="font-size:9px;">{{paciente.sexo}} {{paciente.idade}}</div>
        </div>
      </td>
      <td style="width:10%; border:1px solid #000;">POSITIVO</td>
      <td style="width:10%; border:1px solid #000;">NEGATIVO</td>
      <td style="width:57%; border:1px solid #000;">OBSERVAÇÕES</td>
    </tr>
    <tr>
      <td style="border:1px solid #000; height:26px;"></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
    </tr>
    <tr><td colspan="5" style="border:1px solid #000; height:10px;"></td></tr>
  </tbody>
</table>
`;

// ─── 3) PARASITOLÓGICO DE FEZES — réplica de fezes.blade.php ──────────────
const fezesTabela = `
<table style="width:100%; border-collapse:collapse; font-size:9px; font-family:Arial, sans-serif;">
  <tbody>
    <tr style="background-color:#F2F2F2; text-align:center; font-weight:600;">
      <td rowspan="3" style="border:1px solid #000; width:2%;">1</td>
      <td rowspan="2" style="border:1px solid #000; background-color:#FFF; text-align:left; font-weight:500; width:17%;">
        <div style="padding:5px;">
          <div style="display:flex; justify-content:space-between; font-size:9px;">
            <div><strong>PROTOCOLO:</strong> {{paciente.protocolo}}</div>
            <div style="font-weight:bolder; background-color:#CCC; padding:0 4px;">GUIA: {{paciente.guia}}</div>
          </div>
          <div style="font-size:9px;">{{paciente.nome}}</div>
          <div style="font-size:9px;">{{paciente.sexo}} {{paciente.idade}}</div>
        </div>
      </td>
      <td style="width:9%; border:1px solid #000;">GIARD. LAMB</td>
      <td style="width:9%; border:1px solid #000;">ENTAM. HISTO</td>
      <td style="width:9%; border:1px solid #000;">ENTAM. COLI</td>
      <td style="width:9%; border:1px solid #000;">ENDOL. NANA</td>
      <td style="width:9%; border:1px solid #000;">HYMEM. NANA</td>
      <td style="width:9%; border:1px solid #000;">ENT. BIUS</td>
      <td style="width:9%; border:1px solid #000;">ANCYLOST.</td>
      <td style="width:9%; border:1px solid #000;">ASCAR. LUMBRI</td>
      <td style="width:9%; border:1px solid #000;">NEGATIVO</td>
    </tr>
    <tr>
      <td style="border:1px solid #000; height:26px;"></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
      <td style="border:1px solid #000;"></td>
    </tr>
    <tr>
      <td style="border:1px solid #000; text-align:right; padding-right:5px;">Observações</td>
      <td colspan="9" style="border:1px solid #000; height:15px;"></td>
    </tr>
    <tr><td colspan="11" style="border:1px solid #000; height:10px;"></td></tr>
  </tbody>
</table>
`;

// ─── 4) URINA DE JATO MÉDIO — réplica de urina.blade.php ──────────────────
const urinaTabela = `
<table style="width:100%; border-collapse:collapse; font-size:9px; font-family:Arial, sans-serif;">
  <tbody>
    <tr style="background-color:#F2F2F2; font-weight:600; border-top:1px solid #000;">
      <td colspan="2" style="border:1px solid #000;"></td>
      <td style="width:16%; border:1px solid #000; padding-left:5px;">CARACTERES FÍSICOS</td>
      <td colspan="2" style="width:32%; border:1px solid #000; padding-left:5px;">CARACTERES QUÍMICOS</td>
      <td colspan="2" style="width:32%; border:1px solid #000; padding-left:5px;">MICROSCOPIA DO SEDIMENTO (400x)</td>
    </tr>
    <tr>
      <td rowspan="6" style="width:1%; border:1px solid #000; text-align:center;">1</td>
      <td rowspan="6" style="border:1px solid #000; background-color:#FFF; text-align:left; font-weight:500; width:18%;">
        <div style="padding:5px;">
          <div style="display:flex; justify-content:space-between; font-size:9px;">
            <div><strong>PROTOCOLO:</strong> {{paciente.protocolo}}</div>
            <div style="font-weight:bolder; background-color:#CCC; padding:0 4px;">GUIA: {{paciente.guia}}</div>
          </div>
          <div style="font-size:9px;">{{paciente.nome}}</div>
          <div style="font-size:9px;">{{paciente.sexo}} {{paciente.idade}}</div>
        </div>
      </td>
      <td style="width:16%; border:1px solid #000; padding-left:5px;">Volume:</td>
      <td style="width:16%; border:1px solid #000; padding-left:5px;">pH:</td>
      <td style="width:16%; border:1px solid #000; padding-left:5px;">Bilirrubina:</td>
      <td colspan="2" style="width:16%; border:1px solid #000; padding-left:5px;">Células Epiteliais:</td>
    </tr>
    <tr>
      <td style="border:1px solid #000; padding-left:5px;">Cor:</td>
      <td style="border:1px solid #000; padding-left:5px;">Nitrito:</td>
      <td style="border:1px solid #000; padding-left:5px;">Sangue:</td>
      <td colspan="2" style="border:1px solid #000; padding-left:5px;">Leucócitos:</td>
    </tr>
    <tr>
      <td style="border:1px solid #000; padding-left:5px;">Aspecto:</td>
      <td style="border:1px solid #000; padding-left:5px;">Proteínas:</td>
      <td style="border:1px solid #000; padding-left:5px;">Sais Biliares:</td>
      <td colspan="2" style="border:1px solid #000; padding-left:5px;">Piócitos:</td>
    </tr>
    <tr>
      <td style="border:1px solid #000; padding-left:5px;">Depósito:</td>
      <td style="border:1px solid #000; padding-left:5px;">Glicose:</td>
      <td style="border:1px solid #000;"></td>
      <td colspan="2" style="border:1px solid #000; padding-left:5px;">Hemácias:</td>
    </tr>
    <tr>
      <td style="border:1px solid #000; padding-left:5px;">Cheiro:</td>
      <td style="border:1px solid #000; padding-left:5px;">Corpos Cetônicos:</td>
      <td style="border:1px solid #000;"></td>
      <td colspan="2" style="border:1px solid #000; padding-left:5px;">Cilindro:</td>
    </tr>
    <tr>
      <td style="border:1px solid #000; padding-left:5px;">Densidade:</td>
      <td style="border:1px solid #000; padding-left:5px;">Urobilinogênio:</td>
      <td style="border:1px solid #000;"></td>
      <td colspan="2" style="border:1px solid #000; padding-left:5px;">Cristais:</td>
    </tr>
    <tr>
      <td colspan="5" style="border:1px solid #000; padding-left:5px;">Observações:</td>
      <td colspan="2" style="border:1px solid #000; padding-left:5px;">Muco:</td>
    </tr>
    <tr><td colspan="7" style="height:8px;"></td></tr>
  </tbody>
</table>
`;

// ─── 5) MAPA PADRÃO (LOTE) — réplica fiel de others-exams.blade.php ──────
// Este é o ÚNICO template aplicado a TODOS os exames que NÃO possuem mapa
// individual configurado (Hemograma, HIV, Fezes, Urina). Cada paciente gera
// 1 linha contendo blocos horizontais — um por exame — com as abreviações
// dos parâmetros separadas por linhas tracejadas para preenchimento manual.
const mapaPadraoTabela = `
<table style="width:100%; border-collapse:collapse; font-size:9px; font-family:Arial, Helvetica, sans-serif; border:1px solid #000;">
  <tbody>
    <tr>
      <td colspan="3" style="padding:5px; text-align:right; background-color:#F2F2F2; font-weight:600; border:1px solid #000;">
        MAPA DO ANALISTA — {{analista.nome}}, Impresso em {{sistema.dataImpressao}} por {{sistema.usuario}}
      </td>
    </tr>
    <tr style="text-align:center; font-weight:600;">
      <td style="width:1%; border:1px solid #000;">1</td>
      <td style="width:15%; border:1px solid #000; background-color:#FFF; text-align:left; font-weight:500; padding:0;">
        <div style="padding:5px;">
          <div style="display:flex; justify-content:space-between; font-size:9px;">
            <div><strong>PROTOCOLO:</strong> {{paciente.protocolo}}</div>
            <div style="font-weight:bolder; background-color:#CCC; padding:0 4px;">GUIA: {{paciente.guia}}</div>
          </div>
          <div style="font-size:9px; margin-top:2px;">{{paciente.nome}}</div>
          <div style="font-size:9px; color:#444;">{{paciente.sexo}} {{paciente.idade}}</div>
        </div>
      </td>
      <td style="width:84%; border:1px solid #000; padding:0;">
        <div style="display:flex; flex-wrap:wrap; align-items:stretch;">

          <!-- ▸ BLOCO DE EXEMPLO 1 — Glicemia (parâmetro: GLI) ──────────── -->
          <div style="display:flex; flex-direction:column; border-right:1px solid #000;">
            <div style="font-size:8px; padding:2px 6px; background-color:#F2F2F2; text-align:center; font-weight:600;">GLICEMIA</div>
            <div style="display:flex;">
              <div style="font-size:8px; padding:1px 8px; text-align:center; border-bottom:1px dashed #000;">GLI</div>
            </div>
            <div style="display:flex;">
              <div style="height:20px; padding:0 8px;"></div>
            </div>
          </div>

          <!-- ▸ BLOCO DE EXEMPLO 2 — Colesterol (parâmetros: COL, HDL, LDL) -->
          <div style="display:flex; flex-direction:column; border-right:1px solid #000;">
            <div style="font-size:8px; padding:2px 6px; background-color:#F2F2F2; text-align:center; font-weight:600;">COLESTEROL TOTAL E FRAÇÕES</div>
            <div style="display:flex;">
              <div style="font-size:8px; padding:1px 8px; text-align:center; border-bottom:1px dashed #000; border-right:1px dashed #000;">COL</div>
              <div style="font-size:8px; padding:1px 8px; text-align:center; border-bottom:1px dashed #000; border-right:1px dashed #000;">HDL</div>
              <div style="font-size:8px; padding:1px 8px; text-align:center; border-bottom:1px dashed #000;">LDL</div>
            </div>
            <div style="display:flex;">
              <div style="height:20px; padding:0 8px; border-right:1px dashed #000;"></div>
              <div style="height:20px; padding:0 8px; border-right:1px dashed #000;"></div>
              <div style="height:20px; padding:0 8px;"></div>
            </div>
          </div>

          <!-- ▸ BLOCO DE EXEMPLO 3 — TGO/TGP ─────────────────────────── -->
          <div style="display:flex; flex-direction:column;">
            <div style="font-size:8px; padding:2px 6px; background-color:#F2F2F2; text-align:center; font-weight:600;">TRANSAMINASES</div>
            <div style="display:flex;">
              <div style="font-size:8px; padding:1px 8px; text-align:center; border-bottom:1px dashed #000; border-right:1px dashed #000;">TGO</div>
              <div style="font-size:8px; padding:1px 8px; text-align:center; border-bottom:1px dashed #000;">TGP</div>
            </div>
            <div style="display:flex;">
              <div style="height:20px; padding:0 8px; border-right:1px dashed #000;"></div>
              <div style="height:20px; padding:0 8px;"></div>
            </div>
          </div>

        </div>
      </td>
    </tr>
  </tbody>
</table>

<p style="font-size:9px; color:#666; margin-top:8px; font-style:italic;">
  ▸ Este é o template <strong>padrão</strong> usado para TODOS os exames que não possuem mapa individual.
  Os blocos acima são apenas <strong>exemplos visuais</strong> — na impressão real, o sistema gera automaticamente
  um bloco por exame de cada paciente, contendo as abreviações dos parâmetros cadastrados em
  <em>Configurações → Exames</em>, separados por linhas tracejadas para preenchimento manual.
</p>
`;

export const MAPA_TEMPLATES: MapaTemplate[] = [
  {
    id: "tpl-hemograma-completo",
    nome: "HEMOGRAMA COMPLETO",
    tipo: "INDIVIDUAL",
    descricao:
      "Réplica fiel do hemogram.blade.php. Tabela com 14 colunas técnicas (HEMAC, HEMOG, HEMAT, RDW, LEUC, MIEL, META, BAST, SEGM, EOSI, BASO, LINF, MONO, PLAQ) + linha de Observações. Edite a tabela visualmente ou via código-fonte (botão </>).",
    conteudo: `${cabecalho("Mapa de Trabalho — Hemograma Completo")}${hemogramaTabela}`.trim(),
  },
  {
    id: "tpl-hiv",
    nome: "HIV",
    tipo: "INDIVIDUAL",
    descricao:
      "Réplica fiel do hiv.blade.php. Colunas POSITIVO / NEGATIVO / OBSERVAÇÕES. Edite a tabela visualmente ou via código-fonte (botão </>).",
    conteudo: `${cabecalho("Mapa de Trabalho — HIV")}${hivTabela}`.trim(),
  },
  {
    id: "tpl-parasitologico-fezes",
    nome: "PARASITOLOGICO DE FEZES",
    tipo: "INDIVIDUAL",
    descricao:
      "Réplica fiel do fezes.blade.php. 9 colunas (Giardia Lamb., Entam. Histo., Entam. Coli, Endol. Nana, Hymen. Nana, Ent. Bius, Ancylost., Áscar. Lumbri, Negativo) + linha de Observações.",
    conteudo: `${cabecalho("Mapa de Trabalho — Parasitológico de Fezes")}${fezesTabela}`.trim(),
  },
  {
    id: "tpl-urina-jato-medio",
    nome: "URINA DE JATO MEDIO",
    tipo: "INDIVIDUAL",
    descricao:
      "Réplica fiel do urina.blade.php. Três blocos (Caracteres Físicos, Caracteres Químicos, Microscopia do Sedimento 400x) com todos os campos do EAS.",
    conteudo: `${cabecalho("Mapa de Trabalho — Urina de Jato Médio (EAS)")}${urinaTabela}`.trim(),
  },
  {
    id: "tpl-mapa-padrao-lote",
    nome: "MAPA PADRÃO — Demais exames (Lote)",
    tipo: "LOTE",
    descricao:
      "Template PADRÃO aplicado a TODOS os exames que não possuem mapa individual configurado. Réplica fiel do others-exams.blade.php: cada paciente gera 1 linha com blocos horizontais por exame, contendo as abreviações dos parâmetros separadas por linhas tracejadas para preenchimento manual. Edite a tabela visualmente ou via código-fonte (botão </>).",
    conteudo: `${cabecalho("Mapa do Analista — Padrão (Demais Exames)")}${mapaPadraoTabela}`.trim(),
  },
];
