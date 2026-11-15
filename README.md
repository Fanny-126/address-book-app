# 拾光通讯录（Address Book）

EE308FZ 软件工程 · 极限编程结对作业。React + TypeScript 单页应用。

## 环境要求

- Node.js ≥ 18（建议 20+）
- npm ≥ 9

## 安装与运行

```bash
npm install        # 安装依赖
npm run dev        # 开发模式，访问 http://localhost:3000
```

## 测试

```bash
npm run test       # 单元测试（Vitest + fake-indexeddb，52 个用例）
npm run test:e2e   # 端到端测试（Playwright，6 条工作流）
```

E2E 首次运行前需要安装浏览器：

```bash
npx playwright install chromium
```

> 本机已有 Chromium/Chrome 时可跳过下载，改用
> `CHROMIUM_PATH=/path/to/chromium npm run test:e2e`（Windows 示例：
> `set CHROMIUM_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe && npm run test:e2e`）。

## 构建

```bash
npm run build      # 类型检查 + 产物输出到 dist/
npm run preview    # 本地预览构建产物
```

## 目录结构

```
src/
  types/contact.ts              Contact / ContactMethod / Group 类型 + ContactRepository 接口（A0，已冻结）
  db/database.ts                Dexie(IndexedDB) 数据库定义
  repository/contactRepository.ts  ContactRepository 的 IndexedDB 实现（含事务与变更通知）
  lib/validation.ts             姓名 / 邮箱 / 自定义标签 / 分组名校验
  lib/search.ts                 搜索与「搜索 + 分组」组合筛选
  lib/excel/                    标准 Excel 导出、导入解析、表头别名、去重与预览
  hooks/useAddressBook.ts       订阅仓储变更的 React Hook（各视图自动同步）
  components/                   表单、列表、星标、弹窗、分组管理、Toast、公共 UI
  pages/                        联系人 / 收藏 / 新建 / 编辑 / 导入导出
tests/setup.ts                  测试初始化（fake-indexeddb + 每用例清库）
tests/fixtures/                 Excel / CSV 测试文件与生成脚本
e2e/contact-workflow.spec.ts    A 模块完整工作流 E2E
e2e/excel-workflow.spec.ts      B 模块 Excel 导入导出 E2E
deploy/nginx.conf               SPA 回退、缓存、gzip 与安全响应头
docs/                           代码规范、部署说明、发布说明
Dockerfile / docker-compose.yml 云服务器部署
```

## 数据结构设计

```ts
Contact {
  id: string              // UUID
  name: string            // 必填，保存时去除首尾空格
  isFavorite: boolean     // 收藏标识
  groupIds: string[]      // 可属于多个分组
  methods: ContactMethod[]// 动态数组，条数不限，保持录入顺序
  note: string
  createdAt: string       // 创建后不变
  updatedAt: string       // 每次成功更新刷新
}

ContactMethod {
  id: string              // 每条联系方式独立 UUID
  type: 'phone' | 'email' | 'social' | 'address' | 'custom'
  label: string           // 类型标签；custom 为用户自定义标签（必填）
  value: string           // 原始字符串，电话保留 +、前导零、空格、分机
  order: number           // 录入顺序，供 Excel 明细导出使用
}

Group { id: string; name: string; createdAt: string }
```

## 关键实现说明

### 持久化（A1）
使用 Dexie 封装 IndexedDB。联系人与分组两张表，主键均为 UUID。
**空库首次打开不写入任何演示数据**，直接显示空状态。所有写操作通过
`ContactRepository` 接口进行，UI 不直接访问数据库。

### 与成员 B 的接口约定（A0）
- B 的 Excel 导入调用 `bulkCreate(contacts)`：先整批内存校验，再单事务写入，
  任一失败整批回滚，不产生部分脏数据；
- B 的 Excel 导出通过 `list()` 读取；联系方式顺序以 `methods[].order` 为准；
- 所有写操作完成后触发 `subscribe` 通知，页面自动刷新，B 无需手动刷新视图。

### 收藏（A4）
星标按钮直接调用 `update(id, { isFavorite })` 一键切换，不进入编辑页；
`/favorites` 路由只渲染 `isFavorite === true` 的联系人；
星标带 `aria-label="收藏张三 / 取消收藏张三"`。

### 多种联系方式（A3）
五类（电话/邮箱/社交/地址/自定义），表单中可连续添加任意条；
`custom` 类型显示自定义标签输入框，标签为空拒绝保存并指出具体条目；
邮箱做基础格式校验；电话按字符串原样保存。

### 搜索（A5）
检索范围：姓名、备注、所有联系方式的标签与内容；
关键词去首尾空格、英文不区分大小写；提供清空按钮与无结果状态；
与分组筛选取交集；CRUD 后经订阅通知自动刷新结果。

