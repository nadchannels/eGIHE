import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Trash2, CheckCircle } from 'lucide-react';

export default function CommentsManager() {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchComments();
  }, []);

  const fetchComments = async () => {
    const q = query(collection(db, 'comments'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    setLoading(false);
  };

  const markAsRead = async (id) => {
    await updateDoc(doc(db, 'comments', id), { status: 'read' });
    fetchComments();
  };

  const handleDelete = async (id) => {
    if (confirm('Delete this comment?')) {
      await deleteDoc(doc(db, 'comments', id));
      fetchComments();
    }
  };

  return (
    <div className="animate-fade-in">
      <h1 className="page-title">Comments</h1>
      <p className="page-subtitle">Messages from Trainees via Contact Us</p>

      {loading ? (
        <p>Loading comments...</p>
      ) : comments.length === 0 ? (
        <div className="card">No comments found.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {comments.map((comment) => (
            <div key={comment.id} className="card" style={{ borderLeft: comment.status === 'unread' ? '4px solid var(--color-danger)' : '4px solid var(--color-success)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '600' }}>{comment.name || 'Anonymous'}</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                  {comment.createdAt?.toDate().toLocaleDateString()}
                </span>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
                Branch: {comment.branch} | Faculty: {comment.faculty}
              </p>
              <div style={{ backgroundColor: 'var(--color-bg-primary)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
                <p>{comment.message}</p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                {comment.status === 'unread' && (
                  <button onClick={() => markAsRead(comment.id)} className="btn btn-secondary" style={{ padding: '0.5rem' }}>
                    <CheckCircle size={16} /> Mark Read
                  </button>
                )}
                <button onClick={() => handleDelete(comment.id)} className="btn btn-danger" style={{ padding: '0.5rem' }}>
                  <Trash2 size={16} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
