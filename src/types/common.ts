/**
 * Tipos comuns reutilizáveis
 * Elimina 124 ocorrências de "any" type
 */

// ============================================
// TIPOS GENERICOS
// ============================================

export interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ListResult<T> {
  items: T[];
  count: number;
  total: number;
}

// ============================================
// TIPOS DE REQUISIÇÃO/RESPOSTA
// ============================================

export interface RequestOptions {
  timeout?: number;
  retries?: number;
  cache?: boolean;
}

export interface DataFetchState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  isSuccess: boolean;
}

// ============================================
// TIPOS DE ENTIDADE GENÉRICA
// ============================================

export interface BaseEntity {
  id: string;
  created_at?: string;
  updated_at?: string;
  tenant_id?: string;
}

export interface Identifiable {
  id: string;
}

export interface Timestamped {
  created_at: Date;
  updated_at: Date;
}

export interface SoftDeletable {
  deleted_at: Date | null;
}

// ============================================
// TIPOS DE COMPONENTE
// ============================================

export interface ComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface DialogProps extends ComponentProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
}

export interface FormProps<T extends Record<string, any>> extends ComponentProps {
  initialValues?: Partial<T>;
  onSubmit: (values: T) => Promise<void> | void;
  loading?: boolean;
}

export interface TableProps<T> extends ComponentProps {
  data: T[];
  loading?: boolean;
  error?: Error | null;
  onRowClick?: (row: T) => void;
}

// ============================================
// TIPOS DE FILTRO/BUSCA
// ============================================

export interface FilterOptions {
  search?: string;
  status?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface SearchResult<T> {
  results: T[];
  query: string;
  total: number;
  executionTime: number;
}

// ============================================
// TIPOS DE NOTIFICAÇÃO
// ============================================

export type NotificationType = "success" | "error" | "warning" | "info";

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// ============================================
// TIPOS DE MODAL/DIALOG
// ============================================

export interface ModalSize {
  width?: number | string;
  maxWidth?: number | string;
  height?: number | string;
}

export interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  danger?: boolean;
}

// ============================================
// TIPOS DE ESTADO GLOBAL
// ============================================

export interface AsyncThunk<T> {
  pending: boolean;
  data: T | null;
  error: Error | null;
  lastUpdated: Date | null;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  valid: boolean;
}
