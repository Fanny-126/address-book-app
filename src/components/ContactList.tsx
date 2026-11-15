import { useNavigate } from 'react-router';
import type { Contact } from '@/types/contact';
import { contactRepository } from '@/repository/contactRepository';
import { METHOD_TYPE_NAME } from '@/lib/validation';
import { StarButton, EmptyState } from '@/components/ui';
import { useToast } from '@/components/toastContext';

const AVATAR_COLORS = ['#c96f4a', '#a8824f', '#7d8f69', '#5f8575', '#6b7f9e', '#96708a', '#b3563e', '#8a7d6b'];

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function initial(name: string): string {
  const t = name.trim();
  if (!t) return '?';
  const m = t.match(/[a-zA-Z]+/);
  if (m) return m[0].charAt(0).toUpperCase();
  return t.charAt(0);
}

function primaryMethod(c: Contact): string {
  const m = [...c.methods].sort((a, b) => a.order - b.order)[0];
  if (!m) return '暂无联系方式';
  return m.type === 'custom' ? `${m.label}：${m.value}` : m.value;
}

function methodSummary(c: Contact): string {
  const counts = new Map<string, number>();
  c.methods.forEach((m) => counts.set(m.type, (counts.get(m.type) ?? 0) + 1));
  return [...counts.entries()].map(([t, n]) => `${METHOD_TYPE_NAME[t as keyof typeof METHOD_TYPE_NAME]}×${n}`).join(' · ');
}

/** 联系人列表：列表页与收藏页共用（A2/A4）。点击条目进入编辑页。 */
export function ContactList({
  contacts,
  emptyTitle,
  emptyHint,
}: {
  contacts: Contact[];
  emptyTitle: string;
  emptyHint: string;
}) {
  const navigate = useNavigate();
  const toast = useToast();

  if (contacts.length === 0) {
    return <EmptyState title={emptyTitle} hint={emptyHint} />;
  }

  const toggle = async (c: Contact) => {
    await contactRepository.update(c.id, { isFavorite: !c.isFavorite });
    toast.show(c.isFavorite ? `已取消收藏「${c.name}」` : `已收藏「${c.name}」`);
  };

  return (
    <ul className="contact-list">
      {contacts.map((c) => (
        <li key={c.id}>
          <div
            className="contact-item"
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/contacts/${c.id}/edit`)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate(`/contacts/${c.id}/edit`);
              }
            }}
            aria-label={`编辑联系人${c.name}`}
          >
            <span className="avatar" style={{ background: avatarColor(c.name) }}>
              {initial(c.name)}
            </span>
            <span className="c-info">
              <span className="c-name">
                {c.name}
                {c.isFavorite && (
                  <svg className="star-badge" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                )}
              </span>
              <span className="c-sub">{primaryMethod(c)}</span>
              {c.methods.length > 1 && <span className="c-tags">{methodSummary(c)}</span>}
            </span>
            <StarButton active={c.isFavorite} name={c.name} onToggle={() => void toggle(c)} />
          </div>
        </li>
      ))}
    </ul>
  );
}
