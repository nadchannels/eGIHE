import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function ProtectedRoute({ children, requireSuperAdmin = false }) {
  const { user, userData, loading } = useAuthStore();

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
  }

  if (!user || !userData) {
    return <Navigate to="/admin/login" replace />;
  }

  if (userData.status !== 'approved') {
    return <Navigate to="/admin/approval-pending" replace />;
  }

  if (requireSuperAdmin && userData.role !== 'superadmin') {
    return <Navigate to="/admin" replace />;
  }

  return children;
}
