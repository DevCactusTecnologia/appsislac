# Super-Admin — UX Audit
> Auditor: Senior Architect + SaaS PO | Date: 2025-01-31 | SISLAC Control Plane

---

## 1. Overall UX Assessment

The super-admin panel has a **coherent visual language** (rounded corners, card-based layout, status badges, consistent typography scale). Navigation between sections is clear. However several critical-action patterns violate safety and clarity principles.

---

## 2. SuperAdminLogin

| Observation | Severity | Evidence |
|---|---|---|
| Warning banner about monitoring present | ✅ Good | Line 91-97 |
| Password show/hide toggle | ✅ Good | Lines 132-140 |
| Last email remembered in localStorage | ✅ Convenience | Line 10-18 |
| No rate limiting feedback to user | ⚠ Gap | Multiple failed attempts show generic toast |
| No "forgot password" for super admins | ⚠ Gap | By design (acceptable for restricted area) |
| No MFA prompt | 🔴 Risk | High-privilege account with email+password only |

---

## 3. SuperAdminTenants (List)

| Observation | Severity | Evidence |
|---|---|---|
| Rich cards showing plan, MRR, metrics, admin | ✅ Good | Lines 146-228 |
| Status filter with active pill indicator | ✅ Good | Lines 98-136 |
| Client-side search (fast, no round-trip) | ✅ Good | `useMemo` filter |
| No pagination | ⚠ Gap | At 100+ labs the list becomes unwieldy |
| No sorting controls | ⚠ Gap | Fixed order from `super-admin-list-tenants` |
| "Novo laboratório" button prominent | ✅ Good | |
| Empty state if all filtered out | ⚠ Gap | No "no results" empty state rendered |

---

## 4. SuperAdminNovoLab (Wizard)

| Observation | Severity | Evidence |
|---|---|---|
| 5-step stepper with visual progress | ✅ Good | Stepper component |
| Can jump to any step directly | ⚠ Risk | No validation on step jump |
| Only step 1 validates before advance | 🔴 Critical gap | `errorsByStep` only has step 1 logic |
| Healthcheck in step 5 is client-only simulation | ⚠ Gap | `runHealthcheck` checks form values, not real server state |
| No confirmation modal before submission | ⚠ Gap | "Ativar laboratório" fires immediately on click |
| Step 4 "Integrações" is informational only | ⚠ Gap | All integration cards are `opacity-60` with no interaction |
| `StepBranding` function defined but never used | 🟡 Dead code | Lines 377-405 |
| Draft sidebar shows live form values | ✅ Good | |
| Lab code auto-generation explained | ✅ Good | Hint text |

---

## 5. SuperAdminTenantDetalhe (1160 lines)

### 5.1 Header & Navigation
| Observation | Severity | Evidence |
|---|---|---|
| Clear back link to list | ✅ Good | Line 397 |
| Status badge next to lab name | ✅ Good | Line 411 |
| "Suspender/Reativar" always visible in header | ⚠ Risk | High-impact action in persistent header, one click away |

### 5.2 Tab Structure
| Observation | Severity | Evidence |
|---|---|---|
| 5 tabs cover logical domains | ✅ Good | identidade, plano, operacao, banco, seguranca |
| No URL routing per tab | ⚠ Gap | Tab state lost on page refresh; no deep-linkable tabs |
| Active tab not persisted across navigation | ⚠ Gap | Always starts on "identidade" |

### 5.3 Identidade Tab
| Observation | Severity | Evidence |
|---|---|---|
| Inline edit pattern (pencil → form → save/cancel) | ✅ Good | Lines 446-459 |
| Slug and lab_code shown but disabled (immutable) | ✅ Good | Lines 489-490 |
| Admin user card with last login | ✅ Good | Line 512 |
| Technical details collapsed by default | ✅ Good | `showTechnical` state |
| **Danger Zone** co-located with identity data | 🔴 Risk | Delete button in same scroll area as edit; no separate page |

### 5.4 Suspender Dialog
```
Current: Button → Dialog → [Reativar/Suspender] button
```
- Dialog text is not shown in the visible code excerpt — unclear if it explains consequences
- No typed confirmation (like delete dialog requires)
- A single misclick after the first confirmation click could suspend a live lab

### 5.5 Delete Dialog
| Observation | Severity | Evidence |
|---|---|---|
| Requires typing exact lab name | ✅ Good | `deleteConfirmName` validation |
| Explains irreversibility | ✅ Good | Line 562 description text |
| No countdown / "wait 5 seconds" protection | ⚠ Gap | Submit enabled as soon as name matches |

### 5.6 Plan Tab
| Observation | Severity | Evidence |
|---|---|---|
| Current plan with all stats visible | ✅ Good | Lines 585-636 |
| Plan change dialog with cycle selector | ✅ Good | |
| No price difference shown before confirming | ⚠ Gap | User can accidentally downgrade without seeing impact |
| Trial end date shown | ✅ Good | Line 598 |
| Canceled_at warning shown | ✅ Good | Lines 617-624 |

