import type { ContactRepository } from '@/types/contact';
import { dedupeRows, selectRowsForImport, toContactInputs } from './dedupe';
import {
  WorkbookImportError,
  isSupportedFileName,
  parseWorkbookBuffer,
} from './importWorkbook';
import type { DedupeSummary, ImportResult, ParsedWorkbook } from './types';

export const MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024;

export interface ImportPreview {
  fileName: string;
  parsed: ParsedWorkbook;
  summary: DedupeSummary;
}

export interface CommitOptions {
  skipSuspected: boolean;
}

function validateFile(file: File): void {
  if (!isSupportedFileName(file.name)) {
    throw new WorkbookImportError('仅支持 .xlsx、.xls 和 UTF-8 CSV 文件。');
  }
  if (file.size > MAX_IMPORT_FILE_SIZE) {
    throw new WorkbookImportError('文件超过 10 MB，请拆分后再导入。');
  }
  if (file.size === 0) {
    throw new WorkbookImportError('文件为空，请选择有效的通讯录文件。');
  }
}

/** 只解析和校验，不写入任何数据；用户确认后才调用 bulkCreate */
export async function previewImportFile(
  file: File,
  repository: ContactRepository,
): Promise<ImportPreview> {
  validateFile(file);
  const buffer = await file.arrayBuffer();
  const parsed = parseWorkbookBuffer(buffer, file.name);
  const existing = await repository.list();
  const summary = dedupeRows(parsed.rows, existing);
  summary.errorCount = parsed.errors.length;
  return { fileName: file.name, parsed, summary };
}

/** 用户确认后批量写入；数量与数据库实际变化保持一致 */
export async function commitImport(
  preview: ImportPreview,
  options: CommitOptions,
  repository: ContactRepository,
): Promise<ImportResult> {
  const rows = selectRowsForImport(preview.summary, options.skipSuspected);
  const inputs = toContactInputs(rows);
  const skipped =
    preview.summary.strongCount + (options.skipSuspected ? preview.summary.suspectedCount : 0);

  if (inputs.length === 0) {
    return {
      added: 0,
      skipped,
      failed: preview.parsed.errors.length,
      failedRows: preview.parsed.errors,
    };
  }

  try {
    const created = await repository.bulkCreate(inputs);
    return {
      added: created.length,
      skipped,
      failed: preview.parsed.errors.length,
      failedRows: preview.parsed.errors,
    };
  } catch (error) {
    return {
      added: 0,
      skipped,
      failed: inputs.length + preview.parsed.errors.length,
      failedRows: [
        ...preview.parsed.errors,
        {
          rowNumber: 0,
          message: error instanceof Error ? error.message : '批量写入失败，事务已回滚。',
        },
      ],
    };
  }
}
