import React, { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { Navigate, useNavigate } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { signOut } from 'firebase/auth';
import { LogOut } from 'lucide-react';

export default function ApprovalPending() {
  const { userData, user } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  if (!userData) {
    return <Navigate to="/admin/login" />;
  }

  if (userData.status === 'approved') {
    return <Navigate to="/admin" />;
  }

  const handleAppeal = async () => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        status: 'appealing'
      });
      alert('Appeal submitted successfully');
      window.location.reload();
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/admin/login');
  };

  return (
    <div className="auth-container">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <h2 style={{ marginBottom: '1rem' }}>Account Status</h2>
        
        {userData.status === 'pending' && (
          <div>
            <div className="badge badge-warning" style={{ fontSize: '1.2rem', padding: '0.5rem 1rem', marginBottom: '1rem' }}>
              Approval Pending
            </div>
            <p style={{ color: 'var(--color-text-secondary)' }}>
              Your account is waiting for Super Admin approval. Please check back later.
            </p>
          </div>
        )}

        {userData.status === 'declined' && (
          <div>
            <div className="badge badge-danger" style={{ fontSize: '1.2rem', padding: '0.5rem 1rem', marginBottom: '1rem' }}>
              Account Declined
            </div>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
              Your application to become a trainer has been declined.
            </p>
            <button className="btn btn-primary" onClick={handleAppeal} disabled={loading}>
              {loading ? 'Appealing...' : 'Appeal Decision'}
            </button>
          </div>
        )}

        {userData.status === 'appealing' && (
          <div>
            <div className="badge badge-info" style={{ fontSize: '1.2rem', padding: '0.5rem 1rem', marginBottom: '1rem' }}>
              Appeal Under Review
            </div>
            <p style={{ color: 'var(--color-text-secondary)' }}>
              Your appeal has been sent to the Super Admin. Please wait for a response.
            </p>
          </div>
        )}

        <button 
          onClick={handleLogout} 
          className="btn btn-secondary" 
          style={{ marginTop: '2rem', width: '100%' }}
        >
          <LogOut size={18} /> Logout
        </button>
      </div>
    </div>
  );
}
