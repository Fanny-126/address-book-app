import type { ContactMethodType } from '@/types/contact';

/** 导入解析后的单条联系方式（order 保留原顺序） */
export interface ImportedMethod {
  type: ContactMethodType;
  label: string;
  value: string;
  order: number;
}

/** 导入解析后的一位联系人 */
export interface ParsedContactRow {
  /** 真实 Excel 行号（表头行不计入联系人数据） */
  rowNumber: number;
  name: string;
  isFavorite: boolean;
  note: string;
  methods: ImportedMethod[];
  /** 是否使用 ContactDetails 明细恢复（用于 UI 提示） */
  fromDetails: boolean;
}

export interface ImportRowIssue {
  rowNumber: number;
  message: string;
}

export interface ParsedWorkbook {
  rows: ParsedContactRow[];
  errors: ImportRowIssue[];
  warnings: ImportRowIssue[];
  hasDetails: boolean;
  sheetName: string;
}

/** 预览阶段每条记录的去重结论 */
export type DuplicateKind = 'new' | 'strong' | 'suspected';

export interface DedupeEntry {
  row: ParsedContactRow;
  kind: DuplicateKind;
  /** 人类可读的重复原因，new 时为 undefined */
  reason?: string;
}

export interface DedupeSummary {
  entries: DedupeEntry[];
  newCount: number;
  strongCount: number;
  suspectedCount: number;
  errorCount: number;
}

/** 导入完成后给用户的真实结果 */
export interface ImportResult {
  added: number;
  skipped: number;
  failed: number;
  failedRows: ImportRowIssue[];
}
