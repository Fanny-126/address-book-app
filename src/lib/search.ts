import type { Contact } from '@/types/contact';

/** 搜索关键词规范化：去首尾空格 + 英文小写（不区分大小写） */
export function normalizeQuery(q: string): string {
  return q.trim().toLowerCase();
}

/**
 * 判断联系人是否命中关键词。
 * 检索范围：姓名、备注、所有联系方式的标签与内容（覆盖电话/邮箱/社交账号/地址）。
 */
export function contactMatches(contact: Contact, query: string): boolean {
  const q = normalizeQuery(query);
  if (q === '') return true;
  const haystacks: string[] = [contact.name, contact.note];
  for (const m of contact.methods) {
    haystacks.push(m.label, m.value);
  }
  return haystacks.some((h) => normalizeQuery(h).includes(q));
}

/** 组合筛选：搜索关键词 + 分组（交集）。groupId 为 null 表示不限分组。 */
export function filterContacts(
  contacts: Contact[],
  query: string,
  groupId: string | null,
): Contact[] {
  return contacts.filter((c) => {
    if (groupId !== null && !c.groupIds.includes(groupId)) return false;
    return contactMatches(c, query);
  });
}
