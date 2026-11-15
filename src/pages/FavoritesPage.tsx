import { useMemo } from 'react';
import { useAddressBook } from '@/hooks/useAddressBook';
import { ContactList } from '@/components/ContactList';

/** 收藏页（A4）：只显示已收藏联系人，可取消收藏、进入编辑 */
export function FavoritesPage() {
  const { contacts, loading } = useAddressBook();
  const favorites = useMemo(() => contacts.filter((c) => c.isFavorite), [contacts]);

  return (
    <div className="page">
      <div className="page-bar">
        <h2 className="page-title">已收藏 · {favorites.length}</h2>
      </div>
      {loading ? (
        <p className="muted" style={{ padding: 24 }}>加载中…</p>
      ) : (
        <ContactList
          contacts={favorites}
          emptyTitle="还没有收藏的联系人"
          emptyHint="在联系人列表中点击星标，就能把重要的人收藏到这里。"
        />
      )}
    </div>
  );
}
