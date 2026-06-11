import { Maximize2, Minimize2, X } from "lucide-react";
import { ReactNode, useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";

interface StandardDialogProps {
  open: boolean;
  onClose: () => void;
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  headerActions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "5xl" | "7xl";
  /** Show a "maximize / restore" button next to the close button. */
  allowMaximize?: boolean;
  /** Whether the dialog should start in maximized mode. */
  defaultMaximized?: boolean;
}

const widthMap: Record<NonNullable<StandardDialogProps["maxWidth"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "5xl": "max-w-5xl",
  "7xl": "max-w-[95vw] xl:max-w-7xl",
};

/**
 * Standardized modal dialog used across the app.
 * - External padding (p-4 sm:p-6)
 * - Fully rounded corners (rounded-3xl)
 * - Body scroll lock via useBodyScrollLock
 * - Smooth scale + fade animation via framer-motion
 * - Sticky header/footer with single internal scroll area
 */
const StandardDialog = ({
  open,
  onClose,
  icon,
  title,
  subtitle,
  headerActions,
  children,
  footer,
  maxWidth = "lg",
  allowMaximize = false,
  defaultMaximized = false,
}: StandardDialogProps) => {
  useBodyScrollLock(open);
  const [maximized, setMaximized] = useState(defaultMaximized);

  // Update maximized state when dialog is opened
  useEffect(() => {
    if (open) {
      setMaximized(defaultMaximized);
    }
  }, [open, defaultMaximized]);

  const containerPadding = maximized ? "p-0" : "p-4 sm:p-6";
  const panelClasses = maximized
    ? "relative w-full h-full max-w-none max-h-none flex flex-col bg-card rounded-none border-0 shadow-none overflow-hidden"
    : `relative w-full ${widthMap[maxWidth]} max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] flex flex-col bg-card rounded-3xl border border-border shadow-[0_24px_80px_-12px_hsl(var(--foreground)/0.18)] overflow-hidden`;

  return (
    <AnimatePresence>
      {open && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center ${containerPadding}`}>
          <motion.div
            className="absolute inset-0 bg-foreground/30 backdrop-blur-[3px]"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          />
          <motion.div
            className={panelClasses}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5">
              <div className="flex items-center gap-3 min-w-0">
                {icon && (
                  <div className="h-10 w-10 rounded-2xl bg-primary/8 flex items-center justify-center shrink-0">
                    {icon}
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="text-[15px] font-semibold text-foreground tracking-tight truncate">{title}</h2>
                  {subtitle && <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {headerActions}
                {allowMaximize && (
                  <button
                    onClick={() => setMaximized((v) => !v)}
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    aria-label={maximized ? "Restaurar tamanho" : "Maximizar"}
                    title={maximized ? "Restaurar" : "Maximizar"}
                  >
                    {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="h-px bg-border/50" />

            {/* Body (single scroll area) */}
            <div className="flex-1 overflow-y-auto">{children}</div>

            {footer && (
              <>
                <div className="h-px bg-border/50" />
                <div className="px-6 py-4 flex items-center justify-end gap-3">{footer}</div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default StandardDialog;
