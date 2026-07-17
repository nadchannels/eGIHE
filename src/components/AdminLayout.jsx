import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, Calendar, Users, Megaphone, MessageSquare, Building2, LogOut, Menu, X, ClipboardList } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userData } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/admin/login');
  };

  const isSuperAdmin = userData?.role === 'superadmin';

  const navItems = [
    { name: 'Dashboard', path: '/admin', icon: Home, show: true },
    { name: 'Timetable', path: '/admin/timetable', icon: Calendar, show: true },
    { name: 'Attendance', path: '/admin/attendance', icon: ClipboardList, show: true },
    { name: 'Users Manager', path: '/admin/users', icon: Users, show: isSuperAdmin },
    { name: 'Announcements', path: '/admin/announcements', icon: Megaphone, show: isSuperAdmin },
    { name: 'Comments', path: '/admin/comments', icon: MessageSquare, show: isSuperAdmin },
    { name: 'Institution', path: '/admin/institution', icon: Building2, show: isSuperAdmin },
  ];

  return (
    <div className="app-container">
      <button 
        className="mobile-menu-btn" 
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label="Toggle Menu"
      >
        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <aside className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <h1>Admin Portal</h1>
        </div>
        <div style={{ padding: '0 1.5rem', marginBottom: '1rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
            Welcome, {userData?.firstName} {userData?.lastName}
          </p>
          <span className={`badge ${isSuperAdmin ? 'badge-info' : 'badge-warning'}`}>
            {isSuperAdmin ? 'Super Admin' : 'Trainer'}
          </span>
        </div>
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
              >
                <Icon size={20} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
        <div style={{ padding: '1.5rem', borderTop: '1px solid var(--color-bg-secondary)' }}>
          <button onClick={handleLogout} className="nav-item" style={{ width: '100%', textAlign: 'left' }}>
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
