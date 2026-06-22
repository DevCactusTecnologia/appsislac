/**
 * SorotecaShell — wrapper visual unificado das páginas da Soroteca.
 *
 * Padronizado com o Super Admin: usa PageHeader (Linear/Vercel),
 * tokens semânticos (Inter, primary #4D41F3), botões rounded-full
 * e container `max-w-[1200px] mx-auto`.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/superadmin/PageHeader";
import { SorotecaNav } from "./SorotecaNav";

interface SorotecaShellProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  maxWidth?: "max-w-3xl" | "max-w-5xl" | "max-w-[1200px]";
  className?: string;
  children: ReactNode;
}

export function SorotecaShell({
  title,
  description,
  actions,
  maxWidth = "max-w-[1200px]",
  className,
  children,
}: SorotecaShellProps) {
  return (
    <div className={cn("space-y-6 mx-auto px-4 sm:px-6 pb-10 pt-6", maxWidth, className)}>
      <PageHeader title={title} description={description} actions={actions} />
      <SorotecaNav />
      {children}
    </div>
  );
}

export default SorotecaShell;
