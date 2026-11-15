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
npm run test       # 单元测试（Vitest + fake-indexeddb，26 个用例）
npm run test:e2e   # 端到端测试（Playwright，完整工作流）
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
  hooks/useAddressBook.ts       订阅仓储变更的 React Hook（各视图自动同步）
  components/                   表单、列表、星标、弹窗、分组管理、Toast 等
  pages/                        联系人页 / 收藏页(/favorites) / 新建 / 编辑
tests/setup.ts                  测试初始化（fake-indexeddb + 每用例清库）
e2e/contact-workflow.spec.ts    完整工作流 E2E
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

## 当前边界

应用外壳 / 路由集成、Excel 导入导出、云部署由成员 B 负责（B0–B8），
本仓库当前为 A 模块完整可运行版本，外壳为最小开发外壳，供 B 替换扩展。
