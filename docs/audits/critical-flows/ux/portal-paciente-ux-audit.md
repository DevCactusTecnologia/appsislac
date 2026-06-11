# Portal Paciente — UX Audit

**Date:** 2025-07

---

## 1. Public Landing (`/site/:slug`)

| # | Observation | Severity | Evidence |
|---|---|---|---|
| U-01 | No skeleton/placeholder while loading; spinner only (`TenantSite.tsx:81-86`). Blank white screen on slow connections with no content hint. | Medium | `TenantSite.tsx:80-86` |
| U-02 | `notFound` redirects to `/` silently. The patient receives no feedback that the lab URL is incorrect — they land on the SISLAC SaaS homepage without explanation. | Medium | `TenantSite.tsx:79` |
| U-03 | Contact page (`TenantSiteContato.tsx`) reuses `whatsapp_contato` for both WhatsApp and phone ("Telefone") links, showing the same number twice with no differentiation. | Low | `TenantSiteContato.tsx:99-110` |
| U-04 | If no `whatsapp` is configured, the only message is "Nenhum canal de contato direto configurado. Acesse o portal para mais informações" with no link/CTA to the portal. | Low | `TenantSiteContato.tsx:120-124` |
| U-05 | `Sobre` page has hardcoded generic copy ("Trabalhamos com processos rigorosos...") that appears even when the lab has customised its own description. Both texts render simultaneously. | Medium | `TenantSiteSobre.tsx:83-89` |

---

## 2. PDF Shortlink Redirect (`/p/:codigo`)

| # | Observation | Severity | Evidence |
|---|---|---|---|
| U-06 | On error states (`expired`, `notfound`, `error`), the only CTA is "Voltar ao login". A patient who never had a login is stuck. Should offer "Fale com o laboratório" or a WhatsApp link. | High | `RedirectShortlink.tsx:79-83` |
| U-07 | Loading state renders the spinner icon **twice**: once in `messages.loading.icon` and again explicitly at line 74-76. Visual duplication. | Low | `RedirectShortlink.tsx:63-76` |
| U-08 | No tenant branding on the redirect page; the patient has no confirmation they are in the right lab's portal. | Medium | `RedirectShortlink.tsx` (entire file) |

---

## 3. Document Verification (`/verificar/:codigo`)

| # | Observation | Severity | Evidence |
|---|---|---|---|
| U-09 | Algorithm name "FNV-1a" is shown to end-users in the "Como funciona?" tooltip (`VerificarComprovante.tsx:239`). Patients and employers don't need technical implementation details; this erodes trust in "digital security". | Low | `VerificarComprovante.tsx:238-242` |
| U-10 | The form has no auto-fill of the code from the URL param into the form — the code IS pre-filled (`codigoNormalizado`), but the rest of the form (nome, data, protocolo) must be typed manually. For a patient using a smartphone, this is high friction for verification. | High | `VerificarComprovante.tsx:26-45` |
| U-11 | `data` field accepts free text (`placeholder="DD/MM/AAAA"`) with no date picker or format enforcement. A formatting mismatch (e.g., space vs. slash) causes false-negative verification. | High | `VerificarComprovante.tsx:183-191` |
| U-12 | On failed verification, the error message "Verifique se o nome, data e protocolo estão idênticos ao documento impresso" doesn't indicate *which* field is wrong. | Medium | `VerificarComprovante.tsx:134-136` |

---

## 4. Lead / Solicitation Form (embedded in `/site/:slug`)

| # | Observation | Severity | Evidence |
|---|---|---|---|
| U-13 | No success confirmation screen after lead submission. The `submitSolicitacaoPublica` function returns `{ ok: boolean }` but the landing template must handle display — not verified in scoped files. | Medium | `vitrineStore.ts:103-116` |
| U-14 | CPF is optional but there is no explanation to the patient of why it is requested or how it will be used (LGPD transparency requirement). | High (LGPD) | `vitrineStore.ts:69` |

---

## 5. Internal Inbox — Solicitations (`/solicitacoes-site`)

| # | Observation | Severity | Evidence |
|---|---|---|---|
| U-15 | The "Converter" action immediately navigates away to `/novo-atendimento` without confirming patient data with the operator first. If the lead data is incomplete, the operator must return. | Medium | `SolicitacoesSite.tsx:173-196` |
| U-16 | "Receita estimada" KPI (`SolicitacoesSite.tsx:198-201`) excludes `DESCARTADO` but includes `NOVO` and `EM_CONTATO`, which may never convert. Label should clarify "estimativa não-confirmada". | Low | `SolicitacoesSite.tsx:198-200` |
| U-17 | "Não lidas" badge uses `useSolicitacoesNaoLidas` which is a separate Realtime channel from the list channel in `SolicitacoesSite.tsx`. Counter and list can briefly desync on reconnect. | Low | `SolicitacoesSite.tsx:87`, `useSolicitacoesNaoLidas.ts:14` |

---

## 6. Result Consultation (`/consultar-resultados`)

| # | Observation | Severity | Evidence |
|---|---|---|---|
| U-18 | KPI chips (Finalizados/Pendentes/Cancelados) count only the **currently loaded** results in server-side mode, not the full dataset. Users see misleading totals with no disclaimer. | High | `ConsultarResultados.tsx:194-197`, comment line 193 |
| U-19 | "Pendente" tab in server mode has no server-side filtering — it shows all records and then filters client-side. For large datasets this means all records are loaded but only pending are shown. | Medium | `ConsultarResultados.tsx:179-181` |

