export interface BulkTaskRow {
  row: number;
  title: string;
  description?: string;
  status?: string;
}

export interface BulkTaskError {
  row: number;
  errors: string[];
  data: Record<string, any>;
}

export interface BulkUploadResult {
  fileUrl: string;
  totalRows: number;
  successCount: number;
  failureCount: number;
  createdTasks: Array<{ row: number; taskId: string; title: string }>;
  errors: BulkTaskError[];
}
