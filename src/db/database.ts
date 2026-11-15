import Dexie, { type Table } from 'dexie';
import type { Contact, Group } from '@/types/contact';

/**
 * IndexedDB 持久化层（Dexie）。
 * 浏览器关闭后数据仍在；空库首次打开时不写入任何演示数据。
 */
export class AddressBookDB extends Dexie {
  contacts!: Table<Contact, string>;
  groups!: Table<Group, string>;

  constructor(name = 'address-book') {
    super(name);
    this.version(1).stores({
      // 索引：主键 id；name / isFavorite 用于筛选；*groupIds 多值索引用于分组筛选
      contacts: 'id, name, isFavorite, *groupIds',
      groups: 'id, name',
    });
  }
}

export const db = new AddressBookDB();
