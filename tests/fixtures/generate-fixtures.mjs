/**
 * 生成 E2E 使用的二进制 Excel fixtures。
 * 运行：node tests/fixtures/generate-fixtures.mjs
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx-js-style');
const here = dirname(fileURLToPath(import.meta.url));

function book(rows, sheetName = 'Contacts') {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), sheetName);
  return workbook;
}

// 1. 标准六列 .xlsx
const standard = book([
  ['姓名', '电话', '邮箱', '地址', '备注', '是否收藏'],
  ['许星河', '+8613800000011', 'xu@example.com', '南京市鼓楼区星河路 11 号', '标准 Excel 导入', '是'],
  ['温言', '010-55556666', 'wen@example.com', '成都市锦江区温言巷 2 号', '无收藏', '否'],
]);
writeFileSync(join(here, 'standard-six-columns.xlsx'), XLSX.write(standard, { bookType: 'xlsx', type: 'buffer' }));

// 2. 含 ContactDetails 的项目导出格式
const withDetails = book([
  ['姓名', '电话', '邮箱', '地址', '备注', '是否收藏'],
  ['林晚晴', '13800000001\n010-12345678', 'lin@example.com\nlin@work.example.com', '北京市朝阳区示例路 1 号', '大学同学', '是'],
  ['陈默', '', '', '', '没有联系方式也可以导出', '否'],
]);
const details = XLSX.utils.aoa_to_sheet([
  ['主表行号', '联系人ID', '姓名', '类型', '标签', '值', '顺序'],
  [2, 'fixture-c1', '林晚晴', '电话', '手机', '13800000001', 0],
  [2, 'fixture-c1', '林晚晴', '电话', '公司', '010-12345678', 1],
  [2, 'fixture-c1', '林晚晴', '邮箱', '个人', 'lin@example.com', 2],
  [2, 'fixture-c1', '林晚晴', '邮箱', '工作', 'lin@work.example.com', 3],
  [2, 'fixture-c1', '林晚晴', '社交账号', '微信', 'lin_wechat', 4],
  [2, 'fixture-c1', '林晚晴', '地址', '家庭', '北京市朝阳区示例路 1 号', 5],
  [2, 'fixture-c1', '林晚晴', '自定义', '备用号', '001234', 6],
]);
XLSX.utils.book_append_sheet(withDetails, details, 'ContactDetails');
writeFileSync(join(here, 'project-export-with-details.xlsx'), XLSX.write(withDetails, { bookType: 'xlsx', type: 'buffer' }));

// 3. 含前导零号码的 .xls（单元格按文本写入）
const xls = book([
  ['姓名', '电话', '邮箱', '地址', '备注', '是否收藏'],
  ['赵六', '001234', 'zhao@example.com', '', '前导零号码', '否'],
  ['钱七', '+86 138 0000 0000', 'qian@example.com', '', '+ 号号码', '是'],
]);
writeFileSync(join(here, 'leading-zero-phones.xls'), XLSX.write(xls, { bookType: 'xls', type: 'buffer' }));

console.log('fixtures generated');
