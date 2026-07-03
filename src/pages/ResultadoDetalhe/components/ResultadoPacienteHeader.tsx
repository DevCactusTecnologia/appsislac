// Header do paciente na tela de Resultado.
// Extraído mecanicamente de ResultadoDetalhe.tsx (Onda 2) — comportamento e props
// preservados 1:1. Usado nas duas variantes de layout (stacked + desktop split).
import { Printer } from "lucide-react";
import PacienteHeaderCard, { type PacienteHeaderAction } from "@/components/operacional/PacienteHeaderCard";
import { PacienteFlagsChips } from "@/components/operacional/PacienteFlagsChips";
import MaisAcoesMenu from "@/components/resultado/MaisAcoesMenu";
import WhatsappActionButton from "@/components/whatsapp/WhatsappActionButton";
import type { Exame, Paciente } from "../types";

export interface ResultadoPacienteHeaderProps {
  paciente: Paciente;
  nascimentoBR: string;
  statusType: React.ComponentProps<typeof PacienteHeaderCard>["statusType"];
  modoConsulta: boolean;
  podeImprimirTodos: boolean;
  onImprimirTodos: (exames: Exame[]) => void;
  pacienteJejum: boolean;
  pacientePrioridade: "normal" | "urgencia" | "emergencia";
  todosLiberados: boolean;
  onEnviarWhatsapp: () => void;
  temExameSelecionado: boolean;
  onAuditoria: () => void;
  onCritico: () => void;
  onEntrega: () => void;
}

export function ResultadoPacienteHeader({
  paciente,
  nascimentoBR,
  statusType,
  modoConsulta,
  podeImprimirTodos,
  onImprimirTodos,
  pacienteJejum,
  pacientePrioridade,
  todosLiberados,
  onEnviarWhatsapp,
  temExameSelecionado,
  onAuditoria,
  onCritico,
  onEntrega,
}: ResultadoPacienteHeaderProps) {
  return (
    <PacienteHeaderCard
      nome={paciente.nome}
      sexo={paciente.sexo}
      nascimentoBR={nascimentoBR}
      idade={paciente.idade}
      protocolo={paciente.protocolo}
      statusLabel={paciente.statusGeral}
      statusType={statusType}
      actionsInline={modoConsulta}
      actions={([
        {
          key: "imprimir",
          label: "Imprimir todos",
          icon: <Printer className="h-4 w-4" />,
          onClick: () => onImprimirTodos(paciente.exames),
          variant: "primary",
          title: modoConsulta ? "Imprime apenas exames Assinados e Liberados" : undefined,
          disabled: !podeImprimirTodos,
        },
      ]) as PacienteHeaderAction[]}
      actionsExtraLeft={
        <>
          <PacienteFlagsChips jejum={pacienteJejum} prioridade={pacientePrioridade} />
          {!modoConsulta && todosLiberados && (
            <WhatsappActionButton onClick={onEnviarWhatsapp} title="Enviar mensagem pelo WhatsApp" />
          )}
        </>
      }
      actionsExtraRight={
        <MaisAcoesMenu
          modoConsulta={modoConsulta}
          semExameSelecionado={!temExameSelecionado}
          onAuditoria={onAuditoria}
          onCritico={onCritico}
          onEntrega={onEntrega}
        />
      }
    />
  );
}

export default ResultadoPacienteHeader;
