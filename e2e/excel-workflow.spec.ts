import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import * as XLSXNamespace from 'xlsx-js-style';

// xlsx-js-style 是 CommonJS 包，不同运行器下需要兼容 default 导出
const XLSX =
  (XLSXNamespace as unknown as { default?: typeof XLSXNamespace }).default ?? XLSXNamespace;

const FIXTURES = join(process.cwd(), 'tests', 'fixtures');
const fixture = (name: string) => join(FIXTURES, name);

async function upload(page: Page, name: string) {
  await page.getByLabel('选择要导入的通讯录文件').setInputFiles(fixture(name));
  await expect(page.getByRole('dialog', { name: '导入预览' })).toBeVisible();
}

/** B6：Excel 导入导出完整 E2E，覆盖真实下载、回导校验、错误提示和响应式 */
test.describe('Excel 导入导出工作流', () => {
  test('导入标准 Excel → 列表可见 → 导出六列 → 重复导入被拦截', async ({ page }) => {
    await page.goto('/import-export');
    await expect(page.getByRole('heading', { name: '导入与导出' })).toBeVisible();

    await upload(page, 'standard-six-columns.xlsx');
    const dialog = page.getByRole('dialog', { name: '导入预览' });
    await expect(dialog.getByText('新增 2', { exact: true })).toBeVisible();
    await expect(dialog.getByText('强重复 0', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: '确认导入 2 位联系人' }).click();

    await expect(page.getByText('导入完成：新增 2 位联系人')).toBeVisible();
    await expect(page.getByRole('dialog', { name: '导入预览' })).toHaveCount(0);

    await page.getByRole('link', { name: '联系人' }).click();
    await expect(page.getByRole('button', { name: '编辑联系人许星河' })).toBeVisible();
    await expect(page.getByRole('button', { name: '编辑联系人温言' })).toBeVisible();

    await page.getByRole('link', { name: '导入导出' }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /导出 Excel（2）/ }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^contacts_\d{8}_\d{6}\.xlsx$/);

    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    const workbook = XLSX.read(readFileSync(filePath as string), { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets.Contacts, {
      header: 1,
      defval: '',
    });
    expect(rows[0]).toEqual(['姓名', '电话', '邮箱', '地址', '备注', '是否收藏']);
    expect(rows).toHaveLength(3);
    expect(rows[1][0]).toBe('许星河');
    expect(rows[1][1]).toBe('+8613800000011');
    expect(rows[1][5]).toBe('是');
    expect(rows[2][5]).toBe('否');
    expect(workbook.SheetNames).toContain('ContactDetails');

    // 同一份文件再次导入：全部识别为强重复，确认按钮禁用
    await page.getByLabel('选择要导入的通讯录文件').setInputFiles({
      name: download.suggestedFilename(),
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: readFileSync(filePath as string),
    });
    const repeatDialog = page.getByRole('dialog', { name: '导入预览' });
    await expect(repeatDialog.getByText('新增 0', { exact: true })).toBeVisible();
    await expect(repeatDialog.getByText('强重复 2', { exact: true })).toBeVisible();
    await expect(repeatDialog.getByRole('button', { name: '确认导入 0 位联系人' })).toBeDisabled();
    await repeatDialog.getByRole('button', { name: '取消' }).click();
    await expect(page.getByRole('dialog', { name: '导入预览' })).toHaveCount(0);

    await page.getByRole('link', { name: '联系人' }).click();
    await expect(page.getByRole('button', { name: /^编辑联系人/ })).toHaveCount(2);
  });

  test('Google CSV 多电话多邮箱与收藏状态完整导入', async ({ page }) => {
    await page.goto('/import-export');
    await upload(page, 'google-contacts.csv');
    const dialog = page.getByRole('dialog', { name: '导入预览' });
    await expect(dialog.getByText('新增 2', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: '确认导入 2 位联系人' }).click();

    await page.getByRole('link', { name: '联系人' }).click();
    await page.getByLabel('搜索联系人').fill('顾清和');
    await expect(page.getByText('找到 1 位联系人')).toBeVisible();
    await page.getByRole('button', { name: '编辑联系人顾清和' }).click();

    await expect(page.getByLabel('第 1 条内容')).toHaveValue('+8613900000001');
    await expect(page.getByLabel('第 2 条内容')).toHaveValue('010-88886666');
    await expect(page.getByLabel('第 3 条内容')).toHaveValue('gu@example.com');
    await expect(page.getByLabel('第 4 条内容')).toHaveValue('gu@work.example.com');
    await expect(page.getByLabel('第 5 条内容')).toHaveValue('北京市海淀区书山路 8 号');
    await expect(page.getByLabel('备注')).toHaveValue('高中同学');
    await expect(page.getByRole('button', { name: '已收藏' })).toBeVisible();

    await page.getByRole('link', { name: '收藏' }).click();
    await expect(page.getByRole('button', { name: '编辑联系人顾清和' })).toBeVisible();
  });

  test('行级错误可见、错误行不写入，损坏文件给出友好提示', async ({ page }) => {
    await page.goto('/import-export');
    await upload(page, 'invalid-rows.csv');
    const dialog = page.getByRole('dialog', { name: '导入预览' });
    await expect(dialog.getByText('新增 1', { exact: true })).toBeVisible();
    await expect(dialog.getByText('错误 2', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('alert')).toContainText('第 2 行缺少姓名');
    await expect(dialog.getByRole('alert')).toContainText('第 3 行');
    await dialog.getByRole('button', { name: '确认导入 1 位联系人' }).click();

    await page.getByRole('link', { name: '联系人' }).click();
    await expect(page.getByRole('button', { name: '编辑联系人白' })).toBeVisible();
    await expect(page.getByRole('button', { name: '编辑联系人陆' })).toHaveCount(0);

    await page.getByRole('link', { name: '导入导出' }).click();
    await page.getByLabel('选择要导入的通讯录文件').setInputFiles(fixture('corrupt.xlsx'));
    await expect(page.getByRole('alert').first()).toContainText(/无法解析|未找到联系人表头/);
    await expect(page.getByRole('dialog', { name: '导入预览' })).toHaveCount(0);

    await page.getByRole('link', { name: '联系人' }).click();
    await expect(page.getByRole('button', { name: /^编辑联系人/ })).toHaveCount(1);
  });

  test('ContactDetails 明细无损回导 + .xls 前导零号码保留', async ({ page }) => {
    await page.goto('/import-export');
    await upload(page, 'project-export-with-details.xlsx');
    const dialog = page.getByRole('dialog', { name: '导入预览' });
    await expect(dialog.getByText('已识别 ContactDetails 明细表', { exact: false })).toBeVisible();
    await expect(dialog.getByText('新增 2', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: '确认导入 2 位联系人' }).click();

    await page.getByRole('link', { name: '联系人' }).click();
    await page.getByRole('button', { name: '编辑联系人林晚晴' }).click();
    await expect(page.getByLabel('第 1 条内容')).toHaveValue('13800000001');
    await expect(page.getByLabel('第 2 条内容')).toHaveValue('010-12345678');
    await expect(page.getByLabel('第 3 条内容')).toHaveValue('lin@example.com');
    await expect(page.getByLabel('第 4 条内容')).toHaveValue('lin@work.example.com');
    await expect(page.getByLabel('第 5 条内容')).toHaveValue('lin_wechat');
    await expect(page.getByLabel('第 6 条内容')).toHaveValue('北京市朝阳区示例路 1 号');
    await expect(page.getByLabel('第 7 条内容')).toHaveValue('001234');
    await expect(page.getByLabel('第 7 条自定义标签')).toHaveValue('备用号');

    await page.getByRole('link', { name: '导入导出' }).click();
    await upload(page, 'leading-zero-phones.xls');
    await expect(
      page.getByRole('dialog', { name: '导入预览' }).getByText('新增 2', { exact: true }),
    ).toBeVisible();
    await page.getByRole('dialog', { name: '导入预览' }).getByRole('button', { name: '确认导入 2 位联系人' }).click();

    await page.getByRole('link', { name: '联系人' }).click();
    await page.getByRole('button', { name: '编辑联系人赵六' }).click();
    await expect(page.getByLabel('第 1 条内容')).toHaveValue('001234');
    await expect(page.getByLabel('第 2 条内容')).toHaveValue('zhao@example.com');

    await page.getByRole('link', { name: '联系人' }).click();
    await page.getByRole('button', { name: '编辑联系人钱七' }).click();
    await expect(page.getByLabel('第 1 条内容')).toHaveValue('+86 138 0000 0000');
  });

  test('360 / 768 / 1440 宽度无横向溢出，直达路由与 404 可用', async ({ page }) => {
    for (const width of [360, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/import-export');
      await expect(page.getByRole('heading', { name: '导入与导出' })).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${width}px 页面不应横向溢出`).toBeLessThanOrEqual(0);
      await expect(page.getByRole('link', { name: '导入导出' })).toBeVisible();
    }

    await page.setViewportSize({ width: 360, height: 900 });
    await upload(page, 'standard-six-columns.xlsx');
    await expect(page.getByRole('dialog', { name: '导入预览' })).toBeVisible();
    const modalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(modalOverflow).toBeLessThanOrEqual(0);
    await page.getByRole('dialog', { name: '导入预览' }).getByRole('button', { name: '取消' }).click();

    await page.goto('/favorites');
    await expect(page.getByRole('heading', { name: /已收藏/ })).toBeVisible();

    await page.goto('/not-exist');
    await expect(page.getByText('页面不存在')).toBeVisible();
    await page.getByRole('link', { name: '返回联系人首页' }).click();
    await expect(page).toHaveURL(/\/contacts$/);
  });
});
