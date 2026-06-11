/**
 * Gera relatório de conformidade LGPD em PDF, on-demand,
 * com base nas práticas implementadas no SISLAC.
 */
export async function gerarRelatorioLGPD(tenantNome: string = "Laboratório"): Promise<void> {
  const esc = (v: unknown): string =>
    v === null || v === undefined
      ? ""
      : String(v)
          .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/`/g, "&#96;");
  // Carrega html2pdf sob demanda para não inflar o chunk inicial.
  const html2pdf = (await import("html2pdf.js")).default as unknown as () => {
    set: (o: unknown) => { from: (el: HTMLElement) => { save: () => Promise<void> } };
  };
  const hoje = new Date().toLocaleDateString("pt-BR");
  const container = document.createElement("div");
  // Mantém o elemento no fluxo (com layout real) mas invisível para o usuário.
  // html2canvas falha em capturar elementos com `left:-9999px` ou fora da viewport.
  container.style.position = "absolute";
  container.style.left = "0";
  container.style.top = "0";
  container.style.zIndex = "-1";
  container.style.opacity = "0";
  container.style.pointerEvents = "none";
  container.style.width = "794px"; // 210mm @ 96dpi
  container.style.background = "#ffffff";
  container.style.color = "#111111";
  container.style.fontFamily = "Inter, system-ui, sans-serif";
  container.innerHTML = `
    <div style="padding:32px 36px; font-size:11pt; line-height:1.55;">
      <div style="border-bottom:2px solid #2563eb; padding-bottom:12px; margin-bottom:20px;">
        <h1 style="margin:0; font-size:20pt; color:#1e3a8a;">Relatório de Conformidade LGPD</h1>
        <p style="margin:6px 0 0; font-size:10pt; color:#475569;">
          ${esc(tenantNome)} — emitido em ${esc(hoje)}
        </p>
      </div>

      <h2 style="font-size:13pt; color:#1e3a8a; margin:18px 0 8px;">1. Bases legais para tratamento de dados</h2>
      <ul style="margin:0 0 12px 18px;">
        <li><b>Execução de contrato</b> (art. 7º, V): cadastro de pacientes, atendimentos, coletas e laudos.</li>
        <li><b>Cumprimento de obrigação legal</b> (art. 7º, II): retenção de prontuários e laudos exigida pela legislação sanitária.</li>
        <li><b>Tutela da saúde</b> (art. 11, II, "f"): tratamento de dados sensíveis por profissionais de saúde.</li>
        <li><b>Legítimo interesse</b> (art. 7º, IX): logs de auditoria para segurança operacional.</li>
      </ul>

      <h2 style="font-size:13pt; color:#1e3a8a; margin:18px 0 8px;">2. Política de retenção</h2>
      <ul style="margin:0 0 12px 18px;">
        <li>Prontuários e laudos: <b>20 anos</b> após o último atendimento (CFM 1.821/2007).</li>
        <li>Documentos fiscais e financeiros: <b>5 anos</b> a partir da emissão.</li>
        <li>Logs de auditoria (<code>audit_logs</code>, <code>atendimento_audit</code>): <b>5 anos</b>.</li>
        <li>Dados de pacientes inativos sem vínculo legal: anonimizados após o prazo.</li>
      </ul>

      <h2 style="font-size:13pt; color:#1e3a8a; margin:18px 0 8px;">3. Logs de acesso e auditoria</h2>
      <p style="margin:0 0 8px;">O sistema mantém trilhas auditáveis em três níveis:</p>
      <ul style="margin:0 0 12px 18px;">
        <li><b>audit_logs</b>: operações administrativas (criação/edição/remoção de cadastros).</li>
        <li><b>atendimento_audit</b>: alterações em atendimentos e exames pós-finalização (com justificativa obrigatória).</li>
        <li><b>app_settings_audit</b>: alterações em parâmetros sensíveis do tenant.</li>
        <li>Acesso por usuário, IP e horário registrados via Supabase Auth.</li>
      </ul>

      <h2 style="font-size:13pt; color:#1e3a8a; margin:18px 0 8px;">4. Mascaramento e minimização</h2>
      <ul style="margin:0 0 12px 18px;">
        <li>CPF, telefone e e-mail mascarados por padrão nas listagens (Pacientes, Especialistas).</li>
        <li>Botão "olho" requer ação consciente para revelar dados sensíveis.</li>
        <li>Resultados de exames acessíveis somente a usuários do mesmo tenant via RLS.</li>
        <li>Isolamento multi-tenant aplicado em <b>todas</b> as tabelas via <code>tenant_id</code>.</li>
      </ul>

      <h2 style="font-size:13pt; color:#1e3a8a; margin:18px 0 8px;">5. Direitos do titular</h2>
      <ul style="margin:0 0 12px 18px;">
        <li>Acesso, correção e portabilidade atendidos via canal de suporte do laboratório.</li>
        <li>Eliminação restrita por obrigação legal de guarda de prontuário.</li>
        <li>Revogação de consentimento aplicada quando não houver outra base legal vigente.</li>
      </ul>

      <p style="margin-top:28px; font-size:9pt; color:#64748b; border-top:1px solid #e2e8f0; padding-top:10px;">
        Documento gerado automaticamente pelo SISLAC. Revisar e assinar pelo Encarregado (DPO) antes da publicação.
      </p>
    </div>
  `;
  document.body.appendChild(container);
  try {
    await html2pdf()
      .set({
        margin: 0,
        filename: `LGPD_Conformidade_${hoje.replace(/\//g, "-")}.pdf`,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          width: 794,
          windowWidth: 794,
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(container)
      .save();
  } finally {
    container.remove();
  }
}