# v1.0.0 发布说明

发布日期：2026-11-15
分支：`main`
负责人：成员 B（应用外壳、Excel 导入导出、部署与交付）

## 新增功能

### 应用外壳与导航（B0）
- 统一顶部导航：联系人 / 收藏 / 导入导出。
- 增加页面容器、页脚、跳过导航链接与 404 页面。
- 所有页面支持直达 URL，刷新与浏览器前进后退正常。

### 公共 UI 与响应式（B1）
- 增加 `PageHeader`、`Modal`、`StatusBadge` 等公共组件。
- 统一卡片、提示、错误、空状态与统计样式。
- 360 / 768 / 1440 宽度下无横向溢出，弹窗与表格可滚动。

### Excel 导出（B2 / B3）
- 主表固定六列：姓名、电话、邮箱、地址、备注、是否收藏。
- 每位联系人一行，多值单元格自动换行。
- 电话列使用文本格式，保留 `+86`、前导零等原始字符。
- `ContactDetails` 明细表保存全部联系方式类型、标签、值与顺序。
- 文件名包含日期时间。

### Excel 导入（B4 / B5）
- 支持 `.xlsx`、`.xls`、UTF-8 CSV。
- 兼容中英文表头、First Name + Last Name、Google / Outlook 多电话多邮箱列。
- 收藏状态兼容 是/否、TRUE/FALSE、1/0、Y/N。
- 优先按 `ContactDetails` 无损回导，避免主表多值重复拼接。
- 导入前预览新增 / 强重复 / 疑似重复 / 错误数量。
- 强重复默认跳过；同名只标记疑似，不直接删除。
- 姓名缺失、非法邮箱、明细错误显示真实 Excel 行号，整行不写入。
- 批量写入失败如实报告，重复点击不会重复导入。

### 测试与 CI（B6 / B8）
- Vitest 覆盖导出、导入、表头别名、明细、去重、批量写入。
- Playwright 覆盖导入 → 列表 → 导出 → 回导、错误提示、`.xls` 前导零、响应式与 404。
- GitHub Actions 执行 Lint、单测、构建与 E2E。

### 云部署（B7）
- 线上演示：https://37jw5fqtq7n1oeaviuq.traesite.cn （静态托管；`/contacts/`、`/favorites/`、`/import-export/` 带尾斜杠访问）。
- 多阶段 `Dockerfile`。
- `deploy/nginx.conf` 提供 SPA 回退、静态缓存、gzip 与安全响应头。
- `docker-compose.yml` 一条命令启动，含健康检查。
- 部署步骤与验收清单见 `docs/deployment.md`。

## 验证命令

```bash
npm ci
npm run lint
npm run test
npm run build
npm run test:e2e
```

## 已知边界

- 导入文件上限 10 MB。
- CSV 仅保证 UTF-8 编码。
- 号码去重按规范化后的完整字符串比较，不自动把 `+86` 号码与本地号码视为同一号码。
- 数据保存在当前浏览器 IndexedDB，不跨设备同步。
