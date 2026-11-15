import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx-js-style';
import type { Contact, ContactMethod } from '@/types/contact';
import { buildContactsWorkbook, workbookToXlsxArray } from '@/lib/excel/exportWorkbook';
import {
  WorkbookImportError,
  classifyHeader,
  parseWorkbookBuffer,
} from '@/lib/excel/importWorkbook';

function method(
  type: ContactMethod['type'],
  label: string,
  value: string,
  order: number,
): ContactMethod {
  return { id: `m-${order}`, type, label, value, order };
}

const richContact: Contact = {
  id: 'c1',
  name: '林晚晴',
  isFavorite: true,
  groupIds: [],
  note: '大学同学',
  methods: [
    method('phone', '手机', '+8613800000000', 0),
    method('phone', '公司', '010-12345678', 1),
    method('email', '个人', 'lin@example.com', 2),
    method('social', '微信', 'lin_wechat', 3),
    method('address', '家庭', '北京市朝阳区示例路 1 号', 4),
    method('custom', '备用号', '001234', 5),
  ],
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};

function workbookFromRows(rows: unknown[][], sheetName = 'Contacts'): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), sheetName);
  return workbook;
}

describe('B3/B4 Excel 导入与表头兼容', () => {
  it('导出文件完整回导，明细优先且联系方式不翻倍', () => {
    const buffer = workbookToXlsxArray(buildContactsWorkbook([richContact]));
    const parsed = parseWorkbookBuffer(buffer, 'contacts.xlsx');
    expect(parsed.hasDetails).toBe(true);
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.rows).toHaveLength(1);
    const row = parsed.rows[0];
    expect(row.name).toBe('林晚晴');
    expect(row.isFavorite).toBe(true);
    expect(row.note).toBe('大学同学');
    expect(row.methods.map((m) => [m.type, m.label, m.value, m.order])).toEqual([
      ['phone', '手机', '+8613800000000', 0],
      ['phone', '公司', '010-12345678', 1],
      ['email', '个人', 'lin@example.com', 2],
      ['social', '微信', 'lin_wechat', 3],
      ['address', '家庭', '北京市朝阳区示例路 1 号', 4],
      ['custom', '备用号', '001234', 5],
    ]);
  });

  it('只有 Contacts 主表的六列表格也能导入', () => {
    const workbook = workbookFromRows([
      ['姓名', '电话', '邮箱', '地址', '备注', '是否收藏'],
      ['陈默', '13800000000', 'chen@example.com', '广州市天河区', '同事', '否'],
    ]);
    const parsed = parseWorkbookBuffer(workbookToXlsxArray(workbook), 'simple.xlsx');
    expect(parsed.hasDetails).toBe(false);
    expect(parsed.rows[0].methods.map((m) => m.type)).toEqual(['phone', 'email', 'address']);
    expect(parsed.rows[0].isFavorite).toBe(false);
  });

  it('支持中英文别名、First + Last Name、多电话多邮箱列', () => {
    const workbook = workbookFromRows([
      [
        'First Name',
        'Last Name',
        'Phone 1 - Value',
        'Mobile Phone',
        'E-mail 1 - Value',
        'E-mail 2 - Value',
        'Address',
        'Notes',
        'Favorite',
      ],
      ['Alice', 'Wang', '+1 555 0100', '555-0101', 'alice@example.com', 'alice@work.com', '1 Main St', 'VIP', 'TRUE'],
    ]);
    const parsed = parseWorkbookBuffer(workbookToXlsxArray(workbook), 'google.xlsx');
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].name).toBe('Alice Wang');
    expect(parsed.rows[0].methods.filter((m) => m.type === 'phone')).toHaveLength(2);
    expect(parsed.rows[0].methods.filter((m) => m.type === 'email')).toHaveLength(2);
    expect(parsed.rows[0].isFavorite).toBe(true);
    expect(parsed.rows[0].note).toBe('VIP');
  });

  it('收藏值兼容 是/否、TRUE/FALSE、1/0、Y/N', () => {
    const values = ['是', '否', 'TRUE', 'FALSE', '1', '0', 'Y', 'N'];
    const workbook = workbookFromRows([
      ['姓名', '是否收藏'],
      ...values.map((value, index) => [`联系人${index}`, value]),
    ]);
    const parsed = parseWorkbookBuffer(workbookToXlsxArray(workbook), 'favorite.xlsx');
    expect(parsed.rows.map((r) => r.isFavorite)).toEqual([
      true,
      false,
      true,
      false,
      true,
      false,
      true,
      false,
    ]);
  });

  it('跳过空行，并按真实 Excel 行号报告姓名缺失和非法邮箱', () => {
    const workbook = workbookFromRows([
      ['姓名', '电话', '邮箱'],
      ['', '', ''],
      ['', '13800000000', 'ok@example.com'],
      ['李四', '13900000000', 'not-an-email'],
      ['王五', '13700000000', 'wang@example.com'],
    ]);
    const parsed = parseWorkbookBuffer(workbookToXlsxArray(workbook), 'errors.xlsx');
    expect(parsed.rows.map((r) => r.name)).toEqual(['王五']);
    expect(parsed.errors.map((e) => e.rowNumber)).toEqual([3, 4]);
    expect(parsed.errors[0].message).toContain('第 3 行缺少姓名');
    expect(parsed.errors[1].message).toContain('邮箱');
  });

  it('明细类型错误时给出明确行号，不静默丢弃', () => {
    const workbook = workbookFromRows([
      ['姓名', '电话', '邮箱', '地址', '备注', '是否收藏'],
      ['林晚晴', '', '', '', '', '否'],
    ]);
    const details = XLSX.utils.aoa_to_sheet([
      ['主表行号', '联系人ID', '姓名', '类型', '标签', '值', '顺序'],
      [2, 'c1', '林晚晴', '未知类型', '手机', '13800000000', 0],
    ]);
    XLSX.utils.book_append_sheet(workbook, details, 'ContactDetails');
    const parsed = parseWorkbookBuffer(workbookToXlsxArray(workbook), 'details.xlsx');
    expect(parsed.errors).toHaveLength(1);
    expect(parsed.errors[0].message).toContain('无法识别');
  });

  it('含前导零的 .xls 文件按文本保留号码', () => {
    const workbook = workbookFromRows([
      ['姓名', '电话'],
      ['赵六', '001234'],
    ]);
    const xls = XLSX.write(workbook, { bookType: 'xls', type: 'array' }) as ArrayBuffer;
    const parsed = parseWorkbookBuffer(xls, 'leading-zero.xls');
    expect(parsed.rows[0].methods[0].value).toBe('001234');
  });

  it('支持 UTF-8 CSV 与 Google/Outlook 风格表头', () => {
    const csv = [
      'First Name,Last Name,Phone 1 - Value,E-mail 1 - Value,Notes,Favorite',
      'Alice,Wang,+1 555 0100,alice@example.com,VIP,Y',
    ].join('\n');
    const buffer = new TextEncoder().encode(csv).buffer as ArrayBuffer;
    const parsed = parseWorkbookBuffer(buffer, 'google.csv');
    expect(parsed.rows[0].name).toBe('Alice Wang');
    expect(parsed.rows[0].methods).toHaveLength(2);
    expect(parsed.rows[0].isFavorite).toBe(true);
  });

  it('损坏文件与缺少姓名列都给出友好错误', () => {
    const corrupt = new TextEncoder().encode('not an excel workbook').buffer as ArrayBuffer;
    expect(() => parseWorkbookBuffer(corrupt, 'corrupt.xlsx')).toThrow(WorkbookImportError);

    const noName = workbookFromRows([['电话', '邮箱'], ['13800000000', 'a@example.com']]);
    expect(() => parseWorkbookBuffer(workbookToXlsxArray(noName), 'no-name.xlsx')).toThrow(
      WorkbookImportError,
    );
  });

  it('表头别名分类覆盖常见写法', () => {
    expect(classifyHeader('姓名')).toBe('name');
    expect(classifyHeader('Full Name')).toBe('name');
    expect(classifyHeader('First Name')).toBe('firstName');
    expect(classifyHeader('Last Name')).toBe('lastName');
    expect(classifyHeader('手机号')).toBe('phone');
    expect(classifyHeader('E-mail 1 - Value')).toBe('email');
    expect(classifyHeader('E-mail 1 - Label')).toBe('ignore');
    expect(classifyHeader('Address 1 - Formatted')).toBe('address');
    expect(classifyHeader('是否收藏')).toBe('favorite');
  });
});
