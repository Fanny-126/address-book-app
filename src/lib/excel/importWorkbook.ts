import * as XLSX from 'xlsx-js-style';
import type { ContactMethodType } from '@/types/contact';
import { isValidEmail } from '@/lib/validation';
import {
  DETAILS_SHEET_NAME,
  MAIN_SHEET_NAME,
  isRecognizedFavoriteValue,
  parseFavoriteValue,
  parseMethodType,
} from './constants';
import type {
  ImportedMethod,
  ImportRowIssue,
  ParsedContactRow,
  ParsedWorkbook,
} from './types';

export class WorkbookImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkbookImportError';
  }
}

type HeaderKind =
  | 'name'
  | 'firstName'
  | 'lastName'
  | 'phone'
  | 'email'
  | 'address'
  | 'note'
  | 'favorite'
  | 'ignore';

interface ColumnMap {
  name: number[];
  firstName: number[];
  lastName: number[];
  phone: number[];
  email: number[];
  address: number[];
  note: number[];
  favorite: number[];
}

function emptyColumnMap(): ColumnMap {
  return {
    name: [],
    firstName: [],
    lastName: [],
    phone: [],
    email: [],
    address: [],
    note: [],
    favorite: [],
  };
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_\-—–/\\（）()【】[\]:：.]+/g, '');
}

/**
 * 中英文表头别名映射（B4）。
 * 同时兼容 Google Contacts 的「E-mail 1 - Value」「Phone 1 - Value」
 * 和 Outlook 的「First Name」「Last Name」「Mobile Phone」等列名。
 */
export function classifyHeader(value: unknown): HeaderKind {
  const h = normalizeHeader(value);
  if (h === '') return 'ignore';
  if (
    (h.includes('label') || h.includes('标签') || h.includes('类型')) &&
    !h.includes('value') &&
    !h.includes('内容') &&
    !h.includes('formatted')
  ) {
    return 'ignore';
  }
  if (/^(first|given)name$|^firstname|^givenname|^first$|^given$|^名$/.test(h)) return 'firstName';
  if (/^(last|family|surname)name$|^lastname|^familyname|^surname$|^last$|^family$|^姓$/.test(h)) {
    return 'lastName';
  }
  if (/电话|手机|联系电话|电话号码|phone|mobile|telephone|tel$|^tel/.test(h)) return 'phone';
  if (/邮箱|邮件|e?mail/.test(h)) return 'email';
  if (/地址|住址|通讯地址|address|street/.test(h)) return 'address';
  if (/备注|说明|附注|note|remark|memo|description/.test(h)) return 'note';
  if (/收藏|favorite|favourite|starred/.test(h)) return 'favorite';
  if (
    h === '姓名' ||
    h === '名字' ||
    h === '联系人' ||
    h === '联系人姓名' ||
    h === '名称' ||
    h === 'name' ||
    h === 'fullname' ||
    h === 'displayname' ||
    h === 'contactname' ||
    (h.endsWith('name') && !/(user|file|sheet|company|nick|account)/.test(h))
  ) {
    return 'name';
  }
  return 'ignore';
}

function buildColumnMap(headerRow: unknown[]): ColumnMap {
  const map = emptyColumnMap();
  headerRow.forEach((value, index) => {
    const kind = classifyHeader(value);
    if (kind !== 'ignore') map[kind].push(index);
  });
  return map;
}

function hasNameColumn(map: ColumnMap): boolean {
  return map.name.length > 0 || map.firstName.length > 0 || map.lastName.length > 0;
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function splitMultiValue(value: string, allowAsciiSemicolon: boolean): string[] {
  const pattern = allowAsciiSemicolon ? /\r?\n|;|；/ : /\r?\n|；/;
  return value
    .split(pattern)
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

function readSheetRows(sheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: '',
    blankrows: true,
  }) as unknown[][];
}

function findHeaderRow(rows: unknown[][]): { index: number; map: ColumnMap } | null {
  const limit = Math.min(rows.length, 20);
  for (let i = 0; i < limit; i += 1) {
    const map = buildColumnMap(rows[i]);
    if (hasNameColumn(map)) return { index: i, map };
  }
  return null;
}

