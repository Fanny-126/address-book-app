import { test, expect } from '@playwright/test';

/**
 * A 模块完整 E2E（A7）：
 * 新建多联系方式联系人 → 收藏 → 搜索 → 加入分组 → 编辑 → 刷新验证 → 删除
 * 每个用例使用唯一姓名，测试结束前删除自身数据，互不依赖。
 */

const NAME = `E2E测试联系人`;

test.describe('联系人完整工作流', () => {
  test('新建多联系方式 → 收藏 → 搜索 → 分组 → 编辑 → 刷新 → 删除', async ({ page }) => {
    // ---------- 1. 新建多联系方式联系人 ----------
    await page.goto('/contacts');
    await page.getByRole('link', { name: '＋ 新建联系人' }).click();

    await page.getByLabel(/姓名/).fill(NAME);
    // 默认一行电话
    await page.getByLabel('第 1 条内容').fill('+8613800000000');
    // 再加一行电话
    await page.getByRole('button', { name: '+ 电话' }).click();
    await page.getByLabel('第 2 条内容').fill('010-12345678');
    // 加一行邮箱
    await page.getByRole('button', { name: '+ 邮箱' }).click();
    await page.getByLabel('第 3 条内容').fill('e2e@example.com');
    // 加一行自定义
    await page.getByRole('button', { name: '+ 自定义' }).click();
    await page.getByLabel('第 4 条自定义标签').fill('备用号');
    await page.getByLabel('第 4 条内容').fill('001234');
    // 设为收藏
    await page.getByRole('button', { name: '设为收藏' }).click();
    await page.getByRole('button', { name: '保存联系人' }).click();

    // 回到列表并可见
    await expect(page).toHaveURL(/\/contacts$/);
    await expect(page.getByRole('button', { name: `编辑联系人${NAME}` })).toBeVisible();

    // ---------- 2. 收藏出现在 /favorites ----------
    await page.getByRole('link', { name: '收藏' }).click();
    await expect(page).toHaveURL(/\/favorites$/);
    await expect(page.getByRole('button', { name: `编辑联系人${NAME}` })).toBeVisible();
    await expect(page.getByRole('button', { name: `取消收藏${NAME}` })).toBeVisible();

    // ---------- 3. 搜索 ----------
    await page.getByRole('link', { name: '联系人' }).click();
    await page.getByLabel('搜索联系人').fill('13800000000');
    await expect(page.getByText('找到 1 位联系人')).toBeVisible();
    await expect(page.getByRole('button', { name: `编辑联系人${NAME}` })).toBeVisible();
    // 清空搜索恢复
    await page.getByLabel('清空搜索').click();
    // 只存在于备注/社交账号的关键词（此处搜自定义标签）
    await page.getByLabel('搜索联系人').fill('备用号');
    await expect(page.getByRole('button', { name: `编辑联系人${NAME}` })).toBeVisible();
    await page.getByLabel('清空搜索').click();

    // ---------- 4. 加入分组 ----------
    await page.getByRole('button', { name: '管理分组' }).click();
    await page.getByLabel('新分组名称').fill('E2E分组');
    await page.getByRole('button', { name: '新建', exact: true }).click();
    await expect(page.getByRole('dialog').getByText('E2E分组（0 人）')).toBeVisible();
    await page.getByRole('button', { name: '完成' }).click();

    await page.getByRole('button', { name: `编辑联系人${NAME}` }).click();
    await page.getByRole('checkbox', { name: 'E2E分组' }).check();
    await page.getByRole('button', { name: '保存修改' }).click();

    // 分组筛选命中
    await page.getByLabel('按分组筛选').selectOption({ label: 'E2E分组（1）' });
    await expect(page.getByRole('button', { name: `编辑联系人${NAME}` })).toBeVisible();
    await page.getByLabel('按分组筛选').selectOption('');

    // ---------- 5. 编辑（修改备注） ----------
    await page.getByRole('button', { name: `编辑联系人${NAME}` }).click();
    await page.getByLabel('备注').fill('E2E 备注已编辑');
    await page.getByRole('button', { name: '保存修改' }).click();
    await expect(page).toHaveURL(/\/contacts$/);

    // ---------- 6. 刷新验证持久化 ----------
    await page.reload();
    await page.getByRole('button', { name: `编辑联系人${NAME}` }).click();
    await expect(page.getByLabel('备注')).toHaveValue('E2E 备注已编辑');
    await expect(page.getByLabel('第 1 条内容')).toHaveValue('+8613800000000');
    await expect(page.getByLabel('第 2 条内容')).toHaveValue('010-12345678');
    await expect(page.getByLabel('第 3 条内容')).toHaveValue('e2e@example.com');
    await expect(page.getByLabel('第 4 条内容')).toHaveValue('001234');
    await expect(page.getByLabel('第 4 条自定义标签')).toHaveValue('备用号');
    // 收藏与分组关系也保持
    await expect(page.getByRole('button', { name: '已收藏' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'E2E分组' })).toBeChecked();

    // ---------- 7. 删除（二次确认），清理测试数据 ----------
    await page.getByRole('button', { name: '删除联系人' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: '确认删除' }).click();
    await expect(page).toHaveURL(/\/contacts$/);
    await expect(page.getByRole('button', { name: `编辑联系人${NAME}` })).toHaveCount(0);

    // 清理分组
    await page.getByRole('button', { name: '管理分组' }).click();
    await page.getByRole('button', { name: '删除分组E2E分组' }).click();
    await page.getByRole('button', { name: '确认删除' }).click();
    await page.getByRole('button', { name: '完成' }).click();
  });
});
