// Placeholder temporário exibido onde o antigo editor de texto rico era usado.
// O editor anterior foi removido por completo; um novo editor será integrado.
// Este componente apenas exibe um aviso visual e ignora `content`/`onChange`
// para manter as telas que o referenciavam funcionais (sem quebrar imports).

import { ReactNode } from "react";
import { Construction } from "lucide-react";

export interface EditorPlaceholderProps {
  content?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  placeholders?: unknown;
  toolbarExtras?: ReactNode;
  defaultFontFamily?: unknown;
}

const EditorPlaceholder = (_props: EditorPlaceholderProps) => {
  return (
    <div className="a4-stage relative min-w-0">
      <div className="prose-mapa a4-sheet text-[13px] leading-snug flex flex-col items-center justify-center text-center gap-3 py-16">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
          <Construction className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Editor sendo substituído</p>
          <p className="text-xs text-muted-foreground max-w-sm">
            O editor de texto anterior foi removido. Um novo editor será instalado em breve.
          </p>
        </div>
      </div>
    </div>
  );
};

export default EditorPlaceholder;
