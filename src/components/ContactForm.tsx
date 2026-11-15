import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { Contact, ContactInput, Group } from '@/types/contact';
import { contactRepository } from '@/repository/contactRepository';
import { MethodEditor, newRow, type MethodRow } from '@/components/MethodEditor';
import { useToast } from '@/components/Toast';

/**
 * 新增 / 编辑共用表单（A2）。
 * 编辑模式回填全部字段；取消不修改任何数据；保存中禁用按钮防止重复提交。
 */
export function ContactForm({
  initial,
  groups,
}: {
  initial?: Contact;
  groups: Group[];
}) {
  const isEdit = !!initial;
  const navigate = useNavigate();
  const toast = useToast();

  const [name, setName] = useState(initial?.name ?? '');
  const [isFavorite, setIsFavorite] = useState(initial?.isFavorite ?? false);
  const [groupIds, setGroupIds] = useState<string[]>(initial?.groupIds ?? []);
  const [note, setNote] = useState(initial?.note ?? '');
  const [rows, setRows] = useState<MethodRow[]>(() =>
    initial
      ? initial.methods.map((m) => ({ key: m.id, type: m.type, label: m.label, value: m.value }))
      : [newRow('phone')],
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const toggleGroup = (gid: string) => {
    setGroupIds((prev) => (prev.includes(gid) ? prev.filter((g) => g !== gid) : [...prev, gid]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return; // 防止连续快速点击产生重复联系人
    setSubmitting(true);
    setErrors([]);

    const input: ContactInput = {
      name,
      isFavorite,
      groupIds,
      note,
      methods: rows
        .filter((r) => r.value.trim() !== '') // 空内容行视为未填写，直接忽略
        .map((r) => ({ type: r.type, label: r.label, value: r.value })),
    };

    try {
      if (isEdit) {
        await contactRepository.update(initial.id, input);
        toast.show(`已更新「${input.name.trim()}」`);
      } else {
        await contactRepository.create(input);
        toast.show(`已保存「${input.name.trim()}」`);
      }
      navigate('/contacts');
    } catch (err) {
      setErrors(err instanceof Error ? err.message.split('；') : ['保存失败，请重试']);
      setSubmitting(false); // 失败时恢复可提交
    }
  };

  return (
    <form className="form-grid" onSubmit={handleSubmit} noValidate>
      {errors.length > 0 && (
        <div className="error-box" role="alert">
          {errors.map((msg) => (
            <p key={msg}>· {msg}</p>
          ))}
        </div>
      )}

      <div className="field">
        <label htmlFor="f-name">
          姓名 <span className="req">*</span>
        </label>
        <input
          id="f-name"
          className="text-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：林晚晴"
        />
      </div>

      <div className="field">
        <button
          type="button"
          className={`bookmark-toggle${isFavorite ? ' on' : ''}`}
          aria-pressed={isFavorite}
          onClick={() => setIsFavorite((v) => !v)}
        >
          <svg viewBox="0 0 24 24" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" style={{ width: 17, height: 17 }}>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          {isFavorite ? '已收藏' : '设为收藏'}
        </button>
      </div>

      <div className="field">
        <label>联系方式（可添加任意多条）</label>
        <MethodEditor rows={rows} onChange={setRows} />
      </div>

      <div className="field">
        <label>所属分组（可多选）</label>
        {groups.length === 0 ? (
          <p className="muted" style={{ fontSize: 14 }}>还没有分组，可先在列表页「管理分组」中创建。</p>
        ) : (
          <div className="group-checks">
            {groups.map((g) => (
              <label key={g.id} className="group-check">
                <input
                  type="checkbox"
                  checked={groupIds.includes(g.id)}
                  onChange={() => toggleGroup(g.id)}
                />
                {g.name}
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="field">
        <label htmlFor="f-note">备注</label>
        <textarea
          id="f-note"
          className="text-input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="记录与这位联系人有关的事情……"
        />
      </div>

      <div className="form-foot">
        <button type="button" className="btn btn-ghost" onClick={() => navigate('/contacts')}>
          取消
        </button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? '保存中…' : isEdit ? '保存修改' : '保存联系人'}
        </button>
      </div>
    </form>
  );
}