function findMainSheet(workbook: XLSX.WorkBook): { name: string; rows: unknown[][] } | null {
  const named = workbook.SheetNames.find(
    (name) => name.trim().toLowerCase() === MAIN_SHEET_NAME.toLowerCase(),
  );
  const candidates = named ? [named, ...workbook.SheetNames.filter((n) => n !== named)] : workbook.SheetNames;
  for (const name of candidates) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    const rows = readSheetRows(sheet);
    if (findHeaderRow(rows)) return { name, rows };
  }
  return null;
}

interface DetailsParse {
  byRow: Map<number, ImportedMethod[]>;
  errors: ImportRowIssue[];
  warnings: ImportRowIssue[];
}

function findDetailsSheet(workbook: XLSX.WorkBook): { name: string; rows: unknown[][] } | null {
  const named = workbook.SheetNames.find(
    (name) => name.trim().toLowerCase() === DETAILS_SHEET_NAME.toLowerCase(),
  );
  const candidates = named ? [named] : workbook.SheetNames;
  for (const name of candidates) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    const rows = readSheetRows(sheet);
    if (rows.length === 0) continue;
    const header = rows[0].map((v) => normalizeHeader(v));
    const hasRowNumber = header.some((h) => h === '主表行号' || h === '行号' || h === 'rownumber');
    const hasType = header.some((h) => h === '类型' || h === 'type');
    if (hasRowNumber && hasType) return { name, rows };
  }
  return null;
}

function parseDetails(rows: unknown[][]): DetailsParse {
  const result: DetailsParse = { byRow: new Map(), errors: [], warnings: [] };
  const header = rows[0].map((v) => normalizeHeader(v));
  const find = (...names: string[]) => header.findIndex((h) => names.includes(h));

  const rowNoCol = find('主表行号', '行号', 'rownumber');
  const typeCol = find('类型', 'type');
  const valueCol = find('值', '内容', 'value');
  const idCol = find('联系人id', '联系人编号', 'contactid');
  const nameCol = find('姓名', '名字', 'name');
  const labelCol = find('标签', 'label');
  const orderCol = find('顺序', '序号', 'order');

  if (rowNoCol < 0 || typeCol < 0 || valueCol < 0) {
    result.warnings.push({
      rowNumber: 1,
      message: 'ContactDetails 明细表缺少「主表行号 / 类型 / 值」列，已忽略明细并按主表六列解析。',
    });
    return result;
  }

  rows.slice(1).forEach((row, index) => {
    const detailRowNumber = index + 2;
    const isEmpty = row.every((cell) => cellText(cell).trim() === '');
    if (isEmpty) return;

    const mainRowNumber = Number(cellText(row[rowNoCol]).trim());
    if (!Number.isInteger(mainRowNumber) || mainRowNumber < 2) {
      result.errors.push({
        rowNumber: detailRowNumber,
        message: `明细第 ${detailRowNumber} 行的「主表行号」无效，无法关联联系人。`,
      });
      return;
    }
    const type = parseMethodType(cellText(row[typeCol]));
    if (!type) {
      result.errors.push({
        rowNumber: detailRowNumber,
        message: `明细第 ${detailRowNumber} 行的联系方式类型「${cellText(row[typeCol])}」无法识别。`,
      });
      return;
    }
    const value = cellText(row[valueCol]);
    if (value.trim() === '') {
      result.errors.push({
        rowNumber: detailRowNumber,
        message: `明细第 ${detailRowNumber} 行的联系方式内容为空。`,
      });
      return;
    }
    const label = labelCol >= 0 ? cellText(row[labelCol]).trim() : '';
    if (type === 'custom' && label === '') {
      result.errors.push({
        rowNumber: detailRowNumber,
        message: `明细第 ${detailRowNumber} 行的自定义联系方式缺少标签。`,
      });
      return;
    }
    if (type === 'email' && !isValidEmail(value)) {
      result.errors.push({
        rowNumber: detailRowNumber,
        message: `明细第 ${detailRowNumber} 行的邮箱「${value}」格式不正确。`,
      });
      return;
    }
    const orderRaw = orderCol >= 0 ? Number(cellText(row[orderCol]).trim()) : NaN;
    const order = Number.isFinite(orderRaw) ? orderRaw : index;

    const list = result.byRow.get(mainRowNumber) ?? [];
    list.push({
      type,
      label: label || (type === 'custom' ? '' : defaultLabel(type)),
      value,
      order,
    });
    result.byRow.set(mainRowNumber, list);

    // id/name 列存在时做弱校验，帮助发现错位行
    if (idCol >= 0 && nameCol >= 0) {
      const id = cellText(row[idCol]).trim();
      if (id === '') {
        result.warnings.push({
          rowNumber: detailRowNumber,
          message: `明细第 ${detailRowNumber} 行缺少联系人 ID，已按主表行号关联。`,
        });
      }
    }
  });

  return result;
}

