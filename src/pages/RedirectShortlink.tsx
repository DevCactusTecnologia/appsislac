import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, AlertCircle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Página pública /p/:codigo — resolve o shortlink e redireciona para o
 * PDF assinado. Não exige login. Mostra estados de erro (link expirado,
 * inexistente) com mensagens amigáveis.
 */
const RedirectShortlink = () => {
  const { codigo } = useParams<{ codigo: string }>();
  const [status, setStatus] = useState<"loading" | "expired" | "notfound" | "error">(
    "loading",
  );

  useEffect(() => {
    if (!codigo || codigo.startsWith(":")) {
      setStatus("notfound");
      return;
    }
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/comprovante-resolve?codigo=${encodeURIComponent(codigo)}`;
    (async () => {
      try {
        const r = await fetch(url, {
          headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        });
        if (r.status === 404) return setStatus("notfound");
        if (r.status === 410) return setStatus("expired");
        if (!r.ok) return setStatus("error");
        const data = (await r.json()) as { url?: string };
        if (!data?.url) return setStatus("error");
        window.location.replace(data.url);
      } catch {
        setStatus("error");
      }
    })();
  }, [codigo]);

  const messages: Record<typeof status, { title: string; desc: string; icon: React.ReactNode }> = {
    loading: {
      title: "Abrindo comprovante...",
      desc: "Estamos recuperando seu PDF, só um instante.",
      icon: <Loader2 className="h-8 w-8 text-primary animate-spin" />,
    },
    expired: {
      title: "Link expirado",
      desc: "Este link já passou da validade. Solicite um novo ao laboratório.",
      icon: <AlertCircle className="h-8 w-8 text-status-warning" />,
    },
    notfound: {
      title: "Link não encontrado",
      desc: "O código informado não existe ou foi removido.",
      icon: <AlertCircle className="h-8 w-8 text-status-danger" />,
    },
    error: {
      title: "Não foi possível abrir",
      desc: "Tente novamente em instantes ou entre em contato com o laboratório.",
      icon: <AlertCircle className="h-8 w-8 text-status-danger" />,
    },
  };
  const m = messages[status];

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center space-y-4">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mx-auto">
          {status === "loading" ? m.icon : <FileText className="h-8 w-8 text-primary" />}
        </div>
        <div className="space-y-2">
          <h1 className="text-lg font-semibold text-foreground">{m.title}</h1>
          <p className="text-sm text-muted-foreground">{m.desc}</p>
        </div>
        {status === "loading" && (
          <div className="flex items-center justify-center pt-2">{m.icon}</div>
        )}
        {status !== "loading" && (
          <div className="pt-2">
            <Button asChild className="w-full">
              <Link to="/login">Voltar ao login</Link>
            </Button>
          </div>
        )}
      </div>
    </main>
  );
};

export default RedirectShortlink;