### 分组（A6）
分组可新建/重命名/删除，名称去空格、禁空、禁重名；
删除分组仅清理联系人上的 `groupId`，**不删除联系人**；
筛选器显示各分组人数；分组与搜索可组合。

### 测试（A7）
- 单元测试 26 例：仓储 CRUD、持久化（重建仓储实例模拟重开浏览器）、
  校验、批量事务回滚、收藏切换、分组删除清理、搜索与组合筛选；
- E2E 1 条完整工作流：新建多联系方式 → 收藏 → 搜索 → 分组 → 编辑 →
  刷新验证 → 删除（测试结束清理自身数据）。

### 应用外壳与公共 UI（B0 / B1）
- 顶部导航统一为联系人、收藏、导入导出，支持激活态与键盘操作；
- 所有路由可直达、刷新和浏览器前进后退；未知地址显示 404 与返回首页入口；
- 新增 `PageHeader`、`Modal`、`StatusBadge` 公共组件；
- 360 / 768 / 1440 宽度下无页面横向溢出，长姓名、邮箱、地址自动换行或截断。

### Excel 导出（B2 / B3）
- `Contacts` 主表固定六列「姓名、电话、邮箱、地址、备注、是否收藏」，
  一位联系人只占一行，多条同类型联系方式在单元格内换行；
- 电话列使用文本格式 `@`，保留 `+86`、`001234` 等原始字符；
- 所有用户文本以字符串单元格写入，不会触发 Excel 公式；
- `ContactDetails` 明细表保存全部联系方式（主表行号、联系人 ID、姓名、类型、标签、值、顺序），
  支撑多社交账号、自定义标签等主表无法表达的数据无损回导；
- 空通讯录也能导出仅含表头的文件，文件名形如 `contacts_20261115_203000.xlsx`。

### Excel 导入（B4 / B5）
- 支持 `.xlsx`、`.xls`、UTF-8 CSV，单文件上限 10 MB；
- 表头兼容：姓名 / Name / Full Name、First Name + Last Name、电话 / Phone / Mobile、
  邮箱 / E-mail、地址 / Address、备注 / Notes、是否收藏 / Favorite 等；
- 兼容 Google Contacts 的 `Phone 1 - Value`、`E-mail 1 - Value`、`Address 1 - Formatted`
  与 Outlook 的多电话多邮箱列；
- 收藏值兼容 是/否、TRUE/FALSE、1/0、Y/N；
- 有 `ContactDetails` 时优先按明细恢复，避免与主表多值单元格重复拼接；
- 导入前预览新增 / 强重复 / 疑似重复 / 错误数量，用户确认后才单事务写入；
- 规范化电话或邮箱相同为强重复，默认跳过；只有姓名相同标记疑似重复，不直接删除；
- 姓名缺失、非法邮箱、明细格式错误显示真实 Excel 行号并整行跳过；
- 重复点击确认按钮不会重复导入，批量写入失败会如实报告。

```ts
// 浏览器本地解析，不上传服务器
const preview = await previewImportFile(file, repository); // 只读
const result = await commitImport(preview, { skipSuspected: false }, repository);
```

### 测试（B6）
- 单元测试新增 26 例：六列导出、明细表、公式安全、表头别名、收藏别名、
  `.xls` 前导零、CSV、行级错误、去重、预览只读、批量失败；
- E2E 新增 5 条：标准 Excel 导入→导出→重复拦截、Google CSV 多联系方式、
  错误行与损坏文件、ContactDetails 无损回导、响应式与 404；
- 测试 fixtures 位于 `tests/fixtures/`，二进制文件由
  `node tests/fixtures/generate-fixtures.mjs` 可重复生成。

### 部署与 CI（B7 / B8）
- 多阶段 Docker 构建，运行阶段仅 Nginx + 静态文件；
- `deploy/nginx.conf` 提供 SPA 回退、静态资源长缓存、gzip 与安全响应头；
- `docker compose up -d --build` 一条命令部署，`/healthz` 健康检查；
- GitHub Actions 执行 Lint、单测、构建和 Playwright E2E；
- 详细步骤见 [部署说明](docs/deployment.md)，协作规范见 [代码风格](docs/code-style.md)，
  版本内容见 [v1.0.0 发布说明](docs/release-v1.0.0.md)。

## 当前边界

- 成员 A：联系人 / 收藏 / 分组 / 数据层模块完成，26 项单元测试 + 1 项 E2E 通过。
- 成员 B：应用外壳、响应式 UI、Excel 导入导出、测试、部署与 CI 完成
  （B0–B8），共 52 项单元测试 + 6 条 E2E 通过。
- 导入文件上限 10 MB；CSV 仅保证 UTF-8；号码按规范化完整字符串比较，
  不自动把 `+86` 与本地号码视为同一号码；数据保存在当前浏览器 IndexedDB。
