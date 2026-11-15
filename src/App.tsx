import { lazy, Suspense } from 'react';
import { Link, Navigate, NavLink, Route, Routes } from 'react-router';
import { ToastProvider } from '@/components/Toast';
import { ContactsPage } from '@/pages/ContactsPage';
import { FavoritesPage } from '@/pages/FavoritesPage';
import { ContactNewPage } from '@/pages/ContactNewPage';
import { ContactEditPage } from '@/pages/ContactEditPage';
import { EmptyState } from '@/components/ui';

// Excel 解析库较大，按路由懒加载，保证联系人页首屏体积稳定
const ImportExportPage = lazy(() =>
  import('@/pages/ImportExportPage').then((module) => ({ default: module.ImportExportPage })),
);

const NAV_ITEMS = [
  { to: '/contacts', label: '联系人' },
  { to: '/favorites', label: '收藏' },
  { to: '/import-export', label: '导入导出' },
];

/** 应用外壳与路由集成（B0）：统一导航、页面容器、404 与子路由直达 */
export default function App() {
  return (
    <ToastProvider>
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <header className="shell-header">
        <Link to="/contacts" className="brand" aria-label="拾光通讯录首页">
          拾光通讯录
        </Link>
        <nav className="shell-nav" aria-label="主导航">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main id="main-content" className="shell-main">
        <Routes>
          <Route path="/" element={<Navigate to="/contacts" replace />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/contacts/new" element={<ContactNewPage />} />
          <Route path="/contacts/:id/edit" element={<ContactEditPage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route
            path="/import-export"
            element={
              <Suspense fallback={<p className="muted" style={{ padding: 24 }}>加载导入导出模块…</p>}>
                <ImportExportPage />
              </Suspense>
            }
          />
          <Route path="/excel" element={<Navigate to="/import-export" replace />} />
          <Route
            path="*"
            element={
              <div className="page">
                <EmptyState title="页面不存在" hint="你访问的地址没有对应页面，可能已经移动或被删除。" />
                <p style={{ textAlign: 'center', marginTop: 12 }}>
                  <Link to="/contacts" className="btn btn-primary">
                    返回联系人首页
                  </Link>
                </p>
              </div>
            }
          />
        </Routes>
      </main>

      <footer className="shell-footer">
        <p>联系人数据保存在当前浏览器的 IndexedDB 中，清除浏览器数据会一并删除。</p>
      </footer>
    </ToastProvider>
  );
}
