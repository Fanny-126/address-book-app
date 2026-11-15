import { useAddressBook } from '@/hooks/useAddressBook';
import { ContactForm } from '@/components/ContactForm';

/** 新建联系人页（A2） */
export function ContactNewPage() {
  const { groups, loading } = useAddressBook();
  if (loading) return <p className="muted" style={{ padding: 24 }}>加载中…</p>;
  return (
    <div className="page">
      <div className="page-bar">
        <h2 className="page-title">新建联系人</h2>
      </div>
      <div className="card">
        <ContactForm groups={groups} />
      </div>
    </div>
  );
}
