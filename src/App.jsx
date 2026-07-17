import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

// Layouts
import PublicLayout from './components/PublicLayout';
import AdminLayout from './components/AdminLayout';
import ProtectedRoute from './components/ProtectedRoute';

// Public Pages
import Home from './pages/Home';
import Timetable from './pages/Timetable';
import Announcements from './pages/Announcements';
import Contact from './pages/Contact';

// Admin Pages
import LoginRegister from './pages/admin/LoginRegister';
import ApprovalPending from './pages/admin/ApprovalPending';
import Dashboard from './pages/admin/Dashboard';
import AdminTimetable from './pages/admin/AdminTimetable';
import Attendance from './pages/admin/Attendance';
import UsersManager from './pages/admin/UsersManager';
import AdminAnnouncements from './pages/admin/AdminAnnouncements';
import CommentsManager from './pages/admin/CommentsManager';
import InstitutionManager from './pages/admin/InstitutionManager';

function App() {
  const { initializeAuth } = useAuthStore();

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="timetable" element={<Timetable />} />
          <Route path="announcements" element={<Announcements />} />
          <Route path="contact" element={<Contact />} />
        </Route>

        {/* Admin Auth Routes */}
        <Route path="/admin/login" element={<LoginRegister />} />
        <Route path="/admin/approval-pending" element={<ApprovalPending />} />

        {/* Protected Admin Routes */}
        <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="timetable" element={<AdminTimetable />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="users" element={<ProtectedRoute requireSuperAdmin><UsersManager /></ProtectedRoute>} />
          <Route path="announcements" element={<ProtectedRoute requireSuperAdmin><AdminAnnouncements /></ProtectedRoute>} />
          <Route path="comments" element={<ProtectedRoute requireSuperAdmin><CommentsManager /></ProtectedRoute>} />
          <Route path="institution" element={<ProtectedRoute requireSuperAdmin><InstitutionManager /></ProtectedRoute>} />
        </Route>
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
