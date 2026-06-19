import { CheckCircle2 } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";

interface SuccessOverlayProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  buttonLabel?: string;
}

/**
 * Shared centered success overlay used on completion of operational queues
 * (coleta, análise, resultados). Flat dialog with backdrop blur.
 */
const SuccessOverlay = ({
  open,
  onClose,
  title,
  description,
  buttonLabel = "Continuar",
}: SuccessOverlayProps) => {
  useBodyScrollLock(open);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-foreground/40 backdrop-blur-[6px]"
        onClick={onClose}
      />
      <div className="relative bg-card rounded-xl border border-border shadow-elevation-lg w-full max-w-md p-8 animate-fade-in-up">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-[hsl(var(--status-success-bg))] flex items-center justify-center mb-5">
            <CheckCircle2 className="h-8 w-8 text-[hsl(var(--status-success))]" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground mb-6">{description}</p>
          )}
          <button
            onClick={onClose}
            className="h-10 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SuccessOverlay;
