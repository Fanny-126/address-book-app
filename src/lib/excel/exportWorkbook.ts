import * as XLSX from 'xlsx-js-style';
import type { Contact, ContactMethod } from '@/types/contact';
import {
  DETAILS_HEADERS,
  DETAILS_SHEET_NAME,
  MAIN_HEADERS,
  MAIN_SHEET_NAME,
  METHOD_TYPE_LABEL,
} from './constants';

const HEADER_STYLE = {
  font: { bold: true, color: { rgb: 'FFFFFF' } },
  fill: { patternType: 'solid', fgColor: { rgb: 'B85C38' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: {
    top: { style: 'thin', color: { rgb: '8A7D6B' } },
    bottom: { style: 'thin', color: { rgb: '8A7D6B' } },
    left: { style: 'thin', color: { rgb: '8A7D6B' } },
    right: { style: 'thin', color: { rgb: '8A7D6B' } },
  },
};

const BODY_STYLE = {
  alignment: { vertical: 'top', wrapText: true },
  border: {
    top: { style: 'thin', color: { rgb: 'DDD2C2' } },
    bottom: { style: 'thin', color: { rgb: 'DDD2C2' } },
    left: { style: 'thin', color: { rgb: 'DDD2C2' } },
    right: { style: 'thin', color: { rgb: 'DDD2C2' } },
  },
};

function sortedMethods(contact: Contact): ContactMethod[] {
  return [...contact.methods].sort((a, b) => a.order - b.order);
}

function valuesOf(contact: Contact, type: ContactMethod['type']): string {
  return sortedMethods(contact)
    .filter((m) => m.type === type)
    .map((m) => m.value)
    .join('\n');
}

/** 所有用户文本都以字符串单元格写入，Excel 不会把它当作公式执行 */
function textCell(value: string, style: object): XLSX.CellObject {
  return { t: 's', v: value, s: style };
}

export function buildContactsWorkbook(contacts: Contact[]): XLSX.WorkBook {
  const mainRows: string[][] = [Array.from(MAIN_HEADERS)];
  contacts.forEach((c) => {
    mainRows.push([
      c.name,
      valuesOf(c, 'phone'),
      valuesOf(c, 'email'),
      valuesOf(c, 'address'),
      c.note,
      c.isFavorite ? '是' : '否',
    ]);
  });

  const mainSheet = XLSX.utils.aoa_to_sheet(mainRows);
  const headerRow = 0;
  const colCount = MAIN_HEADERS.length;

  for (let col = 0; col < colCount; col += 1) {
    const addr = XLSX.utils.encode_cell({ r: headerRow, c: col });
    mainSheet[addr] = textCell(String(MAIN_HEADERS[col]), HEADER_STYLE);
  }

  contacts.forEach((_contact, rowIndex) => {
    const r = rowIndex + 1;
    const row = mainRows[r];
    row.forEach((value, c) => {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = textCell(value, BODY_STYLE);
      // 电话列显式使用文本格式，保留前导零、+、分机等原始字符
      if (c === 1) cell.z = '@';
      mainSheet[addr] = cell;
    });
  });

  mainSheet['!cols'] = [
    { wch: 18 },
    { wch: 24 },
    { wch: 28 },
    { wch: 32 },
    { wch: 30 },
    { wch: 10 },
  ];
  mainSheet['!rows'] = [{ hpt: 26 }];
  mainSheet['!autofilter'] = { ref: `A1:F${Math.max(1, mainRows.length)}` };

  const detailsRows: Array<Array<string | number>> = [Array.from(DETAILS_HEADERS)];
  contacts.forEach((contact, contactIndex) => {
    sortedMethods(contact).forEach((method) => {
      detailsRows.push([
        contactIndex + 2, // 主表数据从第 2 行开始
        contact.id,
        contact.name,
        METHOD_TYPE_LABEL[method.type],
        method.label,
        method.value,
        method.order,
      ]);
    });
  });

  const detailsSheet = XLSX.utils.aoa_to_sheet(detailsRows);
  for (let c = 0; c < DETAILS_HEADERS.length; c += 1) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    detailsSheet[addr] = textCell(String(DETAILS_HEADERS[c]), HEADER_STYLE);
  }
  for (let r = 1; r < detailsRows.length; r += 1) {
    for (let c = 0; c < DETAILS_HEADERS.length; c += 1) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const raw = detailsRows[r][c];
      detailsSheet[addr] = {
        t: typeof raw === 'number' ? 'n' : 's',
        v: raw,
        s: BODY_STYLE,
      };
    }
  }
  detailsSheet['!cols'] = [
    { wch: 10 },
    { wch: 38 },
    { wch: 18 },
    { wch: 10 },
    { wch: 14 },
    { wch: 32 },
    { wch: 8 },
  ];
  detailsSheet['!rows'] = [{ hpt: 26 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, mainSheet, MAIN_SHEET_NAME);
  XLSX.utils.book_append_sheet(workbook, detailsSheet, DETAILS_SHEET_NAME);
  return workbook;
}

export function workbookToXlsxArray(workbook: XLSX.WorkBook): ArrayBuffer {
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array', compression: true }) as ArrayBuffer;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** 文件名包含本地日期时间，避免多次下载难以区分 */
export function exportFileName(date = new Date()): string {
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `contacts_${stamp}.xlsx`;
}

export interface ExportFile {
  fileName: string;
  buffer: ArrayBuffer;
  rowCount: number;
}

/** 纯函数导出：供 UI 下载和自动化测试共同使用 */
export function createExportFile(contacts: Contact[], date = new Date()): ExportFile {
  const workbook = buildContactsWorkbook(contacts);
  return {
    fileName: exportFileName(date),
    buffer: workbookToXlsxArray(workbook),
    rowCount: contacts.length,
  };
}

/** 浏览器下载（不依赖本机 Excel 软件） */
export function downloadExportFile(file: ExportFile): void {
  const blob = new Blob([file.buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
