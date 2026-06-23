import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  FlaskConical,
  Loader2,
  MessageCircle,
  Phone,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Step = "form" | "verification" | "success";

const maskPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length > 0 ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const BENEFITS = [
  "Rastreabilidade total de amostras",
  "Integração financeira completa",
  "Suporte técnico especializado",
];

export default function Inscricao() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [leadId, setLeadId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    nome_responsavel: "",
    whatsapp: "",
    nome_laboratorio: "",
  });
  const [verificationCode, setVerificationCode] = useState("");

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("leads-manager", {
        body: { action: "submit", ...formData },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Erro ao enviar formulário");
      setLeadId(data.lead_id);
      setStep("verification");
      toast.success("Código enviado para o seu WhatsApp!");
    } catch (err: any) {
      console.error("Erro no envio:", err);
      toast.error(err.message || "Erro ao conectar com o servidor");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationCode.length !== 6) {
      toast.error("O código deve ter 6 dígitos");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("leads-manager", {
        body: { action: "verify", lead_id: leadId, code: verificationCode },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Código inválido");
      setStep("success");
    } catch (err: any) {
      console.error("Erro na verificação:", err);
      toast.error(err.message || "Código inválido");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("leads-manager", {
        body: { action: "resend", lead_id: leadId },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Erro ao reenviar");
      toast.success("Novo código enviado!");
    } catch (err: any) {
      console.error("Erro ao reenviar:", err);
      toast.error(err.message || "Falha ao reenviar código");
    } finally {
      setLoading(false);
    }
  };

  if (step === "success") {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-full max-w-lg space-y-8 animate-in zoom-in-95 duration-500">
          <div className="flex justify-center">
            <div className="h-24 w-24 rounded-3xl bg-emerald-50 flex items-center justify-center border border-emerald-100">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            </div>
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Inscrição confirmada</h1>
            <p className="text-slate-500 text-base leading-relaxed">
              Olá <span className="font-semibold text-slate-900">{formData.nome_responsavel}</span>!
              Recebemos seu interesse no <span className="font-semibold text-[#4D41F3]">SISLAC</span>.
              Nossa equipe entrará em contato pelo WhatsApp{" "}
              <span className="font-semibold text-slate-900">{formData.whatsapp}</span>.
            </p>
          </div>
          <Button asChild className="w-full h-12 rounded-xl bg-[#4D41F3] hover:bg-[#3d33cc] font-semibold">
            <Link to="/">Voltar para a Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#F8FAFC] flex flex-col items-center justify-center antialiased p-4 md:p-8">
      {/* Header */}
      <div className="w-full max-w-6xl flex justify-between items-center mb-8 px-4">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative w-10 h-10 bg-[#4D41F3] rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 group-hover:scale-105 transition-transform">
            <FlaskConical className="w-5 h-5 text-white" />
            <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
          </div>
          <span className="text-2xl font-bold tracking-tight text-slate-900">SISLAC</span>
        </Link>
        <Link
          to="/"
          className="group flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <X className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
          Cancelar
        </Link>
      </div>

      {/* Main card */}
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 bg-white rounded-[2rem] shadow-2xl shadow-slate-200/60 overflow-hidden border border-slate-100">
        {/* Left: Brand */}
        <div className="hidden lg:flex flex-col justify-between p-16 bg-[#4D41F3] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-400/20 rounded-full -ml-40 -mb-40 blur-3xl" />

          <div className="relative z-10">
            <h1 className="text-4xl font-bold text-white leading-[1.1] mb-6">
              A revolução na gestão do seu laboratório começa aqui.
            </h1>
            <p className="text-indigo-100 text-lg leading-relaxed mb-10">
              Junte-se às unidades que automatizaram seus processos com segurança e agilidade.
            </p>

            <div className="space-y-6">
              {BENEFITS.map((b) => (
                <div key={b} className="flex items-start gap-4">
                  <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                  </div>
                  <span className="text-indigo-50 font-medium">{b}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 p-6 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm">
            <p className="text-sm text-indigo-50 italic font-medium leading-relaxed">
              “O SISLAC transformou nossa rotina. O que levava horas agora é feito em minutos.”
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-300/80 flex items-center justify-center text-[11px] font-bold text-[#4D41F3]">
                CE
              </div>
              <span className="text-xs font-bold text-white">Dr. Carlos Eduardo — Lab Central</span>
            </div>
          </div>
        </div>

        {/* Right: Form / Verification */}
        <div className="p-8 md:p-16 flex flex-col justify-center">
          {step === "form" ? (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="text-center lg:text-left">
                <h2 className="text-3xl font-bold text-slate-900 mb-3">Transforme seu laboratório hoje</h2>
                <p className="text-slate-500 font-medium">
                  Preencha os dados abaixo e veja o SISLAC em ação.
                </p>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-6">
                <div>
                  <Label
                    htmlFor="nome_responsavel"
                    className="block text-[11px] font-bold text-slate-400 tracking-widest uppercase mb-2 ml-1"
                  >
                    Nome do Responsável
                  </Label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#4D41F3] transition-colors">
                      <User className="w-5 h-5" />
                    </div>
                    <Input
                      id="nome_responsavel"
                      placeholder="Como devemos te chamar?"
                      className="w-full pl-12 pr-4 h-14 bg-slate-50 border border-slate-200 rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-indigo-50 focus-visible:border-[#4D41F3] focus:bg-white transition-all text-slate-700 font-medium placeholder:text-slate-400 placeholder:font-normal text-base"
                      required
                      value={formData.nome_responsavel}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, nome_responsavel: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div>
                  <Label
                    htmlFor="whatsapp"
                    className="block text-[11px] font-bold text-slate-400 tracking-widest uppercase mb-2 ml-1"
                  >
                    WhatsApp
                  </Label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#4D41F3] transition-colors">
                      <Phone className="w-5 h-5" />
                    </div>
                    <Input
                      id="whatsapp"
                      placeholder="(00) 00000-0000"
                      className="w-full pl-12 pr-4 h-14 bg-slate-50 border border-slate-200 rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-indigo-50 focus-visible:border-[#4D41F3] focus:bg-white transition-all text-slate-700 font-medium placeholder:text-slate-400 text-base"
                      required
                      value={formData.whatsapp}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, whatsapp: maskPhone(e.target.value) }))
                      }
                    />
                  </div>
                </div>

                <div>
                  <Label
                    htmlFor="nome_laboratorio"
                    className="block text-[11px] font-bold text-slate-400 tracking-widest uppercase mb-2 ml-1"
                  >
                    Nome do Laboratório
                  </Label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#4D41F3] transition-colors">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <Input
                      id="nome_laboratorio"
                      placeholder="Nome da sua clínica ou laboratório"
                      className="w-full pl-12 pr-4 h-14 bg-slate-50 border border-slate-200 rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-indigo-50 focus-visible:border-[#4D41F3] focus:bg-white transition-all text-slate-700 font-medium placeholder:text-slate-400 text-base"
                      required
                      value={formData.nome_laboratorio}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, nome_laboratorio: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#4D41F3] text-white font-bold h-14 rounded-xl shadow-xl shadow-indigo-200 hover:bg-[#3d33cc] active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-base"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Validando dados...
                    </>
                  ) : (
                    <>
                      Quero ver na prática
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </Button>

                <p className="text-center text-[11px] leading-relaxed text-slate-400 px-4">
                  Suas informações estão protegidas por criptografia e seguem nossa{" "}
                  <Link to="#" className="text-[#4D41F3] underline font-semibold">
                    Política de Privacidade
                  </Link>
                  .
                </p>
              </form>

              <div className="pt-6 border-t border-slate-100 flex items-center justify-center gap-2 text-slate-400">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase">
                  Ambiente 100% Seguro
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <button
                onClick={() => setStep("form")}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#4D41F3] hover:opacity-80 transition-opacity"
              >
                <ChevronLeft className="h-4 w-4" />
                Corrigir dados
              </button>

              <div className="text-center lg:text-left">
                <h2 className="text-3xl font-bold text-slate-900 mb-3">Validação WhatsApp</h2>
                <p className="text-slate-500 font-medium">
                  Enviamos um código de segurança para{" "}
                  <span className="font-semibold text-slate-900">{formData.whatsapp}</span>.
                </p>
              </div>

              <form onSubmit={handleVerify} className="space-y-6">
                <Input
                  placeholder="0 0 0 0 0 0"
                  className="h-16 text-center text-3xl tracking-[0.4em] font-bold border-2 border-slate-200 bg-slate-50 rounded-xl focus-visible:ring-4 focus-visible:ring-indigo-50 focus-visible:border-[#4D41F3] focus:bg-white transition-all"
                  maxLength={6}
                  required
                  autoFocus
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                />

                <div className="flex flex-col items-center gap-2">
                  <p className="text-xs text-slate-400">Não recebeu o código?</p>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={loading}
                    className="text-sm font-semibold text-[#4D41F3] hover:underline flex items-center gap-1.5"
                  >
                    {loading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <MessageCircle className="h-4 w-4" />
                    )}
                    Solicitar novo código
                  </button>
                </div>

                <Button
                  type="submit"
                  disabled={loading || verificationCode.length !== 6}
                  className="w-full bg-[#4D41F3] text-white font-bold h-14 rounded-xl shadow-xl shadow-indigo-200 hover:bg-[#3d33cc] active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-base"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    "Confirmar Cadastro"
                  )}
                </Button>
              </form>

              <div className="pt-6 border-t border-slate-100 flex items-center justify-center gap-2 text-slate-400">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase">
                  Ambiente 100% Seguro
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="mt-10 text-[11px] font-medium text-slate-400">
        © {new Date().getFullYear()} SISLAC Tecnologia para Laboratórios. Todos os direitos reservados.
      </p>
    </div>
  );
}
