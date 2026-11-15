# 云服务器部署与验收

本项目是纯前端 SPA，构建产物为 `dist/`，由 Nginx 静态托管。生产环境使用 Docker 多阶段构建，运行阶段只包含 Nginx 与静态文件。

## 1. 部署架构

```
浏览器
  │  HTTP :80
  ▼
Nginx（Docker 容器 address-book）
  ├── /assets/*        带哈希的静态资源，长缓存
  ├── /healthz         健康检查，返回 ok
  └── 其他路径         try_files → /index.html（SPA 回退）
        │
        └── dist/      由 Node 22 构建阶段生成
```

所有联系人数据保存在浏览器 IndexedDB，服务器不保存用户数据。

## 2. 服务器要求

- 一台可公网访问的云服务器（华为云 / 阿里云 / 腾讯云等均可），推荐 Ubuntu 22.04 LTS。
- 安全组放行 `80/tcp`（HTTPS 可后续加 `443/tcp`）。
- 已安装 Docker 24+ 与 Docker Compose v2。

```bash
# Ubuntu 安装 Docker（示例）
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2
sudo systemctl enable --now docker
docker --version
docker compose version
```

## 3. 一键部署

```bash
git clone https://github.com/Fanny-126/address-book-app.git
cd address-book-app

# 构建并后台启动
sudo docker compose up -d --build

# 查看状态与日志
sudo docker compose ps
sudo docker compose logs --tail=100
```

部署完成后访问：

- 首页：`http://<服务器公网IP>/`
- 导入导出：`http://<服务器公网IP>/import-export`
- 健康检查：`http://<服务器公网IP>/healthz`（应返回 `ok`）

## 4. 部署验收清单

逐项在浏览器验证：

- [ ] `http://<公网IP>/` 自动跳转到 `/contacts`，页面正常渲染。
- [ ] 直接访问 `/favorites`、`/import-export` 不出现 404（Nginx SPA 回退生效）。
- [ ] 刷新任意深层路由仍能正常打开。
- [ ] 新建联系人并刷新页面，数据仍在（IndexedDB 持久化）。
- [ ] 导出 Excel 能真实下载 `.xlsx` 文件，六列表头正确。
- [ ] 重新选择导出的文件，预览显示全部为强重复，不会重复新增。
- [ ] 浏览器控制台无报错。
- [ ] `curl http://<公网IP>/healthz` 返回 `ok`。

## 5. 更新与回滚

```bash
# 拉取最新 main 并重建
git pull origin main
sudo docker compose up -d --build

# 回滚到指定提交
git checkout <commit-sha>
sudo docker compose up -d --build
```

## 6. CI

`.github/workflows/ci.yml` 在每次 push / PR 时执行：

1. `npm ci`
2. `npm run lint`
3. `npm run test`
4. `npm run build`
5. `npm run test:e2e`（Playwright Chromium）

E2E 失败时上传 `playwright-report/` 作为排查证据。

## 7. 常见问题

| 现象 | 排查 |
| --- | --- |
| 访问 IP 超时 | 检查云服务器安全组是否放行 80 端口 |
| 深层路由 404 | 确认容器内使用的是 `deploy/nginx.conf`，包含 `try_files ... /index.html` |
| 页面空白 | 查看 `docker compose logs`，确认 `dist/index.html` 已复制 |
| 静态资源 404 | 确认 `base: './'` 构建产物与 Nginx `root` 一致 |
| 健康检查失败 | 容器内执行 `wget -qO- http://127.0.0.1/healthz` |
| 端口被占用 | `sudo lsof -i:80` 或修改 compose 的端口映射 |

## 8. 部署记录

| 项目 | 值 |
| --- | --- |
| 公网访问地址 | 待部署后填写 |
| 云服务器 | 待填写（地域 / 规格 / 系统） |
| 部署提交 | 待填写（`git rev-parse HEAD`） |
| 部署时间 | 待填写 |
| 验收人 | 待填写 |
| 验收结果 | 待填写 |

> 部署记录必须在验收前更新为真实值，不接受占位符或本地地址。
