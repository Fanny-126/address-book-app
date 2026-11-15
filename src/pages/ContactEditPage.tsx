import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAddressBook } from '@/hooks/useAddressBook';
import { contactRepository } from '@/repository/contactRepository';
import { ContactForm } from '@/components/ContactForm';
import { ConfirmDialog, EmptyState } from '@/components/ui';
import { useToast } from '@/components/toastContext';

/** 编辑联系人页（A2）：回填全部字段 + 删除（二次确认） */
export function ContactEditPage() {
  const { id } = useParams<{ id: string }>();
  const { contacts, groups, loading } = useAddressBook();
  const navigate = useNavigate();
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (loading) return <p className="muted" style={{ padding: 24 }}>加载中…</p>;

  const contact = contacts.find((c) => c.id === id);
  if (!contact) {
    return (
      <div className="page">
        <EmptyState title="联系人不存在" hint="它可能已被删除。" />
        <p style={{ textAlign: 'center', marginTop: 12 }}>
          <Link to="/contacts" className="btn btn-ghost">返回联系人列表</Link>
        </p>
      </div>
    );
  }

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    await contactRepository.delete(contact.id);
    toast.show(`已删除「${contact.name}」`);
    navigate('/contacts');
  };

  return (
    <div className="page">
      <div className="page-bar">
        <h2 className="page-title">编辑联系人</h2>
        <button type="button" className="btn btn-danger-ghost" onClick={() => setConfirmOpen(true)}>
          删除联系人
        </button>
      </div>
      <div className="card">
        <ContactForm key={contact.id} initial={contact} groups={groups} />
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="删除联系人"
        confirmText={deleting ? '删除中…' : '确认删除'}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void handleDelete()}
      >
        <p>
          确定要删除「<strong>{contact.name}</strong>」吗？该联系人的全部 {contact.methods.length} 条联系方式将一并移除，<strong>此操作无法恢复</strong>。
        </p>
      </ConfirmDialog>
    </div>
  );
}