### 5.7 Operação Tab
| Observation | Severity | Evidence |
|---|---|---|
| Live metrics displayed | ✅ Good | MetricCard components |
| "Acesso de suporte técnico" Switch is decorative | 🔴 Critical UX issue | `<Switch defaultChecked />` — no handler, no persistence (line 672) |
| Appears functional to users | 🔴 Misleading | Users believe they're toggling something |

### 5.8 Banco Tab
| Observation | Severity | Evidence |
|---|---|---|
| Backup section correctly hidden for isolated_db | ✅ Good | `!isolatedDb` conditional (line 695) |
| Three backup formats clearly labeled | ✅ Good | |
| No estimated download size shown | ⚠ Gap | |
| Health check timestamp shown | ✅ Good | Line 748 |

### 5.9 Segurança Tab
| Observation | Severity | Evidence |
|---|---|---|
| Users by profile shown | ✅ Good | |
| Last admin login displayed | ✅ Good | Line 776 |
| No 2FA status visible | ⚠ Gap | |
| No failed login attempts visible | ⚠ Gap | |

---

## 6. SuperAdminInscricoes

| Observation | Severity | Evidence |
|---|---|---|
| Rich detail dialog | ✅ Good | |
| Status change inline | ✅ Good | |
| "Converter Cliente" button is a stub | 🔴 Critical gap | `toast.info("será implementada em breve")` — broken call-to-action (line 206) |
| Delete uses `window.confirm()` | ⚠ UX inconsistency | All other deletes use Dialog; this uses native browser confirm |
| WhatsApp link generation correct | ✅ Good | |
| Observations text area present | ✅ Good | |

---

## 7. SuperAdminPlanos

| Observation | Severity | Evidence |
|---|---|---|
| Plan card grid with key info | ✅ Good | PlanCard component |
| Inline plan creation/edit dialog | ✅ Good | |
| Code field disabled when editing (immutability) | ✅ Good | Line 184 |
| Delete blocked when plan in use | ✅ Good | Server-side check |
| AlertDialog for delete confirmation | ✅ Good | |
| No drag-to-reorder for sort_order | ⚠ Gap | `sort_order` field exists but requires manual number entry |

---

## 8. SuperAdminConfiguracoes

| Observation | Severity | Evidence |
|---|---|---|
| Integration tabs for each provider | ✅ Good | |
| "Test connection" button per integration | ✅ Good | |
| Secret fields have show/hide toggles | ✅ Good | `revealKeys` state |
| "AES-256" badge is cosmetically misleading | 🔴 UX deception | Line 312 — no actual encryption at app layer |
| No unsaved-changes warning on tab switch | ⚠ Gap | Editing SMTP then switching to S3 tab silently discards |
| Dirty state detection per-integration | ✅ Good | `isSmtpDirty`, etc. |

---

## 9. SuperAdminAuditoria

| Observation | Severity | Evidence |
|---|---|---|
| Table + mobile card layouts | ✅ Good | |
| Lab filter dropdown | ✅ Good | |
| Pagination bar | ✅ Good | |
| 500-row cap with no warning to user | 🔴 Gap | User believes they see all events |
| No export button | ⚠ Gap | |
| No date range filter | ⚠ Gap | Only text search + tenant filter |
| "pós-finalização" and "crítico" flags highlighted | ✅ Good | FlagPill components |

---

## 10. SuperAdminDashboard

| Observation | Severity | Evidence |
|---|---|---|
| Clear KPIs (total/active tenants, health) | ✅ Good | |
| "Alertas do sistema" card is static "Nenhum incidente" | ⚠ Gap | Hardcoded; no real alert feed |
| "Integrações federadas" always shows "Online" | ⚠ Gap | Hardcoded (lines 171-173); not reflecting actual status |
| Link to /super-admin/tenants (wrong path) | 🟡 Bug | Dashboard card links to `/super-admin/tenants` (line 104) but actual route appears to be `/super-admin/laboratorios` per other pages |

---

## 11. Key UX Recommendations (Priority Order)

1. **P0**: Remove misleading "AES-256" badge or implement actual encryption
2. **P0**: Fix "Support Access" switch — either implement or remove
3. **P0**: Fix "Converter Cliente" stub — implement or hide the button
4. **P1**: Add typed confirmation for suspension (currently single-click in dialog)
5. **P1**: Fix dashboard hardcoded statuses (alerts, integrations)
6. **P1**: Add validation to wizard steps 2-5 before submission
7. **P1**: Add audit log for suspension, plan changes, impersonation
8. **P2**: Add pagination to tenant list
9. **P2**: Add unsaved-changes warning in Configuracoes tabs
10. **P2**: Make Auditoria 500-row cap visible or implement server-side pagination
