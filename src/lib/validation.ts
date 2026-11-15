import type { ContactInput, ContactMethodType } from '@/types/contact';

/** 表单 / 导入共用的校验逻辑。返回 { 字段: 错误信息 }，空对象表示通过。 */

/** 基础邮箱校验：不过度限制合法形式，仅要求 非空@非空.非空 */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export const METHOD_TYPE_NAME: Record<ContactMethodType, string> = {
  phone: '电话',
  email: '邮箱',
  social: '社交账号',
  address: '地址',
  custom: '自定义',
};

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * 校验联系人入参。返回错误数组（空数组 = 通过）。
 * 规则：姓名去空格后非空；每条联系方式值非空；custom 类型标签非空；邮箱格式合法。
 */
export function validateContactInput(input: ContactInput): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!input.name || input.name.trim() === '') {
    errors.push({ field: 'name', message: '姓名不能为空' });
  }

  (input.methods ?? []).forEach((m, i) => {
    const pos = `第 ${i + 1} 条${METHOD_TYPE_NAME[m.type] ?? '联系方式'}`;
    if (!m.value || m.value.trim() === '') {
      errors.push({ field: `methods.${i}.value`, message: `${pos}的内容不能为空` });
    }
    if (m.type === 'custom' && (!m.label || m.label.trim() === '')) {
      errors.push({ field: `methods.${i}.label`, message: `${pos}的自定义标签不能为空` });
    }
    if (m.type === 'email' && m.value && m.value.trim() !== '' && !isValidEmail(m.value)) {
      errors.push({ field: `methods.${i}.value`, message: `${pos}的邮箱格式不正确` });
    }
  });

  return errors;
}

/** 校验分组名：去空格后非空 */
export function validateGroupName(name: string): string | null {
  if (!name || name.trim() === '') return '分组名称不能为空';
  return null;
}
