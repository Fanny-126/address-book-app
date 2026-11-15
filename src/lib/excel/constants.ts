import type { ContactMethodType } from '@/types/contact';

/** 主工作表名称与固定六列表头（B2：顺序不可改变） */
export const MAIN_SHEET_NAME = 'Contacts';
export const DETAILS_SHEET_NAME = 'ContactDetails';

export const MAIN_HEADERS = ['姓名', '电话', '邮箱', '地址', '备注', '是否收藏'] as const;

/** 明细工作表表头（B3：支撑多类型联系方式无损回导） */
export const DETAILS_HEADERS = ['主表行号', '联系人ID', '姓名', '类型', '标签', '值', '顺序'] as const;

export const METHOD_TYPE_LABEL: Record<ContactMethodType, string> = {
  phone: '电话',
  email: '邮箱',
  social: '社交账号',
  address: '地址',
  custom: '自定义',
};

const LABEL_TO_TYPE: Record<string, ContactMethodType> = {
  电话: 'phone',
  手机: 'phone',
  邮箱: 'email',
  邮件: 'email',
  社交账号: 'social',
  社交: 'social',
  地址: 'address',
  自定义: 'custom',
  phone: 'phone',
  email: 'email',
  social: 'social',
  address: 'address',
  custom: 'custom',
};

/** 明细表「类型」列既支持中文也支持内部英文值 */
export function parseMethodType(value: string): ContactMethodType | null {
  const key = value.trim();
  if (key === '') return null;
  return LABEL_TO_TYPE[key] ?? LABEL_TO_TYPE[key.toLowerCase()] ?? null;
}

/** 受支持的收藏值（B4：是/否、TRUE/FALSE、1/0、Y/N） */
export function parseFavoriteValue(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const text = String(value ?? '')
    .trim()
    .toLowerCase();
  if (['是', 'y', 'yes', 'true', '1', '已收藏', '收藏'].includes(text)) return true;
  return false;
}

/** 判断收藏单元格是否是可识别的值（用于给出警告） */
export function isRecognizedFavoriteValue(value: unknown): boolean {
  if (value === '' || value === null || value === undefined) return true;
  if (typeof value === 'boolean' || typeof value === 'number') return true;
  const text = String(value).trim().toLowerCase();
  return ['是', '否', 'y', 'n', 'yes', 'no', 'true', 'false', '1', '0', '已收藏', '未收藏', '收藏'].includes(text);
}
