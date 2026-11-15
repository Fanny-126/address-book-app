import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx-js-style';
import type { Contact, ContactMethod } from '@/types/contact';
import {
  buildContactsWorkbook,
  createExportFile,
  exportFileName,
} from '@/lib/excel/exportWorkbook';

function method(
  type: ContactMethod['type'],
  label: string,
  value: string,
  order: number,
): ContactMethod {
  return { id: `m-${order}`, type, label, value, order };
}

function contact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: overrides.id ?? 'c1',
    name: overrides.name ?? '林晚晴',
    isFavorite: overrides.isFavorite ?? true,
    groupIds: [],
    note: overrides.note ?? '大学同学',
    methods: overrides.methods ?? [],
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  };
}

const richContact = contact({
  methods: [
    method('phone', '手机', '+8613800000000', 0),
    method('phone', '公司', '010-12345678', 1),
    method('email', '个人', 'lin@example.com', 2),
    method('email', '工作', 'lin@work.example.com', 3),
    method('social', '微信', 'lin_wechat', 4),
    method('address', '家庭', '北京市朝阳区示例路 1 号', 5),
    method('address', '公司', '上海市浦东新区示例路 2 号', 6),
    method('custom', '备用号', '001234', 7),
  ],
});

describe('B2 标准 Excel 导出', () => {
  it('主表表头严格为六列且每位联系人只占一行', () => {
    const workbook = buildContactsWorkbook([richContact, contact({ id: 'c2', name: '陈默', isFavorite: false, methods: [] })]);
    expect(workbook.SheetNames).toEqual(['Contacts', 'ContactDetails']);

    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets.Contacts, {
      header: 1,
      defval: '',
      blankrows: true,
    });
    expect(rows[0]).toEqual(['姓名', '电话', '邮箱', '地址', '备注', '是否收藏']);
    expect(rows).toHaveLength(3);
    expect(rows[1]).toEqual([
      '林晚晴',
      '+8613800000000\n010-12345678',
      'lin@example.com\nlin@work.example.com',
      '北京市朝阳区示例路 1 号\n上海市浦东新区示例路 2 号',
      '大学同学',
      '是',
    ]);
    expect(rows[2][5]).toBe('否');
  });

  it('多值单元格自动换行且电话列使用文本类型', () => {
    const workbook = buildContactsWorkbook([richContact]);
    const sheet = workbook.Sheets.Contacts;
    expect(sheet.B2.t).toBe('s');
    expect(sheet.B2.v).toBe('+8613800000000\n010-12345678');
    expect(sheet.B2.z).toBe('@');
    expect(sheet.B2.s.alignment.wrapText).toBe(true);
    expect(sheet.C2.s.alignment.wrapText).toBe(true);
  });

  it('ContactDetails 保留全部联系方式类型、标签、值和顺序', () => {
    const workbook = buildContactsWorkbook([richContact]);
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets.ContactDetails, {
      header: 1,
      defval: '',
      blankrows: true,
    });
    expect(rows[0]).toEqual(['主表行号', '联系人ID', '姓名', '类型', '标签', '值', '顺序']);
    expect(rows).toHaveLength(9);
    expect(rows[1]).toEqual([2, 'c1', '林晚晴', '电话', '手机', '+8613800000000', 0]);
    expect(rows[8]).toEqual([2, 'c1', '林晚晴', '自定义', '备用号', '001234', 7]);
  });

  it('空通讯录仍导出完整六列表头', () => {
    const workbook = buildContactsWorkbook([]);
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets.Contacts, {
      header: 1,
      defval: '',
      blankrows: true,
    });
    expect(rows).toEqual([['姓名', '电话', '邮箱', '地址', '备注', '是否收藏']]);
    expect(createExportFile([]).rowCount).toBe(0);
  });

  it('以 = + - @ 开头的用户文本不会被写成公式', () => {
    const dangerous = contact({ name: '=SUM(1,1)', note: '+cmd|test', methods: [] });
    const workbook = buildContactsWorkbook([dangerous]);
    const sheet = workbook.Sheets.Contacts;
    expect(sheet.A2.t).toBe('s');
    expect(sheet.A2.v).toBe('=SUM(1,1)');
    expect(sheet.A2.f).toBeUndefined();
    expect(sheet.E2.t).toBe('s');
  });

  it('导出文件名包含日期时间', () => {
    const name = exportFileName(new Date(2026, 10, 15, 20, 30, 5));
    expect(name).toBe('contacts_20261115_203005.xlsx');
  });
});
