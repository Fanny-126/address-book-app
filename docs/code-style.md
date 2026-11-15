# 代码风格与协作规范

本项目为 EE308FZ 软件工程结对作业，成员 A 负责联系人数据层与核心 CRUD，成员 B 负责应用外壳、Excel 导入导出与部署。本文档是双方共同遵守的代码与协作约定。

## 1. 技术栈与目录

- React 19 + TypeScript 5 + Vite 7
- Dexie / IndexedDB 持久化
- React Router 7 客户端路由
- Vitest 单元测试 + Playwright E2E
- Excel 解析与生成：`xlsx-js-style`

目录职责：

```
src/types/          冻结的数据类型与仓储接口（A0）
src/db/             IndexedDB 定义（A）
src/repository/     仓储实现（A）
src/lib/            校验、搜索、Excel 导入导出纯逻辑（A + B）
src/components/     可复用 UI 与业务组件
src/pages/          路由页面
e2e/                端到端测试与 fixtures
deploy/             Nginx 与容器部署配置
```

## 2. TypeScript

- 开启 `strict`，不使用 `any` 绕过类型检查；必要时使用 `unknown` 并在边界处收窄。
- 只读数据使用 `interface`，联合类型使用字符串字面量联合，不使用 `enum`。
- 导入类型时使用 `import type`，保持 `verbatimModuleSyntax` 兼容。
- 纯函数优先放在 `src/lib/`，便于单元测试；组件只负责展示与交互。
- 所有用户文本在写入 Excel 时使用字符串单元格（`t: 's'`），防止被当作公式执行。

## 3. 命名与格式

- 组件、页面、类型：`PascalCase`；函数、变量、Hook：`camelCase`。
- 常量：`UPPER_SNAKE_CASE`。
- 文件：组件 `PascalCase.tsx`，纯逻辑 `camelCase.ts`，测试 `*.test.ts`。
- 2 空格缩进、单引号、语句末尾分号；格式以现有 ESLint 配置为准。
- 单个函数保持单一职责；复杂分支提取为有名字的辅助函数。
- 注释只解释「为什么」，不复述代码；业务规则注明任务编号（如 B5）。

## 4. React 与可访问性

- 页面组件只组合 Hook 与展示组件，不直接访问 IndexedDB。
- 数据变更统一通过 `ContactRepository`，写操作后由 `subscribe` 通知刷新。
- 所有输入框必须有可被读屏识别的 `label` 或 `aria-label`。
- 图标按钮必须提供 `aria-label`；弹窗使用 `role="dialog"`、`aria-modal` 与 `aria-labelledby`。
- 弹窗支持 Escape 关闭，打开后焦点落在关闭按钮。
- 列表项支持键盘 Enter / Space 操作。
- 组件卸载后不继续更新状态；异步操作考虑竞态与重复点击。

## 5. 错误处理与数据安全

- 导入文件先完整解析、校验、预览，用户确认后才调用 `bulkCreate`。
- 批量写入依赖仓储的单事务语义；失败时如实报告，不显示「成功」。
- 行级错误必须带真实 Excel 行号；不能静默丢弃数据。
- 不在日志、提交信息或文档中写入真实个人通讯录数据。
- 导出/导入全部在浏览器本地完成，不上传服务器。

## 6. 测试要求

- 新增纯逻辑必须补 Vitest 单元测试，覆盖正常路径、边界与错误路径。
- 新增页面或跨模块流程必须补 Playwright E2E。
- 测试数据使用 `tests/fixtures/` 中的静态文件，不依赖本机 Excel。
- 提交前依次执行：

```bash
npm run lint
npm run test
npm run build
npm run test:e2e
```

## 7. 分支与提交

- `main` 保持可构建、可部署；功能开发在 `feature/<task-id>-<short-name>` 分支进行。
- 提交信息格式：

```
<type>(<task-id>): <summary>

<body: 变更点、验证方式>
```

示例：

```
feat(B2): 实现标准六列 Excel 导出与 ContactDetails 明细表

- 主表固定六列，多值单元格换行
- 电话列使用文本格式，保留 + 与前导零
- 补充导出单元测试
```

- 一个提交只做一件事；避免把格式化与功能混在一起。
- 不提交 `node_modules/`、`dist/`、`test-results/`、`playwright-report/`。

## 8. PR 规范

- PR 标题包含任务编号，例如 `feat(B0-B5): 应用外壳与 Excel 导入导出`。
- PR 描述包含：背景、变更点、测试证据、验收标准对照、部署说明。
- 至少一位队友 Review；Review 关注正确性、边界、可访问性、测试覆盖。
- CI 必须全部通过后才能合并；禁止跳过 hook 或强制推送 `main`。
