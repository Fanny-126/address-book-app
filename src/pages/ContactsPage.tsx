import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useAddressBook } from '@/hooks/useAddressBook';
import { filterContacts } from '@/lib/search';
import { ContactList } from '@/components/ContactList';
import { GroupManager } from '@/components/GroupManager';

/** 联系人主页（A2 列表 + A5 搜索 + A6 分组筛选） */
export function ContactsPage() {
  const { contacts, groups, loading } = useAddressBook();
  const [query, setQuery] = useState('');
  const [groupId, setGroupId] = useState<string | null>(null);
  const [managerOpen, setManagerOpen] = useState(false);

  const filtered = useMemo(() => filterContacts(contacts, query, groupId), [contacts, query, groupId]);
  const countInGroup = (gid: string) => contacts.filter((c) => c.groupIds.includes(gid)).length;

  const searching = query.trim() !== '' || groupId !== null;

  return (
    <div className="page">
      <div className="page-bar">
        <div className="search-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            id="search"
            type="search"
            aria-label="搜索联系人"
            placeholder="搜索姓名、电话、邮箱、社交账号、地址、备注……"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query !== '' && (
            <button type="button" className="clear-search" aria-label="清空搜索" onClick={() => setQuery('')}>
              ×
            </button>
          )}
        </div>

        <select
          className="group-filter"
          aria-label="按分组筛选"
          value={groupId ?? ''}
          onChange={(e) => setGroupId(e.target.value === '' ? null : e.target.value)}
        >
          <option value="">全部分组（{contacts.length}）</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}（{countInGroup(g.id)}）
            </option>
          ))}
        </select>

        <button type="button" className="btn btn-ghost" onClick={() => setManagerOpen(true)}>
          管理分组
        </button>
        <Link to="/contacts/new" className="btn btn-primary">
          ＋ 新建联系人
        </Link>
      </div>

      {loading ? (
        <p className="muted" style={{ padding: 24 }}>加载中…</p>
      ) : (
        <>
          {searching && filtered.length > 0 && (
            <p className="result-info" role="status">
              找到 {filtered.length} 位联系人
            </p>
          )}
          <ContactList
            contacts={filtered}
            emptyTitle={searching ? '未找到联系人' : '通讯录还是空的'}
            emptyHint={searching ? '换个关键词或分组条件试试。' : '点击右上角「新建联系人」开始吧。'}
          />
        </>
      )}

      <GroupManager open={managerOpen} groups={groups} contactCounts={countInGroup} onClose={() => setManagerOpen(false)} />
    </div>
  );
}
