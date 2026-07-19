import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, Calendar, Users, Megaphone, MessageSquare, Building2,
  LogOut, Menu, X, ClipboardList, ChevronLeft, ChevronRight, MapPin
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userData } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/admin/login');
  };

  const isSuperAdmin = userData?.role === 'superadmin';
  const isTrainer = userData?.role === 'trainer';
  const isBranchManager = userData?.role === 'branch_manager';

  const navItems = [
    // SuperAdmin & all roles
    { name: 'Dashboard',         path: '/admin',                   icon: Home,         show: true },
    // SuperAdmin & Trainer timetable
    { name: 'Timetable',         path: '/admin/timetable',         icon: Calendar,     show: isSuperAdmin || isTrainer },
    // SuperAdmin & Trainer attendance
    { name: 'Attendance',        path: '/admin/attendance',        icon: ClipboardList, show: isSuperAdmin || isTrainer },
    // Branch Manager timetable
    { name: 'Branch Timetable',  path: '/admin/branch-timetable',  icon: Calendar,     show: isBranchManager },
    // Branch Manager attendance
    { name: 'Branch Attendance', path: '/admin/branch-attendance', icon: ClipboardList, show: isBranchManager },
    // SuperAdmin only
    { name: 'Users Manager',     path: '/admin/users',             icon: Users,        show: isSuperAdmin },
    { name: 'Announcements',     path: '/admin/announcements',     icon: Megaphone,    show: isSuperAdmin },
    { name: 'Comments',          path: '/admin/comments',          icon: MessageSquare, show: isSuperAdmin },
    { name: 'Institution',       path: '/admin/institution',       icon: Building2,    show: isSuperAdmin },
  ];

  const roleBadge = () => {
    if (isSuperAdmin) return { label: 'Super Admin', cls: 'badge-info' };
    if (isBranchManager) return { label: 'Branch Manager', cls: 'badge-warning' };
    return { label: 'Trainer', cls: 'badge-success' };
  };
  const { label: roleLabel, cls: roleCls } = roleBadge();

  return (
    <div className={`app-container${collapsed ? ' sidebar-collapsed' : ''}`}>
      {/* Mobile hamburger */}
      <button
        className="mobile-menu-btn"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label="Toggle Menu"
      >
        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileMenuOpen(false)} />
      )}

      <aside className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''} ${collapsed ? 'collapsed' : ''}`}>
        {/* Collapse toggle button */}
        <button
          className="sidebar-collapse-btn"
          onClick={() => setCollapsed(prev => !prev)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>

        <div className="sidebar-header">
          <div className="sidebar-logo">
            <MapPin size={22} />
          </div>
          {!collapsed && <h1>Admin Portal</h1>}
        </div>

        {!collapsed && (
          <div style={{ padding: '0 1.5rem', marginBottom: '1rem' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.4rem' }}>
              {userData?.firstName} {userData?.lastName}
            </p>
            <span className={`badge ${roleCls}`}>{roleLabel}</span>
          </div>
        )}

        <nav className="sidebar-nav">
          {navItems.filter(item => item.show).map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
                title={collapsed ? item.name : ''}
              >
                <Icon size={20} style={{ flexShrink: 0 }} />
                {!collapsed && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: collapsed ? '1.5rem 0' : '1.5rem', borderTop: '1px solid var(--color-bg-secondary)', display: 'flex', justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <button
            onClick={handleLogout}
            className="nav-item"
            style={{ width: collapsed ? 'auto' : '100%', textAlign: 'left' }}
            title={collapsed ? 'Logout' : ''}
          >
            <LogOut size={20} style={{ flexShrink: 0 }} />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
