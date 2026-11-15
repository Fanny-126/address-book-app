import { describe, expect, it } from 'vitest';
import type { Contact } from '@/types/contact';
import { dedupeRows, normalizeEmail, normalizePhone, selectRowsForImport, toContactInputs } from '@/lib/excel/dedupe';
import type { ParsedContactRow } from '@/lib/excel/types';

function existing(overrides: Partial<Contact> = {}): Contact {
  return {
    id: 'c1',
    name: '张三',
    isFavorite: false,
    groupIds: [],
    note: '',
    methods: [
      { id: 'm1', type: 'phone', label: '手机', value: '138-0000-0000', order: 0 },
      { id: 'm2', type: 'email', label: '邮箱', value: 'Zhang@Example.com', order: 1 },
    ],
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  };
}

function row(rowNumber: number, name: string, phones: string[], emails: string[] = []): ParsedContactRow {
  return {
    rowNumber,
    name,
    isFavorite: false,
    note: '',
    fromDetails: false,
    methods: [
      ...phones.map((value, index) => ({ type: 'phone' as const, label: '手机', value, order: index })),
      ...emails.map((value, index) => ({
        type: 'email' as const,
        label: '邮箱',
        value,
        order: phones.length + index,
      })),
    ],
  };
}

describe('B5 重复校验', () => {
  it('规范化电话与邮箱', () => {
    expect(normalizePhone(' +86 (138) 0000-0000 ')).toBe('+8613800000000');
    expect(normalizePhone('001234')).toBe('001234');
    expect(normalizeEmail(' Zhang@Example.COM ')).toBe('zhang@example.com');
  });

  it('文件内部重复只保留一条新增记录', () => {
    const summary = dedupeRows(
      [row(2, '李四', ['13800000000']), row(3, '李四二号', ['138 0000 0000'])],
      [],
    );
    expect(summary.newCount).toBe(1);
    expect(summary.strongCount).toBe(1);
    expect(summary.entries[1].reason).toContain('文件第 2 行');
  });

  it('与现有联系人电话或邮箱相同即为强重复', () => {
    const summary = dedupeRows(
      [row(2, '张三', [' 138 0000 0000 ']), row(3, '张三丰', [], ['ZHANG@example.com'])],
      [existing()],
    );
    expect(summary.strongCount).toBe(2);
    expect(summary.entries[0].reason).toContain('电话');
    expect(summary.entries[1].reason).toContain('邮箱');
  });

  it('同名但电话邮箱不同只标记疑似重复，不直接删除', () => {
    const summary = dedupeRows([row(2, '张三', ['13900000000'], ['other@example.com'])], [existing()]);
    expect(summary.newCount).toBe(0);
    expect(summary.suspectedCount).toBe(1);
    expect(summary.entries[0].kind).toBe('suspected');
    expect(selectRowsForImport(summary, false)).toHaveLength(1);
    expect(selectRowsForImport(summary, true)).toHaveLength(0);
  });

  it('不同姓名但邮箱相同识别为强重复', () => {
    const summary = dedupeRows([row(2, '李四', [], ['zhang@example.com'])], [existing()]);
    expect(summary.strongCount).toBe(1);
    expect(selectRowsForImport(summary, false)).toHaveLength(0);
  });

  it('转换为 bulkCreate 入参时不带联系人 ID 与时间戳', () => {
    const inputs = toContactInputs([row(2, '王五', ['13700000000'])]);
    expect(inputs).toEqual([
      {
        name: '王五',
        isFavorite: false,
        note: '',
        methods: [{ type: 'phone', label: '手机', value: '13700000000' }],
      },
    ]);
  });
});
