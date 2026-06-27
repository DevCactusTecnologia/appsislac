import { useCallback, useEffect, useRef, useState } from "react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { useLocation, useNavigate } from "react-router-dom";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { fetchAtendimentoByProtocolo, updateAtendimento } from "@/data/atendimentoStore";
import { printHtmlInHiddenFrame } from "@/lib/printHtml";

/** Resolve intervalo [ini, fim) a partir de uma palavra ou par de datas ISO. */
function resolvePeriodo(periodo?: string, data_inicio?: string, data_fim?: string): { ini?: Date; fim?: Date; label: string } {
  if (data_inicio || data_fim) {
    const ini = data_inicio ? new Date(data_inicio) : undefined;
    const fim = data_fim ? new Date(data_fim) : undefined;
    return { ini, fim, label: `${data_inicio ?? "início"} a ${data_fim ?? "hoje"}` };
  }
  const now = new Date();
  const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
  const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  switch ((periodo ?? "").toLowerCase()) {
    case "hoje": return { ini: startOfDay(now), label: "hoje" };
    case "ontem": { const i = startOfDay(addDays(now, -1)); return { ini: i, fim: startOfDay(now), label: "ontem" }; }
    case "semana": { const i = startOfDay(now); i.setDate(i.getDate() - i.getDay()); return { ini: i, label: "esta semana" }; }
    case "semana_passada": { const fim = startOfDay(now); fim.setDate(fim.getDate() - fim.getDay()); const ini = addDays(fim, -7); return { ini, fim, label: "semana passada" }; }
    case "mes": return { ini: new Date(now.getFullYear(), now.getMonth(), 1), label: "este mês" };
    case "mes_passado": { const ini = new Date(now.getFullYear(), now.getMonth() - 1, 1); const fim = new Date(now.getFullYear(), now.getMonth(), 1); return { ini, fim, label: "mês passado" }; }
    case "7dias": return { ini: addDays(now, -7), label: "últimos 7 dias" };
    case "30dias": return { ini: addDays(now, -30), label: "últimos 30 dias" };
    default: return { label: "no total" };
  }
}

const AGENT_ID = "agent_2801kw31qjftetpbefenctpfnm8n";


/**
 * Mapa de rotas amigáveis -> caminho real.
 * Mantenha curto e estável; o agente recebe estas chaves no system prompt.
 */
const ROUTE_MAP: Record<string, string> = {
  dashboard: "/dashboard",
  atendimentos: "/atendimentos",
  novo_atendimento: "/atendimentos/novo",
  coleta: "/registrar-coleta",
  analise: "/analisar-amostra",
  resultados: "/resultados",
  pacientes: "/pacientes",
  orcamentos: "/orcamentos",
  lab_apoio: "/lab-apoio",
  auditoria: "/auditoria",
  especialistas: "/especialistas",
  producao: "/relatorios/producao",
  impressao: "/relatorios/impressao",
};

/** Descreve a tela atual em uma linha curta para o agente. */
function describeRoute(pathname: string): string {
  if (pathname.startsWith("/atendimentos/novo")) return "Tela: novo atendimento (cadastro)";
  if (pathname.startsWith("/atendimentos")) return "Tela: lista de atendimentos";
  if (pathname.startsWith("/resultado/")) return `Tela: detalhe do resultado (${pathname})`;
  if (pathname.startsWith("/resultados")) return "Tela: lista de resultados";
  if (pathname.startsWith("/registrar-coleta")) return "Tela: registrar coleta";
  if (pathname.startsWith("/analisar-amostra")) return "Tela: análise de amostras";
  if (pathname.startsWith("/pacientes")) return "Tela: pacientes";
  if (pathname.startsWith("/orcamentos")) return "Tela: orçamentos";
  if (pathname.startsWith("/dashboard")) return "Tela: dashboard";
  return `Tela: ${pathname}`;
}

