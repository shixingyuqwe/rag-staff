// 变量类型枚举
export enum VariableType {
  TEXT = 'TEXT',
  ARRAY_KNOWLEDGE = 'ARRAY_KNOWLEDGE',
  FILE = 'FILE',
  JSON = 'JSON',
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',
  DATE = 'DATE',
  ARRAY_TEXT = 'ARRAY_TEXT',
  ARRAY_FILE = 'ARRAY_FILE',
}

export interface MFFileUploadResponse {
  code: number;
  success: boolean;
  data: {
    fileSn: string;
    fileName: string;
    fileType: string;
    fileSize: string;
  };
  message: string;
}

export interface WorkflowParams {
  agentSn?: string;
  versionSn?: string;
  sessionSn?: string;
  fileSn?: string;
  fileName?: string;
  user?: Record<string, unknown>;
}

export interface WorkflowVariable {
  id: string;
  type: VariableType | string;
  name: string;
  currentValue: any;
  defaultValue?: any;
  isArray: boolean;
  category: string;
  required?: boolean | null;
  enums?: any[] | null;
  source?: string | null;
}

export interface WorkflowStreamEvent {
  event: string;
  eventTime?: number;
  eventStatus?: string;
  session?: string;
  runId?: number;
  data?: WorkflowVariable | WorkflowResult | any;
  nodeId?: string;
  messageId?: string;
}

export interface WorkflowResult {
  output?: Record<string, any>;
  variables?: Record<string, any>;
  files?: Array<{
    fileSn: string;
    fileName: string;
    downloadUrl?: string;
  }>;
  startTime?: string;
  endTime?: string;
  status?: string;
  errorMsg?: string;
}

/** 工作流处理过程中的状态 */
export interface ProcessingState {
  isProcessing: boolean;
  sessionSn: string | null;
  messages: string[];
  result: WorkflowResult | null;
  error: string | null;
}

export interface StreamCallbacks {
  onMessage?: (content: string) => void;
  onProgress?: (event: WorkflowStreamEvent) => void;
  onComplete?: (result: WorkflowResult) => void;
  onError?: (error: Error) => void;
}

// ── 人事系统特有的结果类型 ──

/** 升降级评分计算结果 */
export interface ScoringResult {
  success: boolean;
  scene: string;
  message: string;
  summary: {
    total_assessed: number;
    needs_review_count: number;
    score_compliance_rate: string;
    training_compliance_rate: string;
    upgrade_count: number;
    maintain_count: number;
    downgrade_count: number;
  };
  /** 入职评分计算数据 */
  entry_scores: Array<{
    recruiter_id: string;
    recruiter_name: string;
    latest_month_score: number;
    avg_valid_score: number;
    maintain_threshold: number;
    upgrade_threshold: number;
    position?: string;
    excluded_candidates?: number;
  }>;
  /** 参培人数筛选数据 */
  training_counts: {
    pending_review: Array<{
      recruiter_id: string;
      recruiter_name: string;
      latest_month_training: number;
      avg_monthly_training: number;
      maintain_threshold: number;
      upgrade_threshold: number;
      disputed_candidates?: number;
      pending_candidates?: number;
    }>;
    confirmed: Array<{
      recruiter_id: string;
      recruiter_name: string;
      latest_month_training: number;
      avg_monthly_training: number;
      maintain_threshold: number;
      upgrade_threshold: number;
    }>;
  };
  /** 未计入候选人列表 */
  excluded_candidates?: Array<{
    candidate_id: string;
    candidate_name: string;
    department: string;
    start_date: string;
    leave_reason: string;
  }>;
}

/** 操作日志行数据 */
export interface LogRow {
  log_id?: unknown;
  log_batch_id?: unknown;
  log_operation_type?: unknown;
  log_status?: unknown;
  log_created_at?: unknown;
  log_operator_name?: unknown;
  log_recruiter_count?: unknown;
  log_need_review_count?: unknown;
  log_score_rate?: unknown;
  log_training_rate?: unknown;
  batch_id?: unknown;
  operation_type?: unknown;
  task_type?: unknown;
  status?: unknown;
  run_status?: unknown;
  result_status?: unknown;
  created_at?: unknown;
  started_at?: unknown;
  ended_at?: unknown;
  operator_name?: unknown;
  operator?: unknown;
  recruiter_count?: unknown;
  assessed_count?: unknown;
  need_review_count?: unknown;
  review_count?: unknown;
  score_rate?: unknown;
  training_rate?: unknown;
  source_file_name?: unknown;
  summary_json?: unknown;
  error_message?: unknown;
  excel_file_url?: unknown;
  pdf_file_url?: unknown;
  result_file_ref?: unknown;
  log_result_file_ref?: unknown;
}

// ── 新工作流 FrontendPayload 类型 ──

export interface FrontendDashboard {
  recruiter_count?: number;
  need_review_count?: number;
  score_pass_rate?: number | string;
  training_pass_rate?: number | string;
  participant_count?: number;
  monthly_summary_count?: number;
  entry_detail_count?: number;
  training_detail_count?: number;
  warning_count?: number;
  score_pass_count?: number;
  score_pass_total?: number;
  training_pass_count?: number;
  training_pass_total?: number;
  promotion_distribution?: unknown;
  level_score_distribution?: unknown;
}

export interface FrontendTables {
  entry_score_rows?: Record<string, unknown>[];
  entry_excluded_rows?: Record<string, unknown>[];
  training_check_rows?: Record<string, unknown>[];
  training_confirm_rows?: Record<string, unknown>[];
  training_issue_rows?: Record<string, unknown>[];
  assessment_rows?: Record<string, unknown>[];
}

export interface FrontendPayload {
  ok?: boolean;
  batch_id?: string;
  calc_mode?: 'single' | 'multi' | string;
  months?: string[];
  status?: string;
  operator_name?: string;
  created_at?: string;
  dashboard?: FrontendDashboard;
  tables?: FrontendTables;
  download_files?: Record<string, unknown>;
  uploaded_file_count?: number;
  uploaded_file_summary?: Record<string, unknown>;
  warnings?: string[];
}

// ── Type Guards ──

/** 判断是否为升降级评分结果 */
export function isScoringResult(value: unknown): value is ScoringResult {
  return (
    !!value &&
    typeof value === 'object' &&
    Array.isArray((value as Record<string, unknown>).entry_scores) &&
    'training_counts' in value
  );
}

/** 判断是否为日志行数据 */
export function isLogRow(value: unknown): value is LogRow {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    'batch_id' in record ||
    'log_id' in record ||
    'log_batch_id' in record ||
    'operation_type' in record ||
    'log_operation_type' in record ||
    'status' in record ||
    'log_status' in record ||
    'task_type' in record ||
    'run_status' in record ||
    'created_at' in record ||
    'log_created_at' in record ||
    'started_at' in record
  );
}

/** 判断是否为 FrontendPayload（含 dashboard 或 tables 字段） */
export function isFrontendPayload(value: unknown): value is FrontendPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const hasDashboard =
    'dashboard' in record && record.dashboard != null && typeof record.dashboard === 'object';
  const hasTables =
    'tables' in record && record.tables != null && typeof record.tables === 'object';
  return hasDashboard || hasTables;
}
