// Geração do Dossiê de Rastreabilidade RDC 978/2025 em PDF.
// Consolida toda a linha do tempo de um atendimento: orientações, identidade,
// coleta, análise, valores críticos comunicados, liberação e entrega.

import { db as supabase } from "@/runtime/db";
import { fetchAuditLogsByProtocolo } from "@/data/auditoriaStore";
import {
  listarCriticosPorAtendimento,
  listarEntregasPorAtendimento,
  listarConfirmacoesPorAtendimento,
  listarOrientacoesPorAtendimento,
} from "@/data/rastreabilidadeStore";
import { escapeHtml } from "@/lib/escapeHtml";

function fmt(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR");
}

export async function gerarDossieRastreabilidade(protocolo: string): Promise<void> {
  // 1) Atendimento + paciente
  const { data: atend } = await supabase
    .from("atendimentos")
    .select("id, protocolo, paciente_nome, paciente_cpf, paciente_nascimento, data, status_atendimento, status_pagamento, convenio_nome, solicitante, unidade_id")
    .eq("protocolo", protocolo)
    .maybeSingle();

  if (!atend) { throw new Error("Atendimento não encontrado"); }
  const atId = atend.id as number;

  // 2) Coletas paralelas
  const [exames, audit, criticos, entregas, identidades, orientacoes] = await Promise.all([
    supabase.from("atendimento_exames").select("id, nome_exame, status, coletor, analista, data_coleta, data_analise, data_liberacao, amostra_id, pop_versao").eq("atendimento_id", atId).order("ordem"),
    fetchAuditLogsByProtocolo(protocolo),
    listarCriticosPorAtendimento(atId),
    listarEntregasPorAtendimento(atId),
    listarConfirmacoesPorAtendimento(atId),
    listarOrientacoesPorAtendimento(atId),
  ]);

  const exRows = (exames.data ?? []) as any[];

  // 3) HTML
  const css = `
    @page { size: A4; margin: 18mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 11px; line-height: 1.4; }
    h1 { font-size: 16px; margin: 0 0 4px 0; }
    h2 { font-size: 13px; margin: 16px 0 6px 0; padding-bottom: 4px; border-bottom: 1px solid #ddd; color: #1f2937; }
    .header { border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 12px; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; font-size: 11px; }
    .meta strong { color: #444; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; }
    th, td { text-align: left; padding: 5px 6px; border-bottom: 1px solid #eee; vertical-align: top; }
    th { background: #f5f5f5; font-weight: 600; font-size: 10px; text-transform: uppercase; color: #555; }
    .badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 9px; background: #eef; color: #225; }
    .empty { color: #888; font-style: italic; padding: 6px; }
    .footer { margin-top: 18px; padding-top: 6px; border-top: 1px solid #ddd; font-size: 9px; color: #666; text-align: center; }
    .timeline-row td:first-child { white-space: nowrap; color: #555; font-family: monospace; font-size: 10px; }
  `;

  const sec = (title: string, body: string) => `<h2>${escapeHtml(title)}</h2>${body}`;
  const empty = (msg: string) => `<div class="empty">${escapeHtml(msg)}</div>`;

  const blocoOrientacoes = orientacoes.length === 0 ? empty("Nenhuma orientação registrada.") : `
    <table><thead><tr><th>Data/Hora</th><th>Canal</th><th>Itens orientados</th><th>Por</th></tr></thead><tbody>
    ${orientacoes.map(o => `<tr>
      <td>${fmt(o.entregueEm)}</td>
      <td>${escapeHtml(o.canal)}</td>
      <td>${o.itensOrientados.map(i => `<div>• ${escapeHtml(i)}</div>`).join("")}${o.observacao ? `<div style="color:#666;margin-top:3px">${escapeHtml(o.observacao)}</div>` : ""}</td>
      <td>${escapeHtml(o.entreguePorEmail)}</td>
    </tr>`).join("")}
    </tbody></table>`;

  const blocoIdentidade = identidades.length === 0 ? empty("Confirmação de identidade não registrada.") : `
    <table><thead><tr><th>Data/Hora</th><th>Identificadores</th><th>Confirmado por</th></tr></thead><tbody>
    ${identidades.map(i => `<tr>
      <td>${fmt(i.confirmadoEm)}</td>
      <td>${i.identificadores.map(x => `<span class="badge">${escapeHtml(x)}</span>`).join(" ")}</td>
      <td>${escapeHtml(i.confirmadoPorEmail)}</td>
    </tr>`).join("")}
    </tbody></table>`;

  const blocoExames = exRows.length === 0 ? empty("Nenhum exame.") : `
    <table><thead><tr><th>Exame</th><th>Status</th><th>Coletor / Coleta</th><th>Analista / Análise</th><th>Liberação</th><th>POP</th></tr></thead><tbody>
    ${exRows.map(e => `<tr>
      <td>${escapeHtml(e.nome_exame)}</td>
      <td>${escapeHtml(e.status)}</td>
      <td>${escapeHtml(e.coletor || "—")}<br><span style="color:#666;font-size:10px">${fmt(e.data_coleta)}</span></td>
      <td>${escapeHtml(e.analista || "—")}<br><span style="color:#666;font-size:10px">${fmt(e.data_analise)}</span></td>
      <td>${fmt(e.data_liberacao)}</td>
      <td>${escapeHtml(e.pop_versao || "—")}</td>
    </tr>`).join("")}
    </tbody></table>`;

  const blocoCriticos = criticos.length === 0 ? empty("Nenhum valor crítico comunicado.") : `
    <table><thead><tr><th>Data/Hora</th><th>Exame / Parâmetro</th><th>Valor</th><th>Canal</th><th>Destinatário</th><th>Por</th></tr></thead><tbody>
    ${criticos.map(c => `<tr>
      <td>${fmt(c.comunicadoEm)}</td>
      <td>${escapeHtml(c.exameNome)}<br><span style="color:#666;font-size:10px">${escapeHtml(c.parametro)}</span></td>
      <td><strong>${escapeHtml(c.valor)}</strong><br><span style="color:#666;font-size:10px">crítico: ${escapeHtml(c.faixaCritica)}</span></td>
      <td>${escapeHtml(c.canal)}</td>
      <td>${escapeHtml(c.destinatarioNome)}<br><span style="color:#666;font-size:10px">${escapeHtml(c.destinatarioContato)}</span></td>
      <td>${escapeHtml(c.comunicadoPorEmail)}</td>
    </tr>`).join("")}
    </tbody></table>`;

  const blocoEntregas = entregas.length === 0 ? empty("Laudo ainda não entregue.") : `
    <table><thead><tr><th>Data/Hora</th><th>Canal</th><th>Recebedor</th><th>Por</th></tr></thead><tbody>
    ${entregas.map(e => `<tr>
      <td>${fmt(e.entregueEm)}</td>
      <td>${escapeHtml(e.canal)}</td>
      <td>${escapeHtml(e.destinatarioNome)}<br><span style="color:#666;font-size:10px">${escapeHtml(e.destinatarioContato)}</span></td>
      <td>${escapeHtml(e.entreguePorEmail)}</td>
    </tr>`).join("")}
    </tbody></table>`;

  const blocoTimeline = audit.length === 0 ? empty("Sem eventos auditados.") : `
    <table><thead><tr><th style="width:130px">Quando</th><th>Ação</th><th>Usuário</th></tr></thead><tbody>
    ${audit.map(a => `<tr class="timeline-row">
      <td>${escapeHtml(a.dataHora)}</td>
      <td>${escapeHtml(a.acao)}${a.justificativa ? `<br><span style="color:#666;font-size:10px">${escapeHtml(a.justificativa)}</span>` : ""}</td>
      <td>${escapeHtml(a.usuario)}</td>
    </tr>`).join("")}
    </tbody></table>`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Dossiê de Rastreabilidade — ${escapeHtml(protocolo)}</title><style>${css}</style></head>
  <body>
    <div class="header">
      <h1>Dossiê de Rastreabilidade</h1>
      <div style="font-size:11px;color:#555">RDC 978/2025 — Art. 128 · Emitido em ${fmt(new Date().toISOString())}</div>
    </div>
    <div class="meta">
      <div><strong>Protocolo:</strong> ${escapeHtml(atend.protocolo)}</div>
      <div><strong>Data atendimento:</strong> ${fmt(atend.data)}</div>
      <div><strong>Paciente:</strong> ${escapeHtml(atend.paciente_nome)}</div>
      <div><strong>CPF:</strong> ${escapeHtml(atend.paciente_cpf)}</div>
      <div><strong>Nascimento:</strong> ${atend.paciente_nascimento ?? "—"}</div>
      <div><strong>Convênio:</strong> ${escapeHtml(atend.convenio_nome)}</div>
      <div><strong>Solicitante:</strong> ${escapeHtml(atend.solicitante)}</div>
      <div><strong>Status atual:</strong> ${escapeHtml(atend.status_atendimento)}</div>
    </div>
    ${sec("1. Fase pré-analítica — Orientações entregues", blocoOrientacoes)}
    ${sec("2. Fase pré-analítica — Confirmação de identidade", blocoIdentidade)}
    ${sec("3. Exames, coleta e execução", blocoExames)}
    ${sec("4. Valores críticos comunicados", blocoCriticos)}
    ${sec("5. Entrega do laudo ao solicitante/paciente", blocoEntregas)}
    ${sec("6. Linha do tempo completa (auditoria)", blocoTimeline)}
    <div class="footer">Documento gerado automaticamente pelo SISLAC para fins de comprovação regulatória — RDC ANVISA 978/2025.</div>
  </body></html>`;

  // Imprime via janela: usa o navegador para gerar PDF (Salvar como PDF)
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) throw new Error("Bloqueador de popups impediu a impressão");
  w.document.open();
  w.document.write(html);
  w.document.close();
  // Aguarda renderização
  await new Promise<void>((resolve) => { w.addEventListener("load", () => resolve(), { once: true }); setTimeout(() => resolve(), 600); });
  w.focus();
  w.print();
}