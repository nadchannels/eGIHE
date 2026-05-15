import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Check, X, Shield, Trash2 } from 'lucide-react';

export default function UsersManager() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('pending'); // pending, approved, declined, appealing

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const q = query(collection(db, 'users'));
    const snapshot = await getDocs(q);
    setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const handleUpdateStatus = async (id, status) => {
    setLoading(true);
    await updateDoc(doc(db, 'users', id), { status });
    fetchUsers();
    setLoading(false);
  };

  const handlePromote = async (id, role) => {
    setLoading(true);
    await updateDoc(doc(db, 'users', id), { role });
    fetchUsers();
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this user?')) {
      setLoading(true);
      await deleteDoc(doc(db, 'users', id));
      fetchUsers();
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u => u.status === activeTab);

  return (
    <div className="animate-fade-in">
      <h1 className="page-title">Users Manager</h1>
      <p className="page-subtitle">Manage user approvals and roles</p>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--color-bg-secondary)', paddingBottom: '1rem' }}>
          {['pending', 'approved', 'declined', 'appealing'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: activeTab === tab ? 'var(--color-text-primary)' : 'transparent',
                color: activeTab === tab ? 'var(--color-white)' : 'var(--color-text-secondary)',
                fontWeight: '600',
                textTransform: 'capitalize'
              }}
            >
              {tab} ({users.filter(u => u.status === tab).length})
            </button>
          ))}
        </div>

        <div className="table-wrapper" style={{ marginTop: '2rem' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username/Email</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr><td colSpan="4" style={{ textAlign: 'center' }}>No users found in this category.</td></tr>
              ) : (
                filteredUsers.map(u => (
                  <tr key={u.id}>
                    <td>{u.firstName} {u.lastName}</td>
                    <td>{u.username} <br/><span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{u.email}</span></td>
                    <td>
                      <span className={`badge ${u.role === 'superadmin' ? 'badge-info' : 'badge-warning'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {(activeTab === 'pending' || activeTab === 'appealing') && (
                          <>
                            <button onClick={() => handleUpdateStatus(u.id, 'approved')} className="btn btn-primary" style={{ padding: '0.25rem 0.5rem' }}>
                              <Check size={16} /> Approve
                            </button>
                            <button onClick={() => handleUpdateStatus(u.id, 'declined')} className="btn btn-danger" style={{ padding: '0.25rem 0.5rem' }}>
                              <X size={16} /> Decline
                            </button>
                          </>
                        )}
                        {activeTab === 'approved' && (
                          <>
                            {u.role === 'trainer' ? (
                              <button onClick={() => handlePromote(u.id, 'superadmin')} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }}>
                                <Shield size={16} /> Promote to Admin
                              </button>
                            ) : (
                              <button onClick={() => handlePromote(u.id, 'trainer')} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }}>
                                <Shield size={16} /> Demote to Trainer
                              </button>
                            )}
                            <button onClick={() => handleUpdateStatus(u.id, 'declined')} className="btn btn-danger" style={{ padding: '0.25rem 0.5rem' }}>
                              <X size={16} /> Revoke
                            </button>
                          </>
                        )}
                        <button onClick={() => handleDelete(u.id)} style={{ color: 'var(--color-danger)', marginLeft: '1rem' }}>
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
