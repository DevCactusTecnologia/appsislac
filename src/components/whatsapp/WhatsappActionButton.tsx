// WhatsApp 2.0 — Fase 3F.2
// ------------------------------------------------------------------
// Componente canônico ÚNICO para qualquer disparo manual de WhatsApp
// no SISLAC. Garante consistência visual e textual em todo o sistema.
//
// PROIBIDO criar variantes paralelas. Qualquer botão de WhatsApp na
// UI operacional deve reutilizar este componente.
//
// Padrão oficial:
//   Label   : "Enviar WhatsApp"
//   Tooltip : "Enviar mensagem pelo WhatsApp"
//   Cor     : Verde WhatsApp — hsl(142, 70%, 45%)
//   Ícone   : Send (lucide)
//
// Estados:
//   idle    → "Enviar WhatsApp"
//   loading → "Enviando..."
//   success → "WhatsApp enviado"
//   error   → "Falha no envio"
//
// O componente é fire-and-forget visual: o consumidor controla o
// status via prop `state` ou deixa o componente gerenciar via
// `onSendAsync` (callback assíncrono que retorna ok/erro).

import { useState } from "react";
import { Loader2, Send, Check, AlertTriangle } from "lucide-react";

export type WhatsappActionState = "idle" | "loading" | "success" | "error";

export interface WhatsappActionButtonProps {
  /** Callback assíncrono. Se resolver normalmente, vira sucesso; se rejeitar, vira erro. */
  onSendAsync?: () => Promise<void>;
  /** Alternativa síncrona — o consumidor controla o estado. */
  onClick?: () => void;
  /** Estado controlado externamente (opcional). */
  state?: WhatsappActionState;
  /** Esconde o rótulo em viewports estreitos (mantém só o ícone). */
  responsive?: boolean;
  /** Modo compacto: apenas ícone, altura/largura fixa (9). */
  iconOnly?: boolean;
  /** Variante visual — `full` (verde sólido) ou `outline` (verde discreto). */
  variant?: "full" | "outline";
  /** Tamanho do botão — `md` (h-9, padrão) ou `lg` (h-11). */
  size?: "md" | "lg";
  /** Desabilita o botão. */
  disabled?: boolean;
  /** Tooltip customizado — default: "Enviar mensagem pelo WhatsApp". */
  title?: string;
  /**
   * Rótulo customizado para o estado `idle` (ex.: "Enviar Comprovante
   * de Pagamento"). Mantém o padrão visual canônico, alterando apenas
   * o texto contextual conforme a aba/documento ativo. Estados
   * loading/success/error permanecem padronizados.
   */
  idleLabel?: string;
  className?: string;
}

const DEFAULT_LABEL: Record<WhatsappActionState, string> = {
  idle: "Enviar WhatsApp",
  loading: "Enviando...",
  success: "WhatsApp enviado",
  error: "Falha no envio",
};


export function WhatsappActionButton({
  onSendAsync,
  onClick,
  state: controlledState,
  responsive = true,
  iconOnly = false,
  variant = "full",
  size = "md",
  disabled = false,
  title = "Enviar mensagem pelo WhatsApp",
  idleLabel,
  className = "",
}: WhatsappActionButtonProps) {
  const [internalState, setInternalState] = useState<WhatsappActionState>("idle");
  const state = controlledState ?? internalState;
  const isLoading = state === "loading";
  const isDisabled = disabled || isLoading;
  const label = state === "idle" && idleLabel ? idleLabel : DEFAULT_LABEL[state];


  const handleClick = async () => {
    if (isDisabled) return;
    if (onSendAsync) {
      setInternalState("loading");
      try {
        await onSendAsync();
        setInternalState("success");
        setTimeout(() => setInternalState("idle"), 2500);
      } catch {
        setInternalState("error");
        setTimeout(() => setInternalState("idle"), 3000);
      }
    } else if (onClick) {
      onClick();
    }
  };

  const heightCls = size === "lg" ? "h-11" : "h-9";
  const paddingCls = iconOnly ? (size === "lg" ? "w-11" : "w-9") : size === "lg" ? "px-4" : "px-3 sm:px-4";

  const baseCls =
    `inline-flex items-center justify-center gap-1.5 ${heightCls} ${paddingCls} ` +
    `rounded-lg text-xs font-semibold transition-opacity shrink-0 ` +
    `disabled:opacity-50 disabled:cursor-not-allowed`;

  const colorCls =
    variant === "outline"
      ? "border border-[hsl(142,70%,45%)] text-[hsl(142,70%,38%)] bg-card hover:bg-[hsl(142,70%,45%)]/10"
      : "text-white bg-[hsl(142,70%,45%)] hover:opacity-90";

  const Icon =
    state === "loading"
      ? Loader2
      : state === "success"
        ? Check
        : state === "error"
          ? AlertTriangle
          : Send;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDisabled}
      title={title}
      aria-label={title}
      className={`${baseCls} ${colorCls} ${className}`}
    >
      <Icon className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
      {!iconOnly && (
        <span className={responsive ? "hidden sm:inline" : ""}>{LABEL[state]}</span>
      )}
    </button>
  );
}

export default WhatsappActionButton;
