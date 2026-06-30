/**
 * Registra na auditoria a liberação de um resultado contendo valor(es) crítico(s).
 *
 * Insere uma linha em `atendimento_audit` com a flag `resultado_critico=true`,
 * permitindo filtrar e listar liberações sensíveis no painel de auditoria.
 *
 * Falhas aqui NÃO devem bloquear a liberação do exame — apenas logam no console.
 */
import { db as supabase } from "@/runtime/db";
import { resolveAtendimentoIdByProtocolo } from "./protocoloLookup";
import { showError } from "@/lib/showError";
import { persistOneOrThrow } from "@/lib/persist";

export interface RegistrarLiberacaoCriticaParams {
  /**
   * ID numérico do atendimento. Se 0/ausente, será resolvido via `protocolo`.
   * A função LANÇA se nem `atendimentoId` nem `protocolo` resultarem em ID válido.
   */
  atendimentoId?: number;
  registroId: number; // id da row em atendimento_exames
  protocolo: string;
  pacienteNome: string;
  exameNome: string;
  parametrosCriticos: Array<{ nome: string; valor: string; nivel: "critico_baixo" | "critico_alto" }>;
  justificativa: string;
  conduta: string;
  notificouMedico: boolean;
}

export async function registrarLiberacaoCritica(
  p: RegistrarLiberacaoCriticaParams,
): Promise<void> {
  // Validação de IDs FORA do try/catch para que o erro propague à UI.
  let atendimentoIdFinal = p.atendimentoId && p.atendimentoId > 0 ? p.atendimentoId : 0;
  if (atendimentoIdFinal === 0 && p.protocolo) {
    const resolved = await resolveAtendimentoIdByProtocolo(p.protocolo);
    if (resolved) atendimentoIdFinal = resolved;
  }
  if (atendimentoIdFinal === 0) {
    throw new Error(
      `[criticoAudit] não foi possível resolver atendimentoId para protocolo="${p.protocolo}"`,
    );
  }

  try {
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;

    // Tenant via profiles (mesmo padrão dos outros stores)
    let tenantId: string | null = null;
    if (user) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .maybeSingle();
      tenantId = prof?.tenant_id ?? null;
    }

    const detalhes = p.parametrosCriticos
      .map((x) => `${x.nome}: ${x.valor} [${x.nivel === "critico_baixo" ? "PÂNICO BAIXO" : "PÂNICO ALTO"}]`)
      .join("; ");

    const justificativaFinal = [
      `🚨 RESULTADO CRÍTICO LIBERADO`,
      `Parâmetros: ${detalhes}`,
      `Justificativa/Conduta: ${p.conduta}`,
      p.notificouMedico ? "Médico solicitante notificado: SIM" : "Médico solicitante notificado: NÃO",
      p.justificativa ? `Observações: ${p.justificativa}` : "",
    ].filter(Boolean).join(" | ");

    await persistOneOrThrow(
      supabase.from("atendimento_audit").insert({
        entidade: "exame",
        operacao: "UPDATE",
        acao: "Resultado crítico liberado",
        atendimento_id: atendimentoIdFinal,
        registro_id: p.registroId,
        protocolo: p.protocolo,
        paciente_nome: p.pacienteNome,
        exame_nome: p.exameNome,
        changed_by: user?.id ?? null,
        changed_by_email: user?.email ?? "",
        tenant_id: tenantId,
        justificativa: justificativaFinal,
        pos_finalizacao: false,
        resultado_critico: true,
        new_value: { parametros_criticos: p.parametrosCriticos },
      }),
      "criticoAudit.registrar",
    );
  } catch (e) {
    showError(e, { scope: "criticoAudit.exception", silent: true });
  }
}
