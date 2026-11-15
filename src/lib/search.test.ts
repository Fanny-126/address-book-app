import { describe, it, expect } from 'vitest';
import { contactMatches, filterContacts, normalizeQuery } from '@/lib/search';
import type { Contact } from '@/types/contact';

/** 搜索与分组筛选（A5/A6 逻辑层） */

function makeContact(patch: Partial<Contact>): Contact {
  return {
    id: 'x',
    name: '默认',
    isFavorite: false,
    groupIds: [],
    methods: [],
    note: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...patch,
  };
}

const lin = makeContact({
  id: 'c1',
  name: '林晚晴',
  note: '周三例会联系人',
  groupIds: ['g1'],
  methods: [
    { id: 'm1', type: 'phone', label: '手机', value: '138-5920-1024', order: 0 },
    { id: 'm2', type: 'email', label: '工作', value: 'WanQing@Example.com', order: 1 },
    { id: 'm3', type: 'social', label: '微信', value: 'wanqing_lin', order: 2 },
    { id: 'm4', type: 'address', label: '公司', value: '厦门市思明区', order: 3 },
  ],
});

describe('搜索', () => {
  it('关键词去首尾空格、英文不区分大小写', () => {
    expect(normalizeQuery('  ABC ')).toBe('abc');
    expect(contactMatches(lin, '  WANQING@EXAMPLE.COM ')).toBe(true);
  });

  it('按姓名（完整 / 部分）命中', () => {
    expect(contactMatches(lin, '林晚晴')).toBe(true);
    expect(contactMatches(lin, '晚晴')).toBe(true);
  });

  it('按电话、邮箱、社交账号、地址片段命中', () => {
    expect(contactMatches(lin, '5920')).toBe(true);
    expect(contactMatches(lin, 'example.com')).toBe(true);
    expect(contactMatches(lin, 'wanqing_lin')).toBe(true);
    expect(contactMatches(lin, '思明')).toBe(true);
  });

  it('关键词只存在于备注时也能命中', () => {
    expect(contactMatches(lin, '例会')).toBe(true);
  });

  it('空关键词命中全部；无匹配返回 false', () => {
    expect(contactMatches(lin, '')).toBe(true);
    expect(contactMatches(lin, '不存在的关键词')).toBe(false);
  });
});

describe('搜索 + 分组组合筛选（交集）', () => {
  const other = makeContact({ id: 'c2', name: '陈予安', groupIds: ['g2'] });

  it('仅分组筛选', () => {
    expect(filterContacts([lin, other], '', 'g1').map((c) => c.id)).toEqual(['c1']);
  });

  it('分组 + 关键词取交集', () => {
    // 名字命中但不在 g2 分组 → 被排除
    expect(filterContacts([lin, other], '晚晴', 'g2')).toEqual([]);
    expect(filterContacts([lin, other], '晚晴', 'g1').map((c) => c.id)).toEqual(['c1']);
    // 不限分组时只看关键词
    expect(filterContacts([lin, other], '晚晴', null).map((c) => c.id)).toEqual(['c1']);
  });
});
