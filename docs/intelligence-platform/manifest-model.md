# Manifest Model — Fase 2.1

## Estrutura
```ts
interface Manifest {
  version: string;        // ex.: "2.1.0"
  generatedAt: string;    // ISO
  items: ManifestItem[];  // ordenadas por priority asc
}

interface ManifestItem {
  id: string;                                 // "paciente.search"
  title: string;
  description: string;
  category: "paciente" | "atendimento" | "exames" | "resultados"
          | "soroteca" | "financeiro" | "whatsapp" | "producao" | "configuracao";
  visibility: "always" | "contextual" | "hidden" | "disabled" | "experimental";
  priority: number;                           // menor = mais relevante
  icon: string;                               // nome lucide-react
  color: "primary" | "secondary" | "muted" | "destructive";
  enabled: boolean;                           // computed: visibility != disabled && permissão concedida
  needsApproval: boolean;
  quickAction: boolean;
  supportsSuggestions: boolean;
  baselineSeconds: number;
  baselineClicks: number;
  permission: string | null;
  promptTemplate?: string;
}
```

## Derivação
`buildManifest(allowedIds)` filtra `CAPABILITIES`, remove `hidden`, computa `enabled`
e ordena por `priority`. Não copia campos sensíveis (`actions`, `tool`, etc.).

## Transporte
- Endpoint: `GET /functions/v1/ai-manifest` (requer JWT).
- Header `cache-control: private, max-age=60`.
- Header `x-manifest-version` permite invalidação no cliente.
