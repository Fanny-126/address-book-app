import { describe, it, expect } from 'vitest';
import { validateContactInput, validateGroupName, isValidEmail } from '@/lib/validation';

describe('校验工具', () => {
  it('邮箱格式校验：接受常见合法形式，拒绝明显非法', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('a+b.tag@example-mail.com')).toBe(true);
    expect(isValidEmail('no-at.com')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidEmail('a b@c.com')).toBe(false);
  });

  it('姓名必填（去空格后）', () => {
    expect(validateContactInput({ name: '' })[0].field).toBe('name');
    expect(validateContactInput({ name: '   ' })[0].field).toBe('name');
    expect(validateContactInput({ name: '张三' })).toEqual([]);
  });

  it('自定义类型标签必填，并指出具体条目位置', () => {
    const errors = validateContactInput({
      name: 'A',
      methods: [
        { type: 'phone', label: '手机', value: '138' },
        { type: 'custom', label: '', value: 'xxx' },
      ],
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('methods.1.label');
    expect(errors[0].message).toContain('第 2 条');
  });

  it('分组名：空名拒绝，含空格的名字允许（保存时修剪）', () => {
    expect(validateGroupName('')).toBeTruthy();
    expect(validateGroupName('  ')).toBeTruthy();
    expect(validateGroupName(' 同事 ')).toBeNull();
  });
});
