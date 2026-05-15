import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export default function Announcements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      setAnnouncements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  return (
    <div className="animate-fade-in">
      <h1 className="page-title">Announcements</h1>
      <p className="page-subtitle">Latest updates from the Super Admin</p>

      {loading ? (
        <p>Loading announcements...</p>
      ) : announcements.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          No announcements available.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {announcements.map((ann) => (
            <div key={ann.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {ann.tags && ann.tags.map((tag, idx) => (
                    <span key={idx} className="badge badge-info">{tag}</span>
                  ))}
                </div>
                <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                  {ann.createdAt?.toDate().toLocaleDateString()}
                </span>
              </div>
              <div 
                className="announcement-content"
                style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}
                dangerouslySetInnerHTML={{ __html: ann.content }} 
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
