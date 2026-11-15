import type { ContactMethodType } from '@/types/contact';
import { METHOD_TYPE_NAME } from '@/lib/validation';
import {
  ALL_TYPES,
  defaultLabel,
  labelPresets,
  newRow,
  type MethodRow,
} from '@/components/methodEditorModel';

/** 联系方式编辑器：类型 + 标签 + 内容，支持任意增删，custom 类型显示自定义标签输入框 */
export function MethodEditor({
  rows,
  onChange,
}: {
  rows: MethodRow[];
  onChange: (rows: MethodRow[]) => void;
}) {
  const updateRow = (key: string, patch: Partial<MethodRow>) => {
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  return (
    <div className="method-editor">
      {rows.length === 0 ? (
        <p className="muted" style={{ fontSize: 14 }}>
          还没有联系方式，点击下方按钮添加。
        </p>
      ) : (
        rows.map((row, idx) => (
          <div className="method-row" key={row.key} data-testid={`method-row-${idx}`}>
            <select
              aria-label={`第 ${idx + 1} 条联系方式类型`}
              value={row.type}
              onChange={(e) => {
                const type = e.target.value as ContactMethodType;
                updateRow(row.key, { type, label: defaultLabel(type) });
              }}
            >
              {ALL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {METHOD_TYPE_NAME[t]}
                </option>
              ))}
            </select>

            {row.type === 'custom' ? (
              <input
                className="text-input label-input"
                aria-label={`第 ${idx + 1} 条自定义标签`}
                placeholder="自定义标签，如：备用号"
                value={row.label}
                onChange={(e) => updateRow(row.key, { label: e.target.value })}
              />
            ) : (
              <select
                aria-label={`第 ${idx + 1} 条标签`}
                value={row.label}
                onChange={(e) => updateRow(row.key, { label: e.target.value })}
              >
                {labelPresets(row.type as Exclude<ContactMethodType, 'custom'>).map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
                {!labelPresets(row.type as Exclude<ContactMethodType, 'custom'>).includes(row.label) && row.label !== '' && (
                  <option value={row.label}>{row.label}</option>
                )}
              </select>
            )}

            <input
              className="text-input"
              aria-label={`第 ${idx + 1} 条内容`}
              placeholder={row.type === 'phone' ? '如：+86 138-0000-0000' : `填写${METHOD_TYPE_NAME[row.type]}内容`}
              value={row.value}
              onChange={(e) => updateRow(row.key, { value: e.target.value })}
            />

            <button
              type="button"
              className="del-row"
              aria-label={`删除第 ${idx + 1} 条联系方式`}
              onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))
      )}

      <div className="add-method-bar">
        {ALL_TYPES.map((t) => (
          <button key={t} type="button" className="add-row-btn" onClick={() => onChange([...rows, newRow(t)])}>
            + {METHOD_TYPE_NAME[t]}
          </button>
        ))}
      </div>
    </div>
  );
}
