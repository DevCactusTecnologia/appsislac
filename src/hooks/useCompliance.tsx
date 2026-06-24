/**
 * LGPD + RDC COMPLIANCE - HOOK REACT
 * 
 * Uso simples:
 * const { assinarResultado, solicitarConsentimento, deletarPaciente } = useCompliance();
 */

import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useCompliance() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ========================================================================
  // 1. ASSINAR RESULTADO (RDC)
  // ========================================================================

  const assinarResultado = useCallback(
    async (resultadoId: number, aprovadoPor?: string) => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: err } = await supabase.functions.invoke(
          "sign-resultado",
          {
            body: {
              resultado_id: resultadoId,
              aprovado_por: aprovadoPor,
            },
          }
        );

        if (err) {
          setError(err.message);
          toast.error(`Erro ao assinar: ${err.message}`);
          return null;
        }

        toast.success("✅ Resultado assinado (RDC Anvisa)");
        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro desconhecido";
        setError(msg);
        toast.error(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ========================================================================
  // 2. SOLICITAR CONSENTIMENTO (LGPD)
  // ========================================================================

  const solicitarConsentimento = useCallback(
    async (
      pacienteId: number,
      tipo: "coleta_dados" | "processamento" | "compartilhamento",
      consentido: boolean
    ) => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: err } = await supabase.functions.invoke(
          "lgpd-consentimento",
          {
            body: {
              paciente_id: pacienteId,
              tipo,
              consentido,
            },
          }
        );

        if (err) {
          setError(err.message);
          toast.error(`Erro: ${err.message}`);
          return null;
        }

        toast.success(
          consentido
            ? `✅ Consentimento de "${tipo}" registrado (LGPD)`
            : `❌ Consentimento revogado`
        );
        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro desconhecido";
        setError(msg);
        toast.error(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ========================================================================
  // 3. DELETAR PACIENTE (LGPD - Direito ao esquecimento)
  // ========================================================================

  const deletarPaciente = useCallback(
    async (
      pacienteId: number,
      motivo: "solicitacao_paciente" | "compliance" | "inativo"
    ) => {
      // Confirmação obrigatória
      const confirmado = window.confirm(
        `⚠️ ATENÇÃO: Você está prestes a deletar TODOS os dados do paciente (ID: ${pacienteId}).\n` +
          `Isso inclui atendimentos, resultados e consentimentos.\n` +
          `Esta ação é IRREVERSÍVEL!\n\n` +
          `Motivo: ${motivo}\n\n` +
          `Tem certeza?`
      );

      if (!confirmado) {
        toast.error("Deleção cancelada");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const { data, error: err } = await supabase.functions.invoke(
          "lgpd-deletar-paciente",
          {
            body: {
              paciente_id: pacienteId,
              motivo,
              confirmar: true,
            },
          }
        );

        if (err) {
          setError(err.message);
          toast.error(`Erro: ${err.message}`);
          return null;
        }

        toast.success(
          `✅ Paciente deletado (LGPD - Direito ao esquecimento)\n` +
          `Registros deletados: ${data.registros_deletados}`
        );
        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro desconhecido";
        setError(msg);
        toast.error(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ========================================================================
  // 4. GERAR RELATÓRIO DE AUDITORIA
  // ========================================================================

  const gerarRelatorio = useCallback(
    async (
      pacienteId?: number,
      tipo: "LGPD" | "RDC" | "COMPLETO" = "COMPLETO"
    ) => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: err } = await supabase.functions.invoke(
          "lgpd-auditoria-relatorio",
          {
            body: {
              paciente_id: pacienteId,
              tipo,
              data_inicio: new Date(
                Date.now() - 30 * 24 * 60 * 60 * 1000
              ).toISOString(),
              data_fim: new Date().toISOString(),
            },
          }
        );

        if (err) {
          setError(err.message);
          toast.error(`Erro ao gerar relatório: ${err.message}`);
          return null;
        }

        toast.success("✅ Relatório gerado");
        return data.relatorio;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro desconhecido";
        setError(msg);
        toast.error(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ========================================================================
  // 5. VISUALIZAR AUDITORIA DE UM PACIENTE
  // ========================================================================

  const visualizarAuditoria = useCallback(async (pacienteId: number) => {
    setLoading(true);
    setError(null);

    try {
      // Buscar acessos ao resultado
      const { data: acessos, error: err1 } = await supabase
        .from("resultado_acesso_log")
        .select("*")
        .eq("resultado_id", pacienteId)
        .order("data_acesso", { ascending: false });

      if (err1) throw err1;

      // Buscar consentimentos
      const { data: consentimentos, error: err2 } = await supabase
        .from("consentimento_paciente")
        .select("*")
        .eq("paciente_id", pacienteId);

      if (err2) throw err2;

      return {
        acessos: acessos || [],
        consentimentos: consentimentos || [],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    // Funções
    assinarResultado,
    solicitarConsentimento,
    deletarPaciente,
    gerarRelatorio,
    visualizarAuditoria,

    // Estados
    loading,
    error,
  };
}

// ============================================================================
// COMPONENTE EXEMPLO 1: Assinar Resultado
// ============================================================================

export function ComplianceResultadoCard({
  resultadoId,
}: {
  resultadoId: number;
}) {
  const { assinarResultado, loading } = useCompliance();

  const handleAssinar = async () => {
    await assinarResultado(resultadoId);
  };

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-bold mb-2">RDC - Assinatura do Resultado</h3>
      <p className="text-sm text-gray-600 mb-4">
        Após assinar, o resultado não poderá ser editado.
      </p>
      <button
        onClick={handleAssinar}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400"
      >
        {loading ? "Assinando..." : "🔏 Assinar Resultado"}
      </button>
    </div>
  );
}

// ============================================================================
// COMPONENTE EXEMPLO 2: Consentimento LGPD
// ============================================================================

export function ComplianceConsentimentoCard({
  pacienteId,
}: {
  pacienteId: number;
}) {
  const { solicitarConsentimento, loading } = useCompliance();
  const [consentidos, setConsentidos] = useState({
    coleta_dados: false,
    processamento: false,
    compartilhamento: false,
  });

  const handleToggle = async (
    tipo: "coleta_dados" | "processamento" | "compartilhamento"
  ) => {
    const novoStatus = !consentidos[tipo];
    await solicitarConsentimento(pacienteId, tipo, novoStatus);
    if (!loading) {
      setConsentidos({ ...consentidos, [tipo]: novoStatus });
    }
  };

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-bold mb-4">LGPD - Consentimento do Paciente</h3>

      <label className="flex items-center mb-3">
        <input
          type="checkbox"
          checked={consentidos.coleta_dados}
          onChange={() => handleToggle("coleta_dados")}
          disabled={loading}
          className="mr-2"
        />
        <span className="text-sm">
          Coleta de dados pessoais
        </span>
      </label>

      <label className="flex items-center mb-3">
        <input
          type="checkbox"
          checked={consentidos.processamento}
          onChange={() => handleToggle("processamento")}
          disabled={loading}
          className="mr-2"
        />
        <span className="text-sm">
          Processamento de resultados
        </span>
      </label>

      <label className="flex items-center">
        <input
          type="checkbox"
          checked={consentidos.compartilhamento}
          onChange={() => handleToggle("compartilhamento")}
          disabled={loading}
          className="mr-2"
        />
        <span className="text-sm">
          Compartilhamento com terceiros (se necessário)
        </span>
      </label>
    </div>
  );
}

// ============================================================================
// COMPONENTE EXEMPLO 3: Deletar Paciente (LGPD)
// ============================================================================

export function ComplianceDeletarPacienteCard({
  pacienteId,
  pacienteNome,
}: {
  pacienteId: number;
  pacienteNome: string;
}) {
  const { deletarPaciente, loading } = useCompliance();

  const handleDeletar = async () => {
    await deletarPaciente(pacienteId, "solicitacao_paciente");
  };

  return (
    <div className="p-4 border border-red-300 bg-red-50 rounded-lg">
      <h3 className="font-bold text-red-600 mb-2">
        LGPD - Direito ao Esquecimento
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        O paciente pode solicitar a deleção de todos seus dados.
        Esta ação é IRREVERSÍVEL.
      </p>
      <button
        onClick={handleDeletar}
        disabled={loading}
        className="px-4 py-2 bg-red-600 text-white rounded disabled:bg-gray-400"
      >
        {loading ? "Deletando..." : "🗑️ Deletar todos os dados"}
      </button>
    </div>
  );
}
