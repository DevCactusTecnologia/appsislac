import { CheckCircle2, AlertTriangle, Info, X, Sparkles } from "lucide-react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";

type PopupVariant = "success" | "warning" | "danger" | "info" | "purple";

interface ResultadoPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: PopupVariant;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}

const variantConfig: Record<
  PopupVariant,
  { token: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  success: { token: "--status-success", Icon: CheckCircle2 },
  warning: { token: "--status-warning", Icon: AlertTriangle },
  danger: { token: "--status-danger", Icon: AlertTriangle },
  info: { token: "--status-info", Icon: Info },
  purple: { token: "--status-purple", Icon: Sparkles },
};

/**
 * Modal padrão para feedback de resultados.
 * Visual moderno, intuitivo e elegante:
 *  - halo concêntrico em torno do ícone com cor semântica
 *  - tipografia generosa com hierarquia clara
 *  - animação suave (scale + fade) via framer-motion
 *  - footer separado por divisor sutil
 */
const ResultadoPopup = ({
  open,
  onOpenChange,
  variant,
  title,
  description,
  children,
  footer,
}: ResultadoPopupProps) => {
  useBodyScrollLock(open);

  const { token, Icon } = variantConfig[variant];

  return createPortal((
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-[6px]"
            onClick={() => onOpenChange(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          />
          <motion.div
            className="relative w-full max-w-md max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] flex flex-col bg-card rounded-3xl border border-border shadow-[0_24px_80px_-12px_hsl(var(--foreground)/0.22)] overflow-hidden"
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 4 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Close button */}
            <button
              onClick={() => onOpenChange(false)}
              className="absolute top-4 right-4 z-10 h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all duration-200"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Header com halo concêntrico */}
            <div className="relative px-6 pt-9 pb-6 text-center">
              {/* Halo de fundo sutil */}
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-32 pointer-events-none"
                style={{
                  background: `radial-gradient(ellipse at top, hsl(var(${token}) / 0.10), transparent 70%)`,
                }}
              />

              {/* Ícone com anéis concêntricos */}
              <div className="relative mx-auto mb-4 h-20 w-20">
                <div
                  className="absolute inset-0 rounded-full"
                  style={{ backgroundColor: `hsl(var(${token}) / 0.08)` }}
                />
                <div
                  className="absolute inset-2 rounded-full"
                  style={{ backgroundColor: `hsl(var(${token}) / 0.14)` }}
                />
                <div
                  className="absolute inset-4 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: `hsl(var(${token}))`,
                    color: "hsl(var(--primary-foreground))",
                  }}
                >
                  <Icon className="h-6 w-6" />
                </div>
              </div>

              <h3 className="relative text-[17px] font-semibold text-foreground tracking-tight leading-snug">
                {title}
              </h3>
              {description && (
                <p className="relative text-[13px] text-muted-foreground mt-2 max-w-sm mx-auto leading-relaxed">
                  {description}
                </p>
              )}
            </div>

            {(children || footer) && (
              <>
                <div className="h-px bg-border/60" />
                <div className="px-6 py-5">
                  {children && <div>{children}</div>}
                  {footer && (
                    <div className={`flex items-center ${children ? "mt-5" : ""} justify-end gap-3`}>
                      {footer}
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  ), document.body);
};

export default ResultadoPopup;
