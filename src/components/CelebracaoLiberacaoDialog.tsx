import { Trophy, X, PartyPopper, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";

interface CelebracaoLiberacaoDialogProps {
  open: boolean;
  onClose: () => void;
  totalLiberados: number;
  protocolo: string;
  onImprimir?: () => void;
}

/**
 * Modal de celebração exibido quando TODOS os exames foram liberados.
 * Disparado em conjunto com o efeito de confetes.
 */
const CelebracaoLiberacaoDialog = ({
  open,
  onClose,
  totalLiberados,
  protocolo,
  onImprimir,
}: CelebracaoLiberacaoDialogProps) => {
  useBodyScrollLock(open);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            className="absolute inset-0 bg-foreground/45 backdrop-blur-[8px]"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          />
          <motion.div
            className="relative w-full max-w-lg max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] flex flex-col bg-card rounded-3xl border border-border shadow-[0_32px_96px_-16px_hsl(var(--foreground)/0.28)] overflow-hidden"
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 6 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-20 h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all duration-200"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Header com gradiente sutil */}
            <div className="relative px-6 pt-10 pb-7 text-center overflow-hidden">
              {/* Halo radial */}
              <div
                aria-hidden
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(ellipse at top, hsl(var(--status-success) / 0.14), transparent 65%)",
                }}
              />
              {/* Sparkles decorativos */}
              <Sparkles
                className="absolute top-6 left-8 h-4 w-4 opacity-60"
                style={{ color: "hsl(var(--status-warning))" }}
              />
              <Sparkles
                className="absolute top-12 right-12 h-3 w-3 opacity-50"
                style={{ color: "hsl(var(--status-success))" }}
              />
              <PartyPopper
                className="absolute bottom-4 left-12 h-4 w-4 opacity-50 -rotate-12"
                style={{ color: "hsl(var(--primary))" }}
              />

              {/* Troféu com anéis concêntricos */}
              <div className="relative mx-auto mb-5 h-24 w-24">
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{ backgroundColor: "hsl(var(--status-success) / 0.08)" }}
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                />
                <div
                  className="absolute inset-2 rounded-full"
                  style={{ backgroundColor: "hsl(var(--status-success) / 0.14)" }}
                />
                <div
                  className="absolute inset-4 rounded-full"
                  style={{ backgroundColor: "hsl(var(--status-success) / 0.22)" }}
                />
                <motion.div
                  className="absolute inset-6 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: "hsl(var(--status-success))",
                    color: "hsl(var(--primary-foreground))",
                  }}
                  initial={{ rotate: -10, scale: 0.6 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ delay: 0.05, type: "spring", stiffness: 240, damping: 14 }}
                >
                  <Trophy className="h-7 w-7" />
                </motion.div>
              </div>

              <h3 className="relative text-[20px] font-semibold text-foreground tracking-tight leading-snug">
                Atendimento finalizado!
              </h3>
              <p className="relative text-[13px] text-muted-foreground mt-2 max-w-sm mx-auto leading-relaxed">
                Todos os exames deste atendimento foram assinados e liberados com sucesso.
              </p>

              {/* Chip de resumo */}
              <div className="relative mt-5 inline-flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-muted/60 border border-border">
                <div
                  className="h-7 w-7 rounded-xl flex items-center justify-center"
                  style={{
                    backgroundColor: "hsl(var(--status-success) / 0.16)",
                    color: "hsl(var(--status-success))",
                  }}
                >
                  <Trophy className="h-3.5 w-3.5" />
                </div>
                <div className="text-left">
                  <div className="text-[11px] text-muted-foreground leading-none">
                    Protocolo {protocolo}
                  </div>
                  <div className="text-[13px] font-semibold text-foreground mt-1 leading-none">
                    {totalLiberados} {totalLiberados === 1 ? "exame liberado" : "exames liberados"}
                  </div>
                </div>
              </div>
            </div>

            <div className="h-px bg-border/60" />

            {/* Footer */}
            <div className="px-6 py-5 flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="px-5 py-2.5 border border-border rounded-xl text-sm font-medium text-foreground hover:bg-accent transition-colors"
              >
                Fechar
              </button>
              {onImprimir && (
                <button
                  onClick={onImprimir}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Imprimir laudo
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CelebracaoLiberacaoDialog;
