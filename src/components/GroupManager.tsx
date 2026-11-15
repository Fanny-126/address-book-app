import { useEffect, useRef, useState } from 'react';
import type { Group } from '@/types/contact';
import { contactRepository } from '@/repository/contactRepository';
import { ConfirmDialog } from '@/components/ui';
import { useToast } from '@/components/toastContext';

/** 分组管理弹窗：新建 / 重命名 / 删除（删除分组不删联系人，A6） */
export function GroupManager({
  open,
  groups,
  contactCounts,
  onClose,
}: {
  open: boolean;
  groups: Group[];
  contactCounts: (gid: string) => number;
  onClose: () => void;
}) {
  const toast = useToast();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deleting, setDeleting] = useState<Group | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      // 每次打开弹窗等价于重新挂载，需要重置内部编辑状态
      /* eslint-disable react-hooks/set-state-in-effect */
      setNewName('');
      setEditingId(null);
      setDeleting(null);
      /* eslint-enable react-hooks/set-state-in-effect */
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const run = async (fn: () => Promise<unknown>, okMsg: string) => {
    try {
      await fn();
      toast.show(okMsg);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : '操作失败', 'error');
    }
  };

  return (
    <div
      className="modal-backdrop open"
      role="dialog"
      aria-modal="true"
      aria-label="管理分组"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal modal-wide">
        <h3>管理分组</h3>
        <div className="modal-body">
          <div className="group-new">
            <input
              ref={inputRef}
              className="text-input"
              aria-label="新分组名称"
              placeholder="新分组名称，如：家人、同事"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newName.trim()) {
                  void run(async () => {
                    await contactRepository.createGroup(newName);
                    setNewName('');
                  }, `已创建分组「${newName.trim()}」`);
                }
              }}
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                void run(async () => {
                  await contactRepository.createGroup(newName);
                  setNewName('');
                }, `已创建分组「${newName.trim()}」`)
              }
            >
              新建
            </button>
          </div>

          {groups.length === 0 ? (
            <p className="muted" style={{ padding: '12px 0' }}>还没有分组，先创建一个吧。</p>
          ) : (
            <ul className="group-list">
              {groups.map((g) => (
                <li key={g.id}>
                  {editingId === g.id ? (
                    <>
                      <input
                        className="text-input"
                        aria-label={`重命名分组 ${g.name}`}
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() =>
                          void run(async () => {
                            await contactRepository.renameGroup(g.id, editingName);
                            setEditingId(null);
                          }, '分组已重命名')
                        }
                      >
                        保存
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>
                        取消
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="group-name">
                        {g.name}
                        <span className="muted">（{contactCounts(g.id)} 人）</span>
                      </span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        aria-label={`重命名分组${g.name}`}
                        onClick={() => {
                          setEditingId(g.id);
                          setEditingName(g.name);
                        }}
                      >
                        重命名
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger-ghost btn-sm"
                        aria-label={`删除分组${g.name}`}
                        onClick={() => setDeleting(g)}
                      >
                        删除
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="modal-btns">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            完成
          </button>
        </div>

        <ConfirmDialog
          open={!!deleting}
          title="删除分组"
          confirmText="确认删除"
          onCancel={() => setDeleting(null)}
          onConfirm={() =>
            void run(async () => {
              if (deleting) await contactRepository.deleteGroup(deleting.id);
              setDeleting(null);
            }, `已删除分组「${deleting?.name}」`)
          }
        >
          <p>
            确定删除分组「{deleting?.name}」吗？分组内的 <strong>{deleting ? contactCounts(deleting.id) : 0} 位联系人不会被删除</strong>，只会移出该分组。
          </p>
        </ConfirmDialog>
      </div>
    </div>
  );
}
