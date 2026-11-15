import { useCallback, useEffect, useState } from 'react';
import { contactRepository } from '@/repository/contactRepository';
import type { Contact, Group } from '@/types/contact';

/**
 * 订阅仓储数据：任何写操作触发 notify 后自动刷新。
 * 列表 / 收藏页 / 分组视图共用，保证各视图同步。
 */
export function useAddressBook() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [cs, gs] = await Promise.all([
      contactRepository.list(),
      contactRepository.listGroups(),
    ]);
    setContacts(cs);
    setGroups(gs);
    setLoading(false);
  }, []);

  useEffect(() => {
    // 首次挂载时从 IndexedDB 异步加载，属于与外部存储同步
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
    const unsubscribe = contactRepository.subscribe(() => {
      void reload();
    });
    return unsubscribe;
  }, [reload]);

  return { contacts, groups, loading, repository: contactRepository };
}
