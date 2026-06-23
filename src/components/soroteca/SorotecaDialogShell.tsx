/**
 * Soroteca — Shared dialog primitives.
 *
 * Padrão flat tenant (mesmo de SuperAdminPlanos / NovaEntrada):
 *  - DialogContent com p-0 gap-0, max-h-[92vh] overflow-y-auto
 *  - Header com ícone + título + descrição, separador inferior
 *  - Corpo em px-6 py-5 space-y-6
 *  - Footer fixado embaixo com separador superior
 */

import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function SorotecaDialogHeader({
  icon: Icon,
  title,
  description,
  right,
  tone = "primary",
}: {
  icon: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  right?: React.ReactNode;
  tone?: "primary" | "destructive" | "success" | "warning" | "muted";
}) {
  const toneClasses: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    destructive: "bg-destructive/10 text-destructive",
    success: "bg-emerald-500/10 text-emerald-600",
    warning: "bg-amber-500/10 text-amber-600",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
            toneClasses[tone],
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <DialogTitle className="text-base font-bold tracking-tight">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-xs mt-0.5">{description}</DialogDescription>
          )}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
    </DialogHeader>
  );
}

export function SorotecaDialogBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("px-6 py-5 space-y-6", className)}>{children}</div>;
}

export function SorotecaDialogFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-6 py-4 border-t border-border flex flex-col-reverse sm:flex-row sm:justify-end gap-2 bg-muted/20">
      {children}
    </div>
  );
}

export function Field({
  label,
  hint,
  htmlFor,
  required,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={htmlFor}
        className="text-[11px] font-semibold text-foreground uppercase tracking-wider flex items-center gap-1"
      >
        {label}
        {required && <span className="text-destructive">*</span>}
        {hint && (
          <span className="ml-1 text-[10px] text-muted-foreground font-normal normal-case tracking-normal">
            ({hint})
          </span>
        )}
      </Label>
      {children}
    </div>
  );
}

export function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between border-b border-border/60 pb-2">
        <h4 className="text-xs font-bold uppercase tracking-widest text-foreground">{title}</h4>
        {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
