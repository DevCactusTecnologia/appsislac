/**
 * Gera relatório de conformidade LGPD via impressão vetorial nativa
 * (`window.print()`). O usuário escolhe "Salvar como PDF" no diálogo
 * do navegador. Sem dependência de html2pdf/html2canvas — texto
 * selecionável, vetorial e instantâneo.
 */
import { printHtmlInHiddenFrame } from "@/lib/printHtml";
import { wrapA4Document } from "@/lib/printShell";
import { buildAdminReportHeader } from "@/lib/adminReportHeader";

export async function gerarRelatorioLGPD(_tenantNome: string = "Laboratório"): Promise<void> {
  const hoje = new Date().toLocaleDateString("pt-BR");
  const filename = `LGPD_Conformidade_${hoje.replace(/\//g, "-")}`;

  const bodyHtml = `
  ${buildAdminReportHeader({ titulo: "Relatório de Conformidade LGPD" })}

  <h2>1. Bases legais para tratamento de dados</h2>
  <ul>
    <li><b>Execução de contrato</b> (art. 7º, V): cadastro de pacientes, atendimentos, coletas e laudos.</li>
    <li><b>Cumprimento de obrigação legal</b> (art. 7º, II): retenção de prontuários e laudos exigida pela legislação sanitária.</li>
    <li><b>Tutela da saúde</b> (art. 11, II, "f"): tratamento de dados sensíveis por profissionais de saúde.</li>
    <li><b>Legítimo interesse</b> (art. 7º, IX): logs de auditoria para segurança operacional.</li>
  </ul>

  <h2>2. Política de retenção</h2>
  <ul>
    <li>Prontuários e laudos: <b>20 anos</b> após o último atendimento (CFM 1.821/2007).</li>
    <li>Documentos fiscais e financeiros: <b>5 anos</b> a partir da emissão.</li>
    <li>Logs de auditoria (<code>audit_logs</code>, <code>atendimento_audit</code>): <b>5 anos</b>.</li>
    <li>Dados de pacientes inativos sem vínculo legal: anonimizados após o prazo.</li>
  </ul>

  <h2>3. Logs de acesso e auditoria</h2>
  <p>O sistema mantém trilhas auditáveis em três níveis:</p>
  <ul>
    <li><b>audit_logs</b>: operações administrativas (criação/edição/remoção de cadastros).</li>
    <li><b>atendimento_audit</b>: alterações em atendimentos e exames pós-finalização (com justificativa obrigatória).</li>
    <li><b>app_settings_audit</b>: alterações em parâmetros sensíveis do tenant.</li>
    <li>Acesso por usuário, IP e horário registrados via Supabase Auth.</li>
  </ul>

  <h2>4. Mascaramento e minimização</h2>
  <ul>
    <li>CPF, telefone e e-mail mascarados por padrão nas listagens (Pacientes, Especialistas).</li>
    <li>Botão "olho" requer ação consciente para revelar dados sensíveis.</li>
    <li>Resultados de exames acessíveis somente a usuários do mesmo tenant via RLS.</li>
    <li>Isolamento multi-tenant aplicado em <b>todas</b> as tabelas via <code>tenant_id</code>.</li>
  </ul>

  <h2>5. Direitos do titular</h2>
  <ul>
    <li>Acesso, correção e portabilidade atendidos via canal de suporte do laboratório.</li>
    <li>Eliminação restrita por obrigação legal de guarda de prontuário.</li>
    <li>Revogação de consentimento aplicada quando não houver outra base legal vigente.</li>
  </ul>

  <p class="footer">
    Documento gerado automaticamente pelo SISLAC. Revisar e assinar pelo Encarregado (DPO) antes da publicação.
  </p>`;

  const html = wrapA4Document({
    title: filename,
    bodyHtml,
    css: `
      h2 { font-size: 13pt; color: #0f172a; margin: 18px 0 8px; }
      ul { margin: 0 0 12px 18px; }
      .footer { margin-top: 28px; font-size: 9pt; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 10px; }
    `,
  });

  printHtmlInHiddenFrame({ html, documentTitle: filename });
}

