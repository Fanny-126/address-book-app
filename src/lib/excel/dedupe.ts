import type { Contact, ContactInput } from '@/types/contact';
import type { DedupeEntry, DedupeSummary, ParsedContactRow } from './types';

/** 电话规范化：去除空格、连字符、括号等非号码字符，保留数字与开头的 + */
export function normalizePhone(value: string): string {
  const cleaned = value.replace(/[^\d+]/g, '');
  return cleaned.replace(/(?!^)\+/g, '');
}

/** 邮箱规范化：去首尾空格并转小写后比较 */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

interface IndexedContact {
  phones: Map<string, string>;
  emails: Map<string, string>;
  names: Map<string, string>;
}

function indexContacts(contacts: Contact[]): IndexedContact {
  const index: IndexedContact = { phones: new Map(), emails: new Map(), names: new Map() };
  contacts.forEach((contact) => {
    contact.methods.forEach((method) => {
      if (method.type === 'phone') {
        const key = normalizePhone(method.value);
        if (key !== '' && !index.phones.has(key)) index.phones.set(key, contact.name);
      }
      if (method.type === 'email') {
        const key = normalizeEmail(method.value);
        if (key !== '' && !index.emails.has(key)) index.emails.set(key, contact.name);
      }
    });
    const nameKey = normalizeName(contact.name);
    if (nameKey !== '' && !index.names.has(nameKey)) index.names.set(nameKey, contact.name);
  });
  return index;
}

function rowPhones(row: ParsedContactRow): string[] {
  return row.methods
    .filter((m) => m.type === 'phone')
    .map((m) => normalizePhone(m.value))
    .filter((v) => v !== '');
}

function rowEmails(row: ParsedContactRow): string[] {
  return row.methods
    .filter((m) => m.type === 'email')
    .map((m) => normalizeEmail(m.value))
    .filter((v) => v !== '');
}

/**
 * 导入前重复校验（B5）：
 * - 任一规范化电话或邮箱与现有数据 / 文件内前面的行相同 → 强重复（默认跳过）；
 * - 只有姓名相同 → 疑似重复（默认保留，不直接按姓名删除）。
 */
export function dedupeRows(rows: ParsedContactRow[], existingContacts: Contact[]): DedupeSummary {
  const existing = indexContacts(existingContacts);
  const seenPhones = new Map<string, number>();
  const seenEmails = new Map<string, number>();
  const seenNames = new Map<string, number>();
  const entries: DedupeEntry[] = [];

  rows.forEach((row) => {
    const phones = rowPhones(row);
    const emails = rowEmails(row);
    const nameKey = normalizeName(row.name);

    let kind: DedupeEntry['kind'] = 'new';
    let reason: string | undefined;

    for (const phone of phones) {
      if (existing.phones.has(phone)) {
        kind = 'strong';
        reason = `电话与现有联系人「${existing.phones.get(phone)}」重复`;
        break;
      }
      if (seenPhones.has(phone)) {
        kind = 'strong';
        reason = `电话与文件第 ${seenPhones.get(phone)} 行重复`;
        break;
      }
    }
    if (kind === 'new') {
      for (const email of emails) {
        if (existing.emails.has(email)) {
          kind = 'strong';
          reason = `邮箱与现有联系人「${existing.emails.get(email)}」重复`;
          break;
        }
        if (seenEmails.has(email)) {
          kind = 'strong';
          reason = `邮箱与文件第 ${seenEmails.get(email)} 行重复`;
          break;
        }
      }
    }
    if (kind === 'new' && nameKey !== '') {
      if (existing.names.has(nameKey)) {
        kind = 'suspected';
        reason = `与现有联系人「${existing.names.get(nameKey)}」同名，请确认是否重复`;
      } else if (seenNames.has(nameKey)) {
        kind = 'suspected';
        reason = `与文件第 ${seenNames.get(nameKey)} 行同名，请确认是否重复`;
      }
    }

    entries.push({ row, kind, reason });

    phones.forEach((phone) => {
      if (!seenPhones.has(phone)) seenPhones.set(phone, row.rowNumber);
    });
    emails.forEach((email) => {
      if (!seenEmails.has(email)) seenEmails.set(email, row.rowNumber);
    });
    if (nameKey !== '' && !seenNames.has(nameKey)) seenNames.set(nameKey, row.rowNumber);
  });

  const counts = entries.reduce(
    (acc, entry) => {
      if (entry.kind === 'new') acc.newCount += 1;
      if (entry.kind === 'strong') acc.strongCount += 1;
      if (entry.kind === 'suspected') acc.suspectedCount += 1;
      return acc;
    },
    { newCount: 0, strongCount: 0, suspectedCount: 0 },
  );

  return { entries, ...counts, errorCount: 0 };
}

/** 用户确认后真正写入的行：强重复永远跳过，疑似重复可选择跳过 */
export function selectRowsForImport(summary: DedupeSummary, skipSuspected: boolean): ParsedContactRow[] {
  return summary.entries
    .filter((entry) => entry.kind === 'new' || (entry.kind === 'suspected' && !skipSuspected))
    .map((entry) => entry.row);
}

/** 转成仓储 bulkCreate 的入参（不直接操作 IndexedDB） */
export function toContactInputs(rows: ParsedContactRow[]): ContactInput[] {
  return rows.map((row) => ({
    name: row.name,
    isFavorite: row.isFavorite,
    note: row.note,
    methods: row.methods.map((method) => ({
      type: method.type,
      label: method.label,
      value: method.value,
    })),
  }));
}
