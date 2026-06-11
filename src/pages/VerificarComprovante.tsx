import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { 
  ShieldCheck, 
  ShieldAlert, 
  Building2, 
  FileText, 
  ArrowLeft,
  CheckCircle2,
  XCircle,
  HelpCircle,
  QrCode,
  ExternalLink
} from "lucide-react";
import { getLabConfig } from "@/data/labConfigStore";
import { codigoVerificacaoDeComprovante, type ComprovanteTipo } from "@/lib/comprovantes";
import { SEO } from "@/components/seo/SEO";

/**
 * Página pública de verificação do código impresso nos comprovantes.
 * Design moderno e intuitivo conforme solicitado.
 */
const VerificarComprovante = () => {
  const { codigo } = useParams<{ codigo: string }>();
  const lab = useMemo(() => getLabConfig(), []);
  const codigoNormalizado = (codigo ?? "").toUpperCase();

  const [tipo, setTipo] = useState<ComprovanteTipo>("pagamento");
  const [protocolo, setProtocolo] = useState("");
  const [pacienteNome, setPacienteNome] = useState("");
  const [data, setData] = useState("");
  const [total, setTotal] = useState("");
  const [resultado, setResultado] = useState<null | { ok: boolean; calculado: string }>(null);

  const verificar = (e: React.FormEvent) => {
    e.preventDefault();
    const totalNum = total.trim() ? Number(total.replace(",", ".")) : undefined;
    const calculado = codigoVerificacaoDeComprovante({
      tipo,
      protocolo: protocolo.trim(),
      paciente: { nome: pacienteNome.trim() },
      data: data.trim(),
      totais: totalNum != null && !Number.isNaN(totalNum) ? { total: totalNum } : undefined,
    });
    setResultado({ ok: calculado === codigoNormalizado, calculado });
  };

  const inputCls =
    "w-full px-4 py-3 bg-white border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/50 transition-all shadow-sm";
  const labelCls =
    "text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 block ml-1";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-10 px-4">
      <SEO
        title={`Verificação de Autenticidade — ${lab.nome || "Laboratório"}`}
        description="Portal de verificação de documentos emitidos eletronicamente."
      />

      <div className="w-full max-w-xl">
        <header className="text-center mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors mb-6 group"
          >
            <div className="h-8 w-8 rounded-full bg-white border border-border flex items-center justify-center group-hover:bg-primary/5 group-hover:border-primary/20">
              <ArrowLeft className="h-4 w-4" />
            </div>
            Voltar ao início
          </Link>

          <div className="flex flex-col items-center">
            <div className="h-20 w-20 rounded-2xl bg-white border border-border shadow-sm flex items-center justify-center overflow-hidden mb-4 p-2">
              {lab.logo ? (
                <img src={lab.logo} alt="Logo" className="max-h-full max-w-full object-contain" />
              ) : (
                <Building2 className="h-10 w-10 text-primary/40" />
              )}
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              Verificador SISLAC
            </h1>
            <p className="text-sm text-muted-foreground mt-1 font-medium">
              {lab.nome || "Laboratório"}
            </p>
          </div>
        </header>

        <main className="space-y-6">
          {/* Card de Código */}
          <div className="bg-white border border-border rounded-3xl p-8 shadow-xl shadow-slate-200/50 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <QrCode className="h-32 w-32" />
            </div>

            <div className="relative z-10 text-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest mb-4">
                <ShieldCheck className="h-3 w-3" /> Documento Eletrônico
              </span>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                Código de verificação
              </p>
              <div className="mt-2 py-4 px-6 bg-slate-50 rounded-2xl border border-dashed border-primary/20 inline-block mx-auto">
                <p className="font-mono text-3xl font-black text-primary tracking-widest">
                  {codigoNormalizado || "—"}
                </p>
              </div>
            </div>

            {/* Resultado da Verificação */}
            {resultado && (
              <div
                className={`mt-8 rounded-2xl border p-5 flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-500 ${
                  resultado.ok
                    ? "border-emerald-500/30 bg-emerald-50"
                    : "border-rose-500/30 bg-rose-50"
                }`}
              >
                <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                  resultado.ok ? "bg-emerald-500/20 text-emerald-600" : "bg-rose-500/20 text-rose-600"
                }`}>
                  {resultado.ok ? (
                    <CheckCircle2 className="h-6 w-6" />
                  ) : (
                    <XCircle className="h-6 w-6" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-base font-bold ${resultado.ok ? "text-emerald-800" : "text-rose-800"}`}>
                    {resultado.ok ? "Documento Autêntico" : "Dados Inválidos"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    {resultado.ok
                      ? "Este documento foi emitido originalmente pelo laboratório com estes dados exatos. A assinatura digital confere."
                      : "O código informado não corresponde aos dados digitados. Verifique se o nome, data e protocolo estão idênticos ao documento impresso."}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Card do Formulário */}
          <div className="bg-white border border-border rounded-3xl p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-8">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Confirmar Dados</h2>
                <p className="text-xs text-muted-foreground">Informe os campos abaixo para validar</p>
              </div>
            </div>

            <form onSubmit={verificar} className="space-y-5">
              <div className="space-y-2">
                <label className={labelCls}>Tipo de Documento</label>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as ComprovanteTipo)}
                  className={inputCls}
                >
                  <option value="pagamento">Recibo de Pagamento</option>
                  <option value="atendimento">Comprovante de Atendimento</option>
                  <option value="comparecimento">Declaração de Comparecimento</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className={labelCls}>Nº do Protocolo</label>
                  <input
                    type="text"
                    value={protocolo}
                    onChange={(e) => setProtocolo(e.target.value)}
                    placeholder="Ex: 2026-0001"
                    className={inputCls}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className={labelCls}>Data de Emissão</label>
                  <input
                    type="text"
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    placeholder="DD/MM/AAAA"
                    className={inputCls}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelCls}>Nome Completo do Paciente</label>
                <input
                  type="text"
                  value={pacienteNome}
                  onChange={(e) => setPacienteNome(e.target.value)}
                  placeholder="Exatamente como no documento"
                  className={inputCls}
                  required
                />
              </div>

              {tipo === "pagamento" && (
                <div className="space-y-2">
                  <label className={labelCls}>Valor Total (R$)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-sm">R$</span>
                    <input
                      type="text"
                      value={total}
                      onChange={(e) => setTotal(e.target.value)}
                      placeholder="0,00"
                      className={`${inputCls} pl-10`}
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full h-14 bg-primary text-white rounded-2xl font-bold text-base hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 mt-4"
              >
                <ShieldCheck className="h-5 w-5" />
                Validar Autenticidade
              </button>
            </form>
          </div>

          {/* Rodapé de Informações */}
          <footer className="flex flex-col gap-6 pt-4">
            <div className="bg-slate-100 rounded-2xl p-5 border border-border/50 flex items-start gap-4">
              <HelpCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-foreground">Como funciona?</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  O sistema utiliza um algoritmo de hash (FNV-1a) para gerar um selo digital único baseado nos dados do documento. 
                  Sua consulta é processada localmente, garantindo total privacidade.
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-4 text-center">
              <div className="h-px w-20 bg-border" />
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold flex items-center gap-2">
                Plataforma <span className="text-primary">SISLAC</span> Core • {new Date().getFullYear()}
              </p>
              <div className="flex gap-4">
                <a href="https://sislac.com.br" className="text-[10px] font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                  Site Oficial <ExternalLink className="h-2.5 w-2.5" />
                </a>
                <span className="text-border">|</span>
                <Link to="/privacidade" className="text-[10px] font-bold text-muted-foreground hover:text-primary transition-colors">
                  Privacidade
                </Link>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
};

export default VerificarComprovante;