import { db } from '@/db/database';
import type {
  Contact,
  ContactInput,
  ContactPatch,
  ContactRepository,
  Group,
} from '@/types/contact';
import { validateContactInput, validateGroupName } from '@/lib/validation';

function uuid(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

/** 输入 → 完整 Contact（生成 id、method id、order、时间戳） */
function buildMethods(inputMethods: NonNullable<ContactInput['methods']>) {
  return inputMethods
    .filter((m) => m.value.trim() !== '') // 空内容行静默忽略，不进入存储
    .map((m, i) => ({
      id: uuid(),
      type: m.type,
      label: m.label.trim(),
      value: m.value, // 值原样保留（电话前导零、+、空格等）
      order: i,
    }));
}

function buildContact(input: ContactInput, id = uuid()): Contact {
  const errors = validateContactInput(input);
  if (errors.length > 0) {
    throw new Error(errors.map((e) => e.message).join('；'));
  }
  const t = now();
  return {
    id,
    name: input.name.trim(),
    isFavorite: input.isFavorite ?? false,
    groupIds: input.groupIds ?? [],
    methods: buildMethods(input.methods ?? []),
    note: input.note ?? '',
    createdAt: t,
    updatedAt: t,
  };
}

/**
 * ContactRepository 的 Dexie/IndexedDB 实现。
 * 所有写操作完成后调用 notify() 触发订阅者刷新。
 */
export class DexieContactRepository implements ContactRepository {
  private listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  async list(): Promise<Contact[]> {
    const all = await db.contacts.toArray();
    // 统一排序：收藏优先，其次按姓名（中文按拼音）
    return all.sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      return a.name.localeCompare(b.name, 'zh-Hans-CN');
    });
  }

  async get(id: string): Promise<Contact | undefined> {
    return db.contacts.get(id);
  }

  async create(input: ContactInput): Promise<Contact> {
    const contact = buildContact(input);
    await db.contacts.add(contact);
    this.notify();
    return contact;
  }

  async update(id: string, patch: ContactPatch): Promise<Contact> {
    const existing = await db.contacts.get(id);
    if (!existing) throw new Error('联系人不存在或已被删除');

    const merged: ContactInput = {
      name: patch.name ?? existing.name,
      isFavorite: patch.isFavorite ?? existing.isFavorite,
      groupIds: patch.groupIds ?? existing.groupIds,
      note: patch.note ?? existing.note,
      methods: patch.methods
        ? patch.methods
        : existing.methods.map((m) => ({ type: m.type, label: m.label, value: m.value })),
    };
    const errors = validateContactInput(merged);
    if (errors.length > 0) throw new Error(errors.map((e) => e.message).join('；'));

    const next: Contact = {
      ...existing,
      name: merged.name.trim(),
      isFavorite: merged.isFavorite ?? false,
      groupIds: merged.groupIds ?? [],
      note: merged.note ?? '',
      // 仅在显式提交 methods 时重建；收藏切换等轻量更新保留原条目（含 id 与顺序）
      methods: patch.methods ? buildMethods(patch.methods) : existing.methods,
      createdAt: existing.createdAt, // createdAt 创建后不变
      updatedAt: now(), // updatedAt 每次更新刷新
    };
    await db.contacts.put(next);
    this.notify();
    return next;
  }

  async delete(id: string): Promise<void> {
    await db.contacts.delete(id);
    this.notify();
  }

  async bulkCreate(inputs: ContactInput[]): Promise<Contact[]> {
    // 先在内存中完成全部校验，任一失败则整批拒绝
    const contacts = inputs.map((input) => buildContact(input));
    // Dexie 事务：全部成功才提交，失败自动回滚，不产生部分脏数据
    await db.transaction('rw', db.contacts, async () => {
      await db.contacts.bulkAdd(contacts);
    });
    this.notify();
    return contacts;
  }

  async listGroups(): Promise<Group[]> {
    const all = await db.groups.toArray();
    return all.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
  }

  async createGroup(name: string): Promise<Group> {
    const err = validateGroupName(name);
    if (err) throw new Error(err);
    const trimmed = name.trim();
    const dup = (await db.groups.toArray()).find((g) => g.name === trimmed);
    if (dup) throw new Error(`分组「${trimmed}」已存在`);
    const group: Group = { id: uuid(), name: trimmed, createdAt: now() };
    await db.groups.add(group);
    this.notify();
    return group;
  }

  async renameGroup(id: string, name: string): Promise<Group> {
    const err = validateGroupName(name);
    if (err) throw new Error(err);
    const existing = await db.groups.get(id);
    if (!existing) throw new Error('分组不存在或已被删除');
    const next: Group = { ...existing, name: name.trim() };
    await db.groups.put(next);
    this.notify();
    return next;
  }

  async deleteGroup(id: string): Promise<void> {
    // 删除分组 + 清理所有联系人上的该 groupId；联系人不删除
    await db.transaction('rw', db.groups, db.contacts, async () => {
      await db.groups.delete(id);
      await db.contacts
        .where('groupIds')
        .equals(id)
        .modify((c) => {
          c.groupIds = c.groupIds.filter((gid) => gid !== id);
          c.updatedAt = now();
        });
    });
    this.notify();
  }
}

/** 全局单例仓储 */
export const contactRepository: ContactRepository = new DexieContactRepository();
