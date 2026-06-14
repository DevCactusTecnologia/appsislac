// Página oficial de validação do CKEditor 5 — /admin/ckeditor-test.
// Permite testar: tabelas, mesclagem, colagem Word/Excel, preservação de
// variáveis {{...}} e impressão.

import { useState } from "react";
import CKEditor from "@/components/editor/CKEditor";
import { Button } from "@/components/ui/button";

const TEMPLATE_INICIAL = `
<h1>Laudo de Exame — Teste</h1>
<p><strong>Paciente:</strong> {{PACIENTE}} &nbsp; <strong>Idade:</strong> {{IDADE}} &nbsp; <strong>Sexo:</strong> {{SEXO}}</p>
<p><strong>Exame:</strong> {{EXAME}}</p>
<p><strong>Coleta:</strong> {{DATA_COLETA}} &nbsp; <strong>Resultado:</strong> {{DATA_RESULTADO}}</p>
<h2>Resultado</h2>
<p>{{RESULTADO}}</p>
<table>
  <thead><tr><th>Parâmetro</th><th>Valor</th><th>Referência</th></tr></thead>
  <tbody>
    <tr><td>Hemoglobina</td><td>14.2</td><td>13.0 – 17.0</td></tr>
    <tr><td>Hematócrito</td><td>42.5</td><td>40 – 50</td></tr>
  </tbody>
</table>
<p>{{ASSINATURA}}</p>
`.trim();

const VARIAVEIS_ESPERADAS = [
  "{{PACIENTE}}", "{{IDADE}}", "{{SEXO}}", "{{EXAME}}",
  "{{RESULTADO}}", "{{ASSINATURA}}", "{{DATA_COLETA}}", "{{DATA_RESULTADO}}",
];

const CKEditorTest = () => {
  const [html, setHtml] = useState(TEMPLATE_INICIAL);

  const variaveisPreservadas = VARIAVEIS_ESPERADAS.filter((v) => html.includes(v));

  const handlePrint = () => {
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Teste de impressão</title>
      <style>body{font-family:Inter,system-ui,sans-serif;font-size:12pt;padding:20mm}
      table{border-collapse:collapse;width:100%}td,th{border:1px solid #888;padding:4px 6px}</style>
      </head><body>${html}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">CKEditor 5 — Página de teste</h1>
        <p className="text-sm text-muted-foreground">
          Editor oficial do SISLAC. Use esta tela para validar tabelas, mesclagem,
          colagem do Word/Excel, preservação de variáveis e impressão.
        </p>
      </header>

      <section className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-2.5 text-xs font-medium text-muted-foreground">
          Editor
        </div>
        <div className="p-3">
          <CKEditor value={html} onChange={setHtml} placeholder="Escreva aqui…" />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-xs font-medium text-muted-foreground">Pré-visualização HTML renderizada</span>
            <Button size="sm" variant="outline" onClick={handlePrint}>Imprimir</Button>
          </div>
          <div
            className="prose-mapa a4-sheet text-[13px] leading-snug p-4"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>

        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-2.5 text-xs font-medium text-muted-foreground">
            HTML bruto (saída do editor)
          </div>
          <pre className="text-[11px] leading-relaxed p-4 overflow-auto max-h-[420px] whitespace-pre-wrap break-all">
            {html}
          </pre>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold mb-2">Preservação de variáveis</h2>
        <ul className="text-xs grid grid-cols-2 md:grid-cols-4 gap-1">
          {VARIAVEIS_ESPERADAS.map((v) => {
            const ok = variaveisPreservadas.includes(v);
            return (
              <li key={v} className={ok ? "text-status-success" : "text-status-danger"}>
                {ok ? "✓" : "✗"} {v}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {variaveisPreservadas.length} de {VARIAVEIS_ESPERADAS.length} variáveis presentes no HTML atual.
        </p>
      </section>
    </div>
  );
};

export default CKEditorTest;
