import type { ContactMethodType } from '@/types/contact';

/** 表单内编辑用的联系方式行（key 仅作 React key，入库时由仓储生成正式 id 与 order） */
export interface MethodRow {
  key: string;
  type: ContactMethodType;
  label: string;
  value: string;
}

const LABEL_PRESETS: Record<Exclude<ContactMethodType, 'custom'>, string[]> = {
  phone: ['手机', '公司', '住宅', '其他'],
  email: ['个人', '工作', '其他'],
  social: ['微信', 'QQ', '微博', 'LinkedIn', '其他'],
  address: ['家庭', '公司', '其他'],
};

export const ALL_TYPES: ContactMethodType[] = ['phone', 'email', 'social', 'address', 'custom'];

export function defaultLabel(type: ContactMethodType): string {
  return type === 'custom' ? '' : LABEL_PRESETS[type][0];
}

export function labelPresets(type: Exclude<ContactMethodType, 'custom'>): string[] {
  return LABEL_PRESETS[type];
}

export function newRow(type: ContactMethodType): MethodRow {
  return { key: crypto.randomUUID(), type, label: defaultLabel(type), value: '' };
}