function defaultLabel(type: ContactMethodType): string {
  switch (type) {
    case 'phone':
      return '手机';
    case 'email':
      return '邮箱';
    case 'social':
      return '社交账号';
    case 'address':
      return '地址';
    case 'custom':
      return '';
  }
}

function pickName(row: unknown[], map: ColumnMap): string {
  for (const index of map.name) {
    const value = cellText(row[index]).trim();
    if (value !== '') return value;
  }
  const first = map.firstName.map((i) => cellText(row[i]).trim()).find((v) => v !== '') ?? '';
  const last = map.lastName.map((i) => cellText(row[i]).trim()).find((v) => v !== '') ?? '';
  // 中文姓名直接拼接，西文姓名用空格分隔
  const separator = /[\u4e00-\u9fff]/.test(`${first}${last}`) ? '' : ' ';
  return `${first}${separator}${last}`.trim();
}

function buildMainMethods(
  row: unknown[],
  map: ColumnMap,
  errors: ImportRowIssue[],
  rowNumber: number,
): ImportedMethod[] {
  const methods: ImportedMethod[] = [];
  let order = 0;

  map.phone.forEach((index) => {
    splitMultiValue(cellText(row[index]), true).forEach((value) => {
      methods.push({ type: 'phone', label: '手机', value, order: order++ });
    });
  });

  map.email.forEach((index) => {
    splitMultiValue(cellText(row[index]), true).forEach((value) => {
      if (!isValidEmail(value)) {
        errors.push({
          rowNumber,
          message: `第 ${rowNumber} 行的邮箱「${value}」格式不正确，整行未导入。`,
        });
        return;
      }
      methods.push({ type: 'email', label: '邮箱', value, order: order++ });
    });
  });

  map.address.forEach((index) => {
    splitMultiValue(cellText(row[index]), false).forEach((value) => {
      methods.push({ type: 'address', label: '地址', value, order: order++ });
    });
  });

  return methods;
}

/**
 * 解析工作簿为待导入联系人。
 * - 有 ContactDetails 时按主表行号恢复全部联系方式，避免与主表多值单元格重复；
 * - 只有 Contacts 主表时按六列解析；
 * - 空行跳过，姓名缺失 / 邮箱非法 / 明细错误生成带真实行号的错误。
 */
