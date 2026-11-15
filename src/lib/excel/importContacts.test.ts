import { describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx-js-style';
import type { Contact, ContactInput, ContactRepository } from '@/types/contact';
import { workbookToXlsxArray } from '@/lib/excel/exportWorkbook';
import { commitImport, previewImportFile } from '@/lib/excel/importContacts';

function makeFile(rows: unknown[][]): File {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Contacts');
  const buffer = workbookToXlsxArray(workbook);
  return new File([buffer], 'contacts.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function fakeRepository(existing: Contact[] = []): ContactRepository {
  return {
    list: vi.fn(async () => existing),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    bulkCreate: vi.fn(async (inputs: ContactInput[]) =>
      inputs.map((input, index) => ({
        id: `new-${index}`,
        name: input.name,
        isFavorite: input.isFavorite ?? false,
        groupIds: [],
        methods: (input.methods ?? []).map((m, i) => ({
          id: `m-${i}`,
          type: m.type,
          label: m.label,
          value: m.value,
          order: i,
        })),
        note: input.note ?? '',
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      })),
    ),
    listGroups: vi.fn(),
    createGroup: vi.fn(),
    renameGroup: vi.fn(),
    deleteGroup: vi.fn(),
    subscribe: vi.fn(() => () => {}),
  } as unknown as ContactRepository;
}

const existingContact: Contact = {
  id: 'c1',
  name: '张三',
  isFavorite: false,
  groupIds: [],
  note: '',
  methods: [{ id: 'm1', type: 'phone', label: '手机', value: '13800000000', order: 0 }],
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};

describe('B5 导入预览与确认', () => {
  it('预览阶段只读，不调用 bulkCreate', async () => {
    const repository = fakeRepository([existingContact]);
    const preview = await previewImportFile(
      makeFile([
        ['姓名', '电话'],
        ['李四', '13900000000'],
        ['张三', '138 0000 0000'],
      ]),
      repository,
    );
    expect(preview.summary.newCount).toBe(1);
    expect(preview.summary.strongCount).toBe(1);
    expect(repository.bulkCreate).not.toHaveBeenCalled();
  });

  it('确认后只写入新增行，并报告真实数量', async () => {
    const repository = fakeRepository([existingContact]);
    const preview = await previewImportFile(
      makeFile([
        ['姓名', '电话'],
        ['李四', '13900000000'],
        ['张三', '138 0000 0000'],
      ]),
      repository,
    );
    const result = await commitImport(preview, { skipSuspected: false }, repository);
    expect(result).toEqual({ added: 1, skipped: 1, failed: 0, failedRows: [] });
    expect(repository.bulkCreate).toHaveBeenCalledTimes(1);
    const inputs = vi.mocked(repository.bulkCreate).mock.calls[0][0];
    expect(inputs).toHaveLength(1);
    expect(inputs[0].name).toBe('李四');
  });

  it('取消导入时不写入任何数据', async () => {
    const repository = fakeRepository();
    const preview = await previewImportFile(
      makeFile([
        ['姓名', '电话'],
        ['李四', '13900000000'],
      ]),
      repository,
    );
    expect(preview.summary.newCount).toBe(1);
    expect(repository.bulkCreate).not.toHaveBeenCalled();
  });

  it('批量写入失败时报告失败且不谎报成功', async () => {
    const repository = fakeRepository();
    vi.mocked(repository.bulkCreate).mockRejectedValueOnce(new Error('事务失败'));
    const preview = await previewImportFile(
      makeFile([
        ['姓名', '电话'],
        ['李四', '13900000000'],
      ]),
      repository,
    );
    const result = await commitImport(preview, { skipSuspected: false }, repository);
    expect(result.added).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.failedRows[0].message).toContain('事务失败');
  });
});
