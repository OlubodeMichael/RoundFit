/** MVP export payload — mirrors POST /auth/export `data` shape. */
export interface UserDataExport {
  export_version: string;
  generated_at: string;
  app: string;
  user: {
    id: string;
    email: string;
    profile: Record<string, unknown>;
  };
  food_logs: Record<string, unknown>[];
  workouts: Record<string, unknown>[];
  health_data: Record<string, unknown>[];
  recovery_logs: Record<string, unknown>[];
  readiness_scores: Record<string, unknown>[];
  daily_summaries: Record<string, unknown>[];
  weight_entries: Record<string, unknown>[];
  check_ins: Record<string, unknown>[];
  insights: Record<string, unknown>[];
  cycle: {
    default_cycle_length?: number;
    history: Record<string, unknown>[];
  };
  engine: {
    patterns: Record<string, unknown>[];
  };
  metadata: {
    date_range: { earliest: string | null; latest: string | null };
    row_counts: Record<string, number>;
  };
}

export type DataExportErrorCode =
  | 'network'
  | 'rate_limited'
  | 'account_deleting'
  | 'unauthorized'
  | 'server'
  | 'invalid_response';

export class DataExportError extends Error {
  constructor(
    readonly code: DataExportErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DataExportError';
  }
}