export function parseContactWorkbook(workbook: XLSX.WorkBook): ParsedWorkbook {
  if (!workbook.SheetNames.length) {
    throw new WorkbookImportError('文件中没有工作表，无法导入。');
  }
  const main = findMainSheet(workbook);
  if (!main) {
    throw new WorkbookImportError(
      '未找到联系人表头。请确认表格包含「姓名 / Name / First Name + Last Name」列。',
    );
  }
  const headerInfo = findHeaderRow(main.rows);
  if (!headerInfo) {
    throw new WorkbookImportError('未找到联系人表头行，请检查文件格式。');
  }

  const detailsSheet = findDetailsSheet(workbook);
  const details = detailsSheet ? parseDetails(detailsSheet.rows) : null;
  const errors: ImportRowIssue[] = details ? [...details.errors] : [];
  const warnings: ImportRowIssue[] = details ? [...details.warnings] : [];
  const rows: ParsedContactRow[] = [];
  const usedMainRows = new Set<number>();

  for (let index = headerInfo.index + 1; index < main.rows.length; index += 1) {
    const row = main.rows[index];
    const rowNumber = index + 1; // 真实 Excel 行号
    if (row.every((cell) => cellText(cell).trim() === '')) continue;

    const name = pickName(row, headerInfo.map);
    const rowErrors: ImportRowIssue[] = [];
    if (name === '') {
      rowErrors.push({ rowNumber, message: `第 ${rowNumber} 行缺少姓名，整行未导入。` });
    }

    const favoriteIndex = headerInfo.map.favorite[0];
    const favoriteRaw = favoriteIndex === undefined ? '' : cellText(row[favoriteIndex]).trim();
    if (favoriteIndex !== undefined && !isRecognizedFavoriteValue(row[favoriteIndex])) {
      warnings.push({
        rowNumber,
        message: `第 ${rowNumber} 行的收藏值「${favoriteRaw}」无法识别，已按「否」处理。`,
      });
    }
    const isFavorite = parseFavoriteValue(row[favoriteIndex] ?? '');

    const note = headerInfo.map.note
      .map((i) => cellText(row[i]).trim())
      .filter((v) => v !== '')
      .join('\n');

    let methods: ImportedMethod[] = [];
    let fromDetails = false;
    const detailMethods = details?.byRow.get(rowNumber);
    if (detailMethods && detailMethods.length > 0) {
      methods = [...detailMethods].sort((a, b) => a.order - b.order);
      fromDetails = true;
      usedMainRows.add(rowNumber);
      detailMethods.forEach((m) => {
        if (m.type === 'email' && !isValidEmail(m.value)) {
          rowErrors.push({
            rowNumber,
            message: `第 ${rowNumber} 行的邮箱「${m.value}」格式不正确，整行未导入。`,
          });
        }
      });
    } else {
      methods = buildMainMethods(row, headerInfo.map, rowErrors, rowNumber);
      if (details && methods.length > 0) {
        warnings.push({
          rowNumber,
          message: `第 ${rowNumber} 行在 ContactDetails 中缺少明细，已回退按主表六列恢复联系方式。`,
        });
      }
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      continue;
    }

    rows.push({
      rowNumber,
      name,
      isFavorite,
      note,
      methods,
      fromDetails,
    });
  }

  if (details) {
    details.byRow.forEach((_methods, mainRowNumber) => {
      if (!usedMainRows.has(mainRowNumber)) {
        warnings.push({
          rowNumber: mainRowNumber,
          message: `ContactDetails 引用了主表第 ${mainRowNumber} 行，但该行不存在或没有有效联系人。`,
        });
      }
    });
  }

  return {
    rows,
    errors,
    warnings,
    hasDetails: !!details,
    sheetName: main.name,
  };
}

/** 从文件字节解析（浏览器 File 与 Node 测试共用） */
export function parseWorkbookBuffer(buffer: ArrayBuffer, fileName: string): ParsedWorkbook {
  let workbook: XLSX.WorkBook;
  try {
    if (/\.csv$/i.test(fileName)) {
      const text = new TextDecoder('utf-8').decode(buffer).replace(/^\uFEFF/, '');
      // raw: true 保留 CSV 中的 +86、前导零等号码文本，避免被解析成数字
      workbook = XLSX.read(text, { type: 'string', raw: true });
    } else {
      workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
    }
  } catch {
    throw new WorkbookImportError('文件无法解析，请确认它是有效的 .xlsx / .xls / UTF-8 CSV 文件。');
  }
  return parseContactWorkbook(workbook);
}

export const SUPPORTED_EXTENSIONS = ['.xlsx', '.xls', '.csv'] as const;

export function isSupportedFileName(fileName: string): boolean {
  return SUPPORTED_EXTENSIONS.some((ext) => fileName.toLowerCase().endsWith(ext));
}
