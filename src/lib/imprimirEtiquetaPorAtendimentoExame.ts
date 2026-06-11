// Resolve dados completos a partir de um atendimento_exame e dispara a
// impressão da etiqueta de amostra. Cuida de:
//  - Buscar a amostra vinculada (codigo_barra real, com DV)
//  - Buscar dados do paciente/atendimento (protocolo, nome, idade)
//  - Respeitar `quantidade_etiquetas` do catálogo do exame
//  - Agrupar exames que compartilham o mesmo tubo (amostra_id),
//    listando os demais exames na observação da etiqueta.

import { supabase } from "@/integrations/supabase/client";
import { imprimirEtiquetaAmostra } from "@/lib/etiquetaAmostra";
import { formatIdadeDetalhada } from "@/lib/idade";
import { getCurrentTenantNome, getCachedTenantNome } from "@/data/_tenant";
import { toast } from "sonner";
import { showError } from "@/lib/showError";

function isoToBR(iso: string | null | undefined): string {
  if (!iso) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(iso)) return iso;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/**
 * Imprime a etiqueta da amostra associada a um exame de atendimento.
 * Se o tubo for compartilhado por outros exames (mesmo amostra_id),
 * eles são listados como observação ("+ N exames: X, Y").
 */
export async function imprimirEtiquetaPorAtendimentoExame(
  atendimentoExameId: number,
): Promise<void> {
  try {
    // 1) Carrega o exame de atendimento alvo
    const { data: exRow, error: exErr } = await supabase
      .from("atendimento_exames")
      .select(
        "id, atendimento_id, exame_id, amostra_id, nome_exame, material, data_coleta, tipo_processo, lab_apoio_id, protocolo_externo",
      )
      .eq("id", atendimentoExameId)
      .maybeSingle();

    if (exErr || !exRow) {
      showError(exErr, { scope: "etiqueta.exameNaoEncontrado", silent: true });
      toast.error("Não foi possível localizar o exame para etiqueta.");
      return;
    }

    // 2) Em paralelo: amostra (se existir), atendimento, catálogo do exame,
    //    demais exames do mesmo tubo (para listar na observação) e lab apoio (se houver)
    const [amostraRes, atRes, catRes, irmaosRes, labRes] = await Promise.all([
      exRow.amostra_id
        ? supabase
            .from("amostras")
            .select("codigo_barra, data_coleta, tipo_material, observacao")
            .eq("id", exRow.amostra_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null } as const),
      supabase
        .from("atendimentos")
        .select("protocolo, paciente_nome, paciente_nascimento")
        .eq("id", exRow.atendimento_id)
        .maybeSingle(),
      exRow.exame_id
        ? supabase
            .from("exames_catalogo")
            .select("quantidade_etiquetas")
            .eq("id", exRow.exame_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null } as const),
      exRow.amostra_id
        ? supabase
            .from("atendimento_exames")
            .select("id, nome_exame, lab_apoio_id, tipo_processo")
            .eq("amostra_id", exRow.amostra_id)
            .neq("id", exRow.id)
        : Promise.resolve({ data: [] as Array<{ id: number; nome_exame: string }>, error: null } as const),
      exRow.lab_apoio_id
        ? supabase
            .from("labs_apoio")
            .select("nome")
            .eq("id", exRow.lab_apoio_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null } as const),
    ]);

    const amostra = amostraRes.data;
    const atendimento = atRes.data;
    const catalogo = catRes.data;
    const irmaosRaw = (irmaosRes.data ?? []) as Array<{
      id: number;
      nome_exame: string;
      lab_apoio_id?: string | null;
      tipo_processo?: string | null;
    }>;
    // Defesa em profundidade: só listamos como irmãos os exames com mesmo destino.
    // Mesmo que dados antigos tenham agrupamento conflitante, NUNCA misturamos labs na etiqueta.
    const irmaos = irmaosRaw.filter(
      (i) =>
        (i.tipo_processo ?? "INTERNO") === ((exRow as { tipo_processo?: string }).tipo_processo ?? "INTERNO") &&
        (i.lab_apoio_id ?? null) === (exRow.lab_apoio_id ?? null),
    );
    const labApoioNome = (labRes.data as { nome?: string } | null)?.nome ?? null;
    // Nome do tenant (laboratório próprio) — síncrono se já cacheado, senão resolve agora
    const laboratorioPropriaNome =
      getCachedTenantNome() ?? (await getCurrentTenantNome().catch(() => "INTERNO"));

    // 3) Resolve campos da etiqueta
    const codigoBarra = amostra?.codigo_barra
      ?? `S/AMOSTRA-${exRow.id}`; // fallback (ex.: ainda não coletado)
    const dataColeta = amostra?.data_coleta || exRow.data_coleta || new Date().toISOString();
    const material = amostra?.tipo_material || exRow.material || "—";
    const copias = Math.max(1, Math.min(20, Number(catalogo?.quantidade_etiquetas ?? 1)));
    const pacienteIdade = atendimento?.paciente_nascimento
      ? formatIdadeDetalhada(isoToBR(atendimento.paciente_nascimento))
      : undefined;

    // 4) Observação: lista exames irmãos (mesmo tubo) + observação original
    const partesObs: string[] = [];
    if (irmaos.length > 0) {
      const nomes = irmaos.map((i) => i.nome_exame).join(", ");
      partesObs.push(`+ ${irmaos.length} exame(s): ${nomes}`);
    }
    if (amostra?.observacao) partesObs.push(amostra.observacao);
    const observacao = partesObs.join(" · ") || undefined;

    imprimirEtiquetaAmostra({
      codigoBarra,
      protocoloAtendimento: atendimento?.protocolo,
      pacienteNome: atendimento?.paciente_nome,
      pacienteIdade,
      material,
      dataColeta,
      observacao,
      copias,
      // Roteamento multi-lab (Fase 1): destino visualmente claro
      tipoProcesso: (exRow as { tipo_processo?: string }).tipo_processo ?? "INTERNO",
      labApoioId: exRow.lab_apoio_id ?? null,
      labApoioNome,
      laboratorioPropriaNome,
      protocoloExterno: (exRow as { protocolo_externo?: string | null }).protocolo_externo ?? null,
    });
  } catch (err) {
    showError(err, { scope: "etiqueta.falhaInesperada", silent: true });
    toast.error("Não foi possível imprimir a etiqueta.");
  }
}