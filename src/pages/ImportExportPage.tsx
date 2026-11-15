import { useRef, useState } from 'react';
import { useAddressBook } from '@/hooks/useAddressBook';
import { PageHeader, Modal, StatusBadge, EmptyState } from '@/components/ui';
import { useToast } from '@/components/toastContext';
import { createExportFile, downloadExportFile } from '@/lib/excel/exportWorkbook';
import {
  commitImport,
  MAX_IMPORT_FILE_SIZE,
  previewImportFile,
  type ImportPreview,
} from '@/lib/excel/importContacts';
import type { DedupeEntry, ImportResult, ParsedContactRow } from '@/lib/excel/types';

const KIND_TEXT: Record<DedupeEntry['kind'], string> = {
  new: '新增',
  strong: '重复',
  suspected: '疑似重复',
};

const KIND_TONE: Record<DedupeEntry['kind'], 'success' | 'danger' | 'warning'> = {
  new: 'success',
  strong: 'danger',
  suspected: 'warning',
};

function methodSummary(row: ParsedContactRow): string {
  const phones = row.methods.filter((m) => m.type === 'phone').map((m) => m.value);
  const emails = row.methods.filter((m) => m.type === 'email').map((m) => m.value);
  const parts: string[] = [];
  if (phones.length > 0) parts.push(`电话：${phones.join(' / ')}`);
  if (emails.length > 0) parts.push(`邮箱：${emails.join(' / ')}`);
  if (parts.length === 0) return '无电话/邮箱';
  return parts.join(' · ');
}

