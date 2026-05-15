import React from 'react';
import { useAuthStore } from '../../store/authStore';

export default function Dashboard() {
  const { userData } = useAuthStore();

  return (
    <div className="animate-fade-in">
      <h1 className="page-title">Dashboard</h1>
      <p className="page-subtitle">Overview of your account</p>

      <div className="card">
        <h2>Welcome back, {userData?.firstName}!</h2>
        <p style={{ marginTop: '1rem', color: 'var(--color-text-secondary)' }}>
          You are logged in as a <strong>{userData?.role === 'superadmin' ? 'Super Admin' : 'Trainer'}</strong>.
        </p>
      </div>
    </div>
  );
}
