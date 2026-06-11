import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Captura erros de carregamento de chunks lazy (ex: "Failed to fetch dynamically imported module")
 * que ocorrem quando o usuário está com uma versão antiga do app em cache após um deploy.
 */
export default class ChunkErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    const msg = error.message ?? "";
    const isChunk =
      msg.includes("Failed to fetch dynamically imported module") ||
      msg.includes("Loading chunk") ||
      msg.includes("Importing a module script failed") ||
      msg.includes("error loading dynamically imported module");

    if (!isChunk) return;

    try {
      const flag = "sislac-chunk-boundary-reload";
      if (sessionStorage.getItem(flag)) return;
      sessionStorage.setItem(flag, "1");
      window.location.reload();
    } catch {
      window.location.reload();
    }
  }

  private isChunkError(): boolean {
    const msg = this.state.error?.message ?? "";
    return (
      msg.includes("Failed to fetch dynamically imported module") ||
      msg.includes("Loading chunk") ||
      msg.includes("Importing a module script failed") ||
      msg.includes("error loading dynamically imported module")
    );
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const isChunk = this.isChunkError();

    return (
      <div className="flex items-center justify-center min-h-[60vh] px-6">
        <div className="max-w-md w-full bg-card border border-border rounded-lg p-8 text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">
            {isChunk ? "Atualização disponível" : "Algo deu errado"}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {isChunk
              ? "Não foi possível carregar esta página. Isso geralmente acontece após uma atualização do sistema. Recarregue para obter a versão mais recente."
              : "Ocorreu um erro inesperado ao carregar esta página. Tente novamente em instantes."}
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={this.handleReload}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Recarregar página
            </button>
            {!isChunk && (
              <button
                onClick={this.handleReset}
                className="px-4 py-2 rounded-lg bg-muted text-foreground text-sm font-medium hover:bg-muted/80 transition-colors"
              >
                Tentar novamente
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}