/** Excel 导入导出页（B2–B5）：导出标准工作簿，导入前预览、去重并确认 */
export function ImportExportPage() {
  const { contacts, loading, repository } = useAddressBook();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [skipSuspected, setSkipSuspected] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleExport = () => {
    const file = createExportFile(contacts);
    downloadExportFile(file);
    toast.show(
      contacts.length === 0
        ? '已导出仅含表头的空通讯录'
        : `已导出 ${contacts.length} 位联系人`,
    );
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setParsing(true);
    setParseError(null);
    setResult(null);
    setPreview(null);
    try {
      const next = await previewImportFile(file, repository);
      setPreview(next);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : '文件解析失败，请检查文件格式。');
    } finally {
      setParsing(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const importableCount = preview
    ? preview.summary.newCount + (skipSuspected ? 0 : preview.summary.suspectedCount)
    : 0;

  const handleConfirmImport = async () => {
    if (!preview || importing) return;
    setImporting(true);
    try {
      const next = await commitImport(preview, { skipSuspected }, repository);
      setResult(next);
      setPreview(null);
      setSkipSuspected(false);
      if (next.added > 0) {
        toast.show(`导入完成：新增 ${next.added} 位联系人`);
      } else {
        toast.show('没有新增联系人，请查看导入结果', 'error');
      }
    } finally {
      setImporting(false);
    }
  };

  const closePreview = () => {
    if (!importing) setPreview(null);
  };

  return (
    <div className="page">
      <PageHeader
        title="导入与导出"
        subtitle="Excel 数据只在本机浏览器中解析和保存，不会上传到服务器。"
      />

      <section className="card panel" aria-labelledby="export-title">
        <div className="panel-head">
          <div>
            <h2 id="export-title" className="section-title">
              导出联系人
            </h2>
            <p className="muted">
              主表固定为「姓名、电话、邮箱、地址、备注、是否收藏」六列；每位联系人只占一行，
              多条电话/邮箱/地址在单元格内换行。全部联系方式另存于 ContactDetails 明细表，
              便于无损回导。
            </p>
          </div>
          <button type="button" className="btn btn-primary" onClick={handleExport} disabled={loading}>
            导出 Excel（{loading ? '…' : contacts.length}）
          </button>
        </div>
        <ul className="hint-list">
          <li>电话列使用文本格式，`+8613800000000`、`001234` 等原样保留。</li>
          <li>收藏状态导出为「是 / 否」，空通讯录也可以导出仅含表头的文件。</li>
          <li>文件名包含日期时间，例如 contacts_20261115_203000.xlsx。</li>
        </ul>
      </section>

      <section className="card panel" aria-labelledby="import-title">
        <div className="panel-head">
          <div>
            <h2 id="import-title" className="section-title">
              导入联系人
            </h2>
            <p className="muted">
              支持 .xlsx、.xls 和 UTF-8 CSV；兼容中英文表头、First Name + Last Name、
              Google/Outlook 多电话多邮箱列。导入前会先预览，不会直接写入。
            </p>
          </div>
          <label className={`btn btn-ghost file-btn${parsing ? ' disabled' : ''}`}>
            {parsing ? '解析中…' : '选择文件'}
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              aria-label="选择要导入的通讯录文件"
              disabled={parsing}
              onChange={(event) => void handleFile(event.target.files?.[0])}
            />
          </label>
        </div>

        <ul className="hint-list">
          <li>重复判定：规范化电话或邮箱相同即为强重复，默认跳过；只有姓名相同标记为疑似重复。</li>
          <li>姓名缺失、邮箱非法、明细格式错误会显示具体 Excel 行号，整行不导入。</li>
          <li>单个文件不超过 {Math.round(MAX_IMPORT_FILE_SIZE / 1024 / 1024)} MB。</li>
        </ul>

        {parseError ? (
          <div className="error-box" role="alert">
            <p>{parseError}</p>
          </div>
        ) : null}

        {result ? (
          <div className="import-result" role="status">
            <h3>导入结果</h3>
            <div className="result-stats">
              <span className="stat success">新增 {result.added}</span>
              <span className="stat">跳过 {result.skipped}</span>
              <span className="stat danger">失败 {result.failed}</span>
            </div>
            {result.added === 0 && result.skipped > 0 ? (
              <p className="muted">文件中的联系人都已存在，或已被重复规则跳过。</p>
            ) : null}
            {result.failedRows.length > 0 ? (
              <ul className="issue-list">
                {result.failedRows.map((issue, index) => (
                  <li key={`${issue.rowNumber}-${index}`}>
                    {issue.rowNumber > 0 ? `第 ${issue.rowNumber} 行：` : ''}
                    {issue.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>

      <Modal
        open={!!preview}
        title="导入预览"
        wide
        onClose={closePreview}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={closePreview} disabled={importing}>
              取消
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleConfirmImport()}
              disabled={importing || !preview || importableCount === 0}
            >
              {importing ? '导入中…' : `确认导入 ${importableCount} 位联系人`}
            </button>
          </>
        }
      >
        {preview ? (
          <div className="preview">
            <p className="muted">
              文件：{preview.fileName} · 工作表：{preview.parsed.sheetName}
              {preview.parsed.hasDetails ? ' · 已识别 ContactDetails 明细表' : ' · 按主表六列解析'}
            </p>

            <div className="result-stats">
              <span className="stat success">新增 {preview.summary.newCount}</span>
              <span className="stat danger">强重复 {preview.summary.strongCount}</span>
              <span className="stat warning">疑似重复 {preview.summary.suspectedCount}</span>
              <span className="stat danger">错误 {preview.summary.errorCount}</span>
            </div>

            <label className="check-line">
              <input
                type="checkbox"
                checked={skipSuspected}
                onChange={(event) => setSkipSuspected(event.target.checked)}
              />
              跳过同名疑似重复（默认保留，不会仅按姓名删除）
            </label>

            {preview.summary.errorCount > 0 ? (
              <div className="error-box" role="alert">
                <p>以下行存在错误，整行不会导入：</p>
                <ul className="issue-list">
                  {preview.parsed.errors.map((issue, index) => (
                    <li key={`${issue.rowNumber}-${index}`}>{issue.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {preview.parsed.warnings.length > 0 ? (
              <details className="warning-details">
                <summary>查看 {preview.parsed.warnings.length} 条提示</summary>
                <ul className="issue-list">
                  {preview.parsed.warnings.map((issue, index) => (
                    <li key={`${issue.rowNumber}-${index}`}>{issue.message}</li>
                  ))}
                </ul>
              </details>
            ) : null}

            {preview.summary.entries.length === 0 ? (
              <EmptyState title="没有可导入的数据行" hint="请检查文件是否有表头和数据行。" />
            ) : (
              <div className="table-scroll">
                <table className="preview-table">
                  <thead>
                    <tr>
                      <th scope="col">行号</th>
                      <th scope="col">姓名</th>
                      <th scope="col">联系方式</th>
                      <th scope="col">状态</th>
                      <th scope="col">说明</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.summary.entries.map((entry) => (
                      <tr key={entry.row.rowNumber}>
                        <td>{entry.row.rowNumber}</td>
                        <td className="preview-name">{entry.row.name || '（空）'}</td>
                        <td className="preview-methods">{methodSummary(entry.row)}</td>
                        <td>
                          <StatusBadge tone={KIND_TONE[entry.kind]}>{KIND_TEXT[entry.kind]}</StatusBadge>
                        </td>
                        <td>{entry.reason ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
