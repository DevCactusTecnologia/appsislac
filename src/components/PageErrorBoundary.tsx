import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

interface Props {
  children: ReactNode;
  /** Nome da página/área para o log */
  scope?: string;
  /** Mensagem amigável exibida ao usuário */
  fallbackTitle?: string;
  fallbackDescription?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Boundary genérico para páginas: evita tela branca quando algo dentro
 * (Realtime, hooks, etc.) lança um erro. Mostra um fallback com retry.
 */
export default class PageErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    logger.error(this.props.scope ?? "PageErrorBoundary", error.message, {
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
        <div className="bg-card border border-border rounded-lg p-8 flex flex-col items-center text-center gap-3">
          <div className="size-12 rounded-md bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <h2 className="text-base font-semibold">
            {this.props.fallbackTitle ?? "Algo deu errado ao carregar a página"}
          </h2>
          <p className="text-xs text-muted-foreground max-w-md">
            {this.props.fallbackDescription ??
              "Ocorreu um erro inesperado. Você pode tentar novamente ou recarregar a página."}
          </p>
          {this.state.error?.message && (
            <pre className="text-[10.5px] text-muted-foreground bg-muted/40 rounded-md px-3 py-2 max-w-lg overflow-auto">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex items-center gap-2 mt-2">
            <Button size="sm" variant="outline" onClick={this.handleRetry}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Tentar novamente
            </Button>
            <Button size="sm" onClick={() => window.location.reload()}>
              Recarregar página
            </Button>
          </div>
        </div>
      </div>
    );
  }
}