// SSOT — escape de strings para inclusão segura em HTML.
//
// Decisões:
// - aceita `unknown` e coage com `String(s ?? "")` (evita exceções em null/undefined/number)
// - remove caracteres de controle invisíveis (exceto \t, \n, \r) que poderiam
//   corromper o layout do PDF / parsing do navegador
// - escapa &, <, >, ", ', /
//   • `'` é escapado como `&#39;` (forma canônica e mais curta que `&#039;`)
//   • `/` é escapado para evitar quebra acidental de `</script>` em contextos
//     onde a string termina dentro de uma tag
//
// Esta é a ÚNICA implementação no projeto. Não duplique. Não reimplemente.

export function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\//g, "&#x2F;");
}
