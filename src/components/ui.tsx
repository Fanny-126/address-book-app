import { useEffect, useId, useRef, type ReactNode } from 'react';

/** 星标收藏按钮：aria-label 明确为「收藏xx / 取消收藏xx」（A4 可访问性要求） */
export function StarButton({
  active,
  name,
  onToggle,
}: {
  active: boolean;
  name: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`star-btn${active ? ' on' : ''}`}
      aria-label={active ? `取消收藏${name}` : `收藏${name}`}
      aria-pressed={active}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </button>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="empty-state">
      <p className="big">{title}</p>
      {hint ? <p>{hint}</p> : null}
    </div>
  );
}

/** 页面标题区：统一标题、说明与右侧操作 */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div className="page-header-text">
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </div>
  );
}

export function StatusBadge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
  children: ReactNode;
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

/** 通用弹窗：打开后聚焦关闭按钮，Escape / 遮罩 / 取消均可关闭 */
export function Modal({
  open,
  title,
  children,
  footer,
  onClose,
  wide = false,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="modal-backdrop open"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={`modal${wide ? ' modal-wide' : ''} modal-scroll`}>
        <div className="modal-head">
          <h3 id={titleId}>{title}</h3>
          <button
            ref={closeRef}
            type="button"
            className="modal-close"
            aria-label="关闭弹窗"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-btns">{footer}</div> : null}
      </div>
    </div>
  );
}

/** 通用确认弹窗：Esc / 遮罩点击 / 取消按钮均可关闭（A2 删除二次确认） */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmText = '确认',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div
      className="modal-backdrop open"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="modal">
        <h3 id="confirm-title">{title}</h3>
        <div className="modal-body">{children}</div>
        <div className="modal-btns">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            取消
          </button>
          <button ref={confirmRef} type="button" className="btn btn-danger" onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
