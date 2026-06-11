import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  ArrowRight, 
  Building2, 
  ChevronLeft, 
  FlaskConical, 
  MapPin, 
  MessageCircle, 
  Phone, 
  Send, 
  User, 
  CheckCircle2,
  Loader2,
  X,
  ShieldCheck,
  Zap,
  Star,
  Globe
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

export default function Inscricao() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [leadId, setLeadId] = useState<string | null>(null);

  // Form states
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
        body: { 
          action: "submit",
          ...formData
        }
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
        body: { 
          action: "verify",
          lead_id: leadId,
          code: verificationCode
        }
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
        body: { 
          action: "resend",
          lead_id: leadId
        }
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
        <div className="w-full max-w-lg space-y-10 animate-in zoom-in-95 duration-700">
          <div className="flex justify-center">
            <div className="h-32 w-32 rounded-[40px] bg-green-50 flex items-center justify-center shadow-2xl shadow-green-100/50 border-4 border-white rotate-3">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            </div>
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-black tracking-tight text-slate-900 leading-tight">Inscrição Confirmada!</h1>
            <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40">
              <p className="text-slate-600 text-lg leading-relaxed">
                Olá <span className="font-bold text-slate-900">{formData.nome_responsavel}</span>! 
                Recebemos seu interesse no <span className="font-extrabold text-primary">SISLAC</span>. 
                Nossa equipe de especialistas entrará em contato com você em breve pelo WhatsApp <span className="font-black text-slate-900">{formData.whatsapp}</span>.
              </p>
            </div>
          </div>
          <Button asChild className="w-full h-16 rounded-[24px] text-lg font-bold shadow-2xl shadow-primary/20 hover:scale-[1.02] transition-all">
            <Link to="/">Voltar para a Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Header */}
      <header className="h-20 border-b border-slate-200 bg-white/80 backdrop-blur-md z-50 flex items-center px-6 sticky top-0">
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
              <FlaskConical className="h-5 w-5" />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900">SISLAC</span>
          </Link>
          <Link to="/" className="text-sm font-medium text-slate-500 hover:text-primary transition-colors flex items-center gap-2">
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">Cancelar</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center py-12 px-6">
        <div className="w-full max-w-lg mx-auto">
          <div className="bg-white rounded-3xl shadow-[0_8px_32px_-8px_rgba(0,0,0,0.06)] border border-slate-100 overflow-hidden">
            <div className="p-8 sm:p-10">
              {step === "form" ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="space-y-1 text-center">
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dados da Inscrição</h1>
                    <p className="text-sm text-slate-500">Comece agora sua jornada para uma gestão moderna.</p>
                  </div>

                  <form onSubmit={handleFormSubmit} className="space-y-5">
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="nome_responsavel" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Nome do responsável</Label>
                        <div className="relative group">
                          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                          <Input 
                            id="nome_responsavel"
                            placeholder="Como devemos te chamar?"
                            className="pl-10 h-12 bg-slate-50/50 border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all text-sm"
                            required
                            value={formData.nome_responsavel}
                            onChange={(e) => setFormData(prev => ({ ...prev, nome_responsavel: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="whatsapp" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">WhatsApp</Label>
                        <div className="relative group">
                          <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                          <Input 
                            id="whatsapp"
                            placeholder="(00) 00000-0000"
                            className="pl-10 h-12 bg-slate-50/50 border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all text-sm"
                            required
                            value={formData.whatsapp}
                            onChange={(e) => setFormData(prev => ({ ...prev, whatsapp: maskPhone(e.target.value) }))}
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="nome_laboratorio" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Nome do laboratório</Label>
                        <div className="relative group">
                          <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                          <Input 
                            id="nome_laboratorio"
                            placeholder="Nome da sua clínica ou laboratório"
                            className="pl-10 h-12 bg-slate-50/50 border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all text-sm"
                            required
                            value={formData.nome_laboratorio}
                            onChange={(e) => setFormData(prev => ({ ...prev, nome_laboratorio: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>

                    <Button type="submit" className="w-full h-12 rounded-xl font-semibold text-sm shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/25 transition-all" disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Validando dados...
                        </>
                      ) : (
                        <>
                          Solicitar Demonstração
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>

                    <p className="text-center text-[11px] text-slate-400 leading-relaxed">
                      Suas informações estão protegidas por criptografia e seguem nossa <Link to="#" className="underline hover:text-primary transition-colors">Política de Privacidade</Link>.
                    </p>
                  </form>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <button 
                    onClick={() => setStep("form")}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:opacity-80 transition-opacity"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Corrigir dados
                  </button>

                  <div className="space-y-1 text-center">
                    <h1 className="text-xl font-bold text-slate-900 tracking-tight">Validação WhatsApp</h1>
                    <p className="text-sm text-slate-500">
                      Enviamos um código de segurança para <span className="font-semibold text-slate-900">{formData.whatsapp}</span>.
                    </p>
                  </div>

                  <form onSubmit={handleVerify} className="space-y-5">
                    <div className="space-y-4">
                      <div className="relative">
                        <Input 
                          placeholder="0 0 0 0 0 0"
                          className="h-14 text-center text-2xl tracking-[0.3em] font-bold border-2 border-slate-100 bg-slate-50/50 rounded-xl focus:ring-primary/20 focus:border-primary transition-all"
                          maxLength={6}
                          required
                          autoFocus
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                        />
                      </div>
                      
                      <div className="flex flex-col items-center gap-2">
                        <p className="text-xs text-slate-400">Não recebeu o código?</p>
                        <button 
                          type="button"
                          onClick={handleResend}
                          disabled={loading}
                          className="text-sm font-semibold text-primary hover:underline flex items-center gap-1.5"
                        >
                          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                          Solicitar novo código
                        </button>
                      </div>
                    </div>

                    <Button type="submit" className="w-full h-12 rounded-xl text-sm font-semibold shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/25 transition-all" disabled={loading || verificationCode.length !== 6}>
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verificando...
                        </>
                      ) : (
                        "Confirmar Cadastro"
                      )}
                    </Button>
                  </form>
                </div>
              )}
            </div>
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex items-center justify-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Ambiente 100% Seguro</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 px-6 text-center">
        <p className="text-xs text-slate-400">
          © {new Date().getFullYear()} SISLAC Tecnologia para Laboratórios. Todos os direitos reservados.
        </p>
      </footer>
    </div>
  );
}