function AssistenteSISLACInner() {
  const [connecting, setConnecting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const conversation = useConversation({
    clientTools: {
      /** Navega para uma área do sistema. */
      navegar_para: ({ destino }: { destino: string }) => {
        const path = ROUTE_MAP[destino?.toLowerCase?.()] ?? destino;
        if (!path?.startsWith("/")) return `Destino desconhecido: ${destino}`;
        navigateRef.current(path);
        return `Navegado para ${path}`;
      },

      /** Abre o detalhe de um atendimento pelo número de protocolo. */
      abrir_atendimento: async ({ protocolo }: { protocolo: string }) => {
        if (!protocolo) return "Protocolo é obrigatório";
        const { data, error } = await supabase
          .from("atendimentos")
          .select("id, protocolo")
          .ilike("protocolo", `%${protocolo}%`)
          .limit(1)
          .maybeSingle();
        if (error || !data) return `Atendimento ${protocolo} não encontrado`;
        navigateRef.current(`/atendimentos/${data.protocolo}/editar`);
        return `Aberto atendimento ${data.protocolo}`;
      },

      /** Abre o resultado de um atendimento pelo protocolo. */
      abrir_resultado: async ({ protocolo }: { protocolo: string }) => {
        if (!protocolo) return "Protocolo é obrigatório";
        const { data, error } = await supabase
          .from("atendimentos")
          .select("id, protocolo")
          .ilike("protocolo", `%${protocolo}%`)
          .limit(1)
          .maybeSingle();
        if (error || !data) return `Resultado ${protocolo} não encontrado`;
        navigateRef.current(`/resultado/${data.id}`);
        return `Aberto resultado ${data.protocolo}`;
      },

      /** Conta atendimentos do tenant atual (RLS garante o escopo). */
      contar_atendimentos: async ({ periodo }: { periodo?: "hoje" | "semana" | "mes" } = {}) => {
        let q = supabase.from("atendimentos").select("id", { count: "exact", head: true });
        const now = new Date();
        if (periodo === "hoje") {
          const ini = new Date(now); ini.setHours(0, 0, 0, 0);
          q = q.gte("data_atendimento", ini.toISOString());
        } else if (periodo === "semana") {
          const ini = new Date(now); ini.setDate(now.getDate() - 7);
          q = q.gte("data_atendimento", ini.toISOString());
        } else if (periodo === "mes") {
          const ini = new Date(now.getFullYear(), now.getMonth(), 1);
          q = q.gte("data_atendimento", ini.toISOString());
        }
        const { count, error } = await q;
        if (error) return `Erro: ${error.message}`;
        return `${count ?? 0} atendimento(s) ${periodo ?? "no total"}`;
      },

      /** Busca paciente por nome ou CPF. */
      buscar_paciente: async ({ termo }: { termo: string }) => {
        if (!termo) return "Informe nome ou CPF";
        const { data, error } = await supabase
          .from("pacientes")
          .select("id, nome, cpf")
          .or(`nome.ilike.%${termo}%,cpf.ilike.%${termo}%`)
          .limit(5);
        if (error) return `Erro: ${error.message}`;
        if (!data?.length) return `Nenhum paciente para "${termo}"`;
        return data.map((p) => `${p.nome} (${p.cpf ?? "sem CPF"})`).join("; ");
      },

      // ============ FASE 1 — RESULTADO (bridge window.__sislacResultado) ============
      resultado_set_valor: ({ parametro, valor }: { parametro: string; valor: string }) => {
        const api = (window as any).__sislacResultado;
        if (!api) return "Abra um resultado primeiro";
        const r = api.setValor(parametro, valor);
        return r.msg;
      },
      resultado_set_varios: ({ pares }: { pares: string }) => {
        const api = (window as any).__sislacResultado;
        if (!api) return "Abra um resultado primeiro";
        const r = api.setVarios(pares);
        return r.msg;
      },
      resultado_salvar: () => {
        const api = (window as any).__sislacResultado;
        if (!api) return "Abra um resultado primeiro";
        return api.salvar().msg;
      },
      resultado_liberar: ({ confirmado }: { confirmado?: boolean } = {}) => {
        const api = (window as any).__sislacResultado;
        if (!api) return "Abra um resultado primeiro";
        if (!confirmado) return "Confirmação necessária — peça 'sim, liberar' ao usuário";
        return api.liberar().msg;
      },
      resultado_imprimir: () => {
        const api = (window as any).__sislacResultado;
        if (!api) return "Abra um resultado primeiro";
        return api.imprimir().msg;
      },

      // ============ FASE 2 — ATENDIMENTO ============
      /** Abre o wizard de novo atendimento; opcionalmente pré-seleciona paciente por nome/CPF. */
      criar_atendimento: async ({ paciente_termo }: { paciente_termo?: string } = {}) => {
        let qs = "";
        if (paciente_termo) {
          const { data } = await supabase
            .from("pacientes")
            .select("id, nome")
            .or(`nome.ilike.%${paciente_termo}%,cpf.ilike.%${paciente_termo}%`)
            .limit(1)
            .maybeSingle();
          if (data?.id) qs = `?paciente=${data.id}`;
        }
        navigateRef.current(`/atendimentos/novo${qs}`);
        return paciente_termo ? `Novo atendimento para ${paciente_termo}` : "Novo atendimento aberto";
      },

      /** Adiciona um exame a um atendimento existente (busca exato/parcial no catálogo). */
      adicionar_exame: async ({ protocolo, exame }: { protocolo: string; exame: string }) => {
        if (!protocolo || !exame) return "Informe protocolo e exame";
        const at = await fetchAtendimentoByProtocolo(protocolo);
        if (!at) return `Atendimento ${protocolo} não encontrado`;
        if (at.statusAtendimento?.label === "Cancelado") return "Atendimento cancelado";
        const { data: cat } = await supabase
          .from("exames_catalogo")
          .select("nome")
          .ilike("nome", `%${exame}%`)
          .limit(1)
          .maybeSingle();
        const nome = cat?.nome ?? exame.toUpperCase();
        if (at.exames?.includes(nome)) return `${nome} já está no atendimento`;
        await updateAtendimento(protocolo, { exames: [...(at.exames ?? []), nome] });
        return `Exame ${nome} adicionado`;
      },

      /** Cancela atendimento — exige confirmação verbal explícita. */
      cancelar_atendimento: async ({
        protocolo, motivo, confirmado,
      }: { protocolo: string; motivo?: string; confirmado?: boolean }) => {
        if (!protocolo) return "Informe o protocolo";
        if (!confirmado) return "Confirmação necessária — peça 'sim, cancelar' ao usuário";
        const at = await fetchAtendimentoByProtocolo(protocolo);
        if (!at) return `Atendimento ${protocolo} não encontrado`;
        if (at.statusAtendimento?.label === "Cancelado") return "Já estava cancelado";
        await updateAtendimento(protocolo, {
          statusAtendimento: { label: "Cancelado", type: "danger" },
          motivoCancelamento: motivo || "Cancelado via Assistente SISLAC",
        });
        return `Atendimento ${protocolo} cancelado`;
      },

      /** Registra pagamento adicional (acumula em pagamentosRealizados). */
      registrar_pagamento: async ({
        protocolo, valor, forma,
      }: { protocolo: string; valor: number | string; forma?: string }) => {
        if (!protocolo) return "Informe o protocolo";
        const v = typeof valor === "string" ? parseFloat(String(valor).replace(",", ".")) : Number(valor);
        if (!Number.isFinite(v) || v <= 0) return "Valor inválido";
        const at = await fetchAtendimentoByProtocolo(protocolo);
        if (!at) return `Atendimento ${protocolo} não encontrado`;
        if (at.statusAtendimento?.label === "Cancelado") return "Atendimento cancelado";
        const novo = { tipo: (forma || "DINHEIRO").toUpperCase(), valor: v, data: new Date().toISOString() };
        const pagamentos = [...(at.pagamentosRealizados ?? []), novo];
        await updateAtendimento(protocolo, { pagamentosRealizados: pagamentos });
        return `Pagamento de R$ ${v.toFixed(2)} (${novo.tipo}) registrado`;
      },

      /** Resumo falável: protocolo, status e lista de exames. */
      atendimento_resumo: async ({ protocolo }: { protocolo: string }) => {
        if (!protocolo) return "Informe o protocolo";
        const at = await fetchAtendimentoByProtocolo(protocolo);
        if (!at) return `Atendimento ${protocolo} não encontrado`;
        const status = at.statusAtendimento?.label ?? "sem status";
        const exames = at.exames?.length ? at.exames.join(", ") : "nenhum exame";
        const paciente = (at as any).pacienteNome ?? (at as any).paciente?.nome ?? "";
        return `Protocolo ${at.protocolo}${paciente ? ` — ${paciente}` : ""}. Status: ${status}. Exames: ${exames}.`;
      },

      /** Lista atendimentos por período, com filtro opcional por status. */
      listar_atendimentos_por_protocolo: async ({
        limite, status, periodo, data_inicio, data_fim,
      }: { limite?: number; status?: string; periodo?: string; data_inicio?: string; data_fim?: string } = {}) => {
        const n = Math.max(1, Math.min(50, Number(limite) || 10));
        const { ini, fim, label } = resolvePeriodo(periodo, data_inicio, data_fim);
        let q = supabase
          .from("atendimentos")
          .select("protocolo, status_atendimento, data, paciente_nome")
          .order("data", { ascending: false })
          .limit(n);
        if (ini) q = q.gte("data", ini.toISOString());
        if (fim) q = q.lt("data", fim.toISOString());
        if (status) q = q.ilike("status_atendimento", `%${status}%`);
        const { data, error } = await q;
        if (error) return `Erro: ${error.message}`;
        if (!data?.length) return `Nenhum atendimento ${label}`;
        const head = `${data.length} atendimento(s) ${label}: `;
        return head + data
          .map((r: any) => `${r.protocolo} — ${r.paciente_nome ?? ""} (${r.status_atendimento ?? "sem status"})`)
          .join("; ");
      },

      /** Detalhes falável: protocolo, status e exames com valores. */
      detalhes_atendimento_por_protocolo: async ({ protocolo }: { protocolo: string }) => {
        if (!protocolo) return "Informe o protocolo";
        const { data: at, error: e1 } = await supabase
          .from("atendimentos")
          .select("id, protocolo, status_atendimento, paciente_nome")
          .ilike("protocolo", `%${protocolo}%`)
          .limit(1)
          .maybeSingle();
        if (e1 || !at) return `Atendimento ${protocolo} não encontrado`;
        const { data: exs } = await supabase
          .from("atendimento_exames")
          .select("nome_exame, status, resultados")
          .eq("atendimento_id", at.id)
          .order("ordem", { ascending: true });
        const linhas = (exs ?? []).map((e: any) => {
          let valor = "sem resultado";
          const r = e.resultados;
          if (r && typeof r === "object") {
            const pares = Object.entries(r).slice(0, 4)
              .map(([k, v]: any) => `${k}=${typeof v === "object" ? v?.valor ?? "" : v}`)
              .join(", ");
            if (pares) valor = pares;
          }
          return `${e.nome_exame} [${e.status}]: ${valor}`;
        });
        return `Protocolo ${at.protocolo} — ${at.paciente_nome}. Status: ${at.status_atendimento}. Exames: ${linhas.join(" | ") || "nenhum"}`;
      },

      /** Abre impressão do laudo (auto-print → o usuário pode salvar como PDF). */
      imprimir_atendimento: async ({ protocolo }: { protocolo: string }) => {
        if (!protocolo) return "Informe o protocolo";
        const { data, error } = await supabase
          .from("atendimentos")
          .select("id, protocolo")
          .ilike("protocolo", `%${protocolo}%`)
          .limit(1)
          .maybeSingle();
        if (error || !data) return `Atendimento ${protocolo} não encontrado`;
        window.open(`/resultado/${data.id}/print`, "_blank", "noopener");
        return `Impressão de ${data.protocolo} aberta — use 'Salvar como PDF' no diálogo`;
      },

      /** Libera o resultado de um atendimento pelo protocolo (exige confirmação). */
      liberar_resultado_atendimento: async ({
        protocolo, confirmado,
      }: { protocolo: string; confirmado?: boolean }) => {
        if (!protocolo) return "Informe o protocolo";
        if (!confirmado) return "Confirmação necessária — peça 'sim, liberar' ao usuário";
        const { data, error } = await supabase
          .from("atendimentos")
          .select("id, protocolo")
          .ilike("protocolo", `%${protocolo}%`)
          .limit(1)
          .maybeSingle();
        if (error || !data) return `Atendimento ${protocolo} não encontrado`;
        navigateRef.current(`/resultado/${data.id}`);
        const ok = await new Promise<boolean>((resolve) => {
          const t0 = Date.now();
          const iv = setInterval(() => {
            if ((window as any).__sislacResultado) { clearInterval(iv); resolve(true); }
            else if (Date.now() - t0 > 5000) { clearInterval(iv); resolve(false); }
          }, 150);
        });
        if (!ok) return "Tela de resultado não carregou a tempo";
        const r = (window as any).__sislacResultado.liberar();
        return r?.msg ?? `Resultado ${data.protocolo} liberado`;
      },

      /** Registra observação falada no atendimento (append com timestamp). */
      registrar_observacao_atendimento: async ({
        protocolo, observacao,
      }: { protocolo: string; observacao: string }) => {
        if (!protocolo) return "Informe o protocolo";
        if (!observacao?.trim()) return "Diga o conteúdo da observação";
        const { data: at, error } = await supabase
          .from("atendimentos")
          .select("id, protocolo, observacoes_assistente")
          .ilike("protocolo", `%${protocolo}%`)
          .limit(1)
          .maybeSingle();
        if (error || !at) return `Atendimento ${protocolo} não encontrado`;
        const ts = new Date().toLocaleString("pt-BR");
        const novo = `${at.observacoes_assistente ? at.observacoes_assistente + "\n" : ""}[${ts}] ${observacao.trim()}`;
        const { error: e2 } = await supabase
          .from("atendimentos")
          .update({ observacoes_assistente: novo })
          .eq("id", at.id);
        if (e2) return `Erro ao salvar: ${e2.message}`;
        return `Observação registrada em ${at.protocolo}`;
      },

      /** Lista pacientes com dívidas (pagamento pendente/parcial), opcional por convênio. */
      pacientes_com_dividas: async ({
        modo, convenio, limite,
      }: { modo?: "pendente" | "parcial" | "todos"; convenio?: string; limite?: number } = {}) => {
        const n = Math.max(1, Math.min(50, Number(limite) || 10));
        let q = supabase
          .from("atendimentos")
          .select("protocolo, paciente_nome, convenio_nome, status_pagamento, total")
          .order("data", { ascending: false })
          .limit(n);
        if (modo === "parcial") q = q.ilike("status_pagamento", "%parcial%");
        else if (modo === "pendente") q = q.ilike("status_pagamento", "%pendente%");
        else q = q.not("status_pagamento", "ilike", "%pago%");
        if (convenio) q = q.ilike("convenio_nome", `%${convenio}%`);
        const { data, error } = await q;
        if (error) return `Erro: ${error.message}`;
        if (!data?.length) return "Nenhum paciente com pendência";
        return `${data.length} pendência(s): ` + data
          .map((r: any) => `${r.paciente_nome} (${r.convenio_nome}) — R$ ${Number(r.total ?? 0).toFixed(2)} [${r.status_pagamento}]`)
          .join("; ");
      },

      /** Gera relatório (PDF via diálogo de impressão) de devedores agrupados por convênio. */
      gerar_pdf_devedores_por_convenio: async ({ apenas_convenio }: { apenas_convenio?: string } = {}) => {
        let q = supabase
          .from("atendimentos")
          .select("protocolo, paciente_nome, paciente_cpf, convenio_nome, status_pagamento, total, data")
          .not("status_pagamento", "ilike", "%pago%")
          .order("convenio_nome", { ascending: true })
          .order("data", { ascending: false })
          .limit(1000);
        if (apenas_convenio) q = q.ilike("convenio_nome", `%${apenas_convenio}%`);
        const { data, error } = await q;
        if (error) return `Erro: ${error.message}`;
        if (!data?.length) return "Nenhum devedor encontrado";

        const grupos = new Map<string, any[]>();
        for (const r of data as any[]) {
          const k = r.convenio_nome ?? "Sem convênio";
          if (!grupos.has(k)) grupos.set(k, []);
          grupos.get(k)!.push(r);
        }
        const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        const hoje = new Date().toLocaleString("pt-BR");
        let totalGeral = 0;
        let html = `<!doctype html><html><head><meta charset="utf-8"><title>Devedores por convênio</title>
<style>body{font-family:Arial,sans-serif;padding:16px;color:#111}h1{font-size:18px;margin:0 0 4px}h2{font-size:14px;margin:18px 0 6px;border-bottom:1px solid #333;padding-bottom:2px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #ccc;padding:4px 6px;text-align:left}th{background:#f1f1f1}tfoot td{font-weight:bold;background:#fafafa}.right{text-align:right}.muted{color:#666;font-size:11px}@media print{@page{size:A4;margin:14mm}}</style>
</head><body><h1>Relatório de Devedores por Convênio</h1><div class="muted">Gerado em ${hoje}</div>`;
        for (const [conv, rows] of grupos) {
          const subtotal = rows.reduce((s, r) => s + Number(r.total ?? 0), 0);
          totalGeral += subtotal;
          html += `<h2>${conv} — ${rows.length} paciente(s) — ${fmt(subtotal)}</h2>
<table><thead><tr><th>Protocolo</th><th>Paciente</th><th>CPF</th><th>Data</th><th>Status</th><th class="right">Valor</th></tr></thead><tbody>`;
          for (const r of rows) {
            const dt = r.data ? new Date(r.data).toLocaleDateString("pt-BR") : "";
            html += `<tr><td>${r.protocolo}</td><td>${r.paciente_nome ?? ""}</td><td>${r.paciente_cpf ?? ""}</td><td>${dt}</td><td>${r.status_pagamento}</td><td class="right">${fmt(Number(r.total ?? 0))}</td></tr>`;
          }
          html += `</tbody><tfoot><tr><td colspan="5" class="right">Subtotal</td><td class="right">${fmt(subtotal)}</td></tr></tfoot></table>`;
        }
        html += `<h2>Total geral: ${fmt(totalGeral)}</h2></body></html>`;
        printHtmlInHiddenFrame({ html, documentTitle: "Devedores por convênio" });
        return `Relatório de ${data.length} devedor(es) gerado — use 'Salvar como PDF'`;
      },
    },


    onConnect: () => toast.success("Assistente SISLAC conectado"),
    onDisconnect: () => toast.message("Assistente SISLAC desconectado"),
    onError: (err) => {
      console.error("[AssistenteSISLAC]", err);
      toast.error("Falha na conexão com o Assistente SISLAC");
    },
  });

  const isConnected = conversation.status === "connected";
  const isSpeaking = conversation.isSpeaking;

  // Envia contexto da tela atual sempre que a rota muda durante a conversa.
  useEffect(() => {
    if (!isConnected) return;
    try {
      conversation.sendContextualUpdate(describeRoute(location.pathname));
    } catch (e) {
      console.warn("[AssistenteSISLAC] contextual update", e);
    }
  }, [isConnected, location.pathname, conversation]);

  const start = useCallback(async () => {
    if (connecting || isConnected) return;
    setConnecting(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      await conversation.startSession({
        agentId: AGENT_ID,
        connectionType: "webrtc",
      });
      // Contexto inicial logo após conectar.
      setTimeout(() => {
        try { conversation.sendContextualUpdate(describeRoute(location.pathname)); } catch {}
      }, 300);
    } catch (e) {
      console.error("[AssistenteSISLAC] start", e);
      toast.error("Permita o microfone para falar com o Assistente SISLAC");
    } finally {
      setConnecting(false);
    }
  }, [conversation, connecting, isConnected, location.pathname]);

  const stop = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  const onClick = isConnected ? stop : start;
  const label = isConnected ? "Encerrar Assistente SISLAC" : "Falar com o Assistente SISLAC";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "fixed bottom-4 left-4 z-40 h-10 w-10 rounded-lg",
        "flex items-center justify-center border border-border",
        "bg-background text-foreground shadow-sm hover:bg-accent transition-colors",
        isConnected && "bg-primary text-primary-foreground border-primary hover:bg-primary/90",
        isSpeaking && "animate-pulse",
      )}
    >
      {connecting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isConnected ? (
        <MicOff className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </button>
  );
}

export function AssistenteSISLAC() {
  return (
    <ConversationProvider>
      <AssistenteSISLACInner />
    </ConversationProvider>
  );
}

export default AssistenteSISLAC;
