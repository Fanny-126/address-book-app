import { Link, Navigate, NavLink, Route, Routes } from 'react-router';
import { ToastProvider } from '@/components/Toast';
import { ContactsPage } from '@/pages/ContactsPage';
import { FavoritesPage } from '@/pages/FavoritesPage';
import { ContactNewPage } from '@/pages/ContactNewPage';
import { ContactEditPage } from '@/pages/ContactEditPage';
import { EmptyState } from '@/components/ui';

/**
 * 开发用应用外壳（最小可用）。
 * 说明：应用外壳与路由集成为成员 B 的职责（B0），
 * 此外壳仅保证 A 模块可独立运行与测试，B 在此基础上替换 / 扩展。
 */
export default function App() {
  return (
    <ToastProvider>
      <header className="shell-header">
        <Link to="/contacts" className="brand">
          拾光通讯录
        </Link>
        <nav className="shell-nav" aria-label="主导航">
          <NavLink to="/contacts" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            联系人
          </NavLink>
          <NavLink to="/favorites" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            收藏
          </NavLink>
        </nav>
      </header>

      <main className="shell-main">
        <Routes>
          <Route path="/" element={<Navigate to="/contacts" replace />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/contacts/new" element={<ContactNewPage />} />
          <Route path="/contacts/:id/edit" element={<ContactEditPage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route
            path="*"
            element={
              <div className="page">
                <EmptyState title="页面不存在" hint="你访问的地址没有对应页面。" />
                <p style={{ textAlign: 'center', marginTop: 12 }}>
                  <Link to="/contacts" className="btn btn-primary">
                    返回首页
                  </Link>
                </p>
              </div>
            }
          />
        </Routes>
      </main>
    </ToastProvider>
  );
}
