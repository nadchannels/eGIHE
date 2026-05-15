import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { Trash2, Bold, Italic } from 'lucide-react';

export default function AdminAnnouncements() {
  const [content, setContent] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [branches, setBranches] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
    fetchAnnouncements();
  }, []);

  const fetchData = async () => {
    const bSnap = await getDocs(collection(db, 'branches'));
    const fSnap = await getDocs(collection(db, 'faculties'));
    setBranches(bSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setFaculties(fSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const fetchAnnouncements = async () => {
    const snap = await getDocs(collection(db, 'announcements'));
    setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const insertTag = (tag) => {
    if (!selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const removeTag = (tagToRemove) => {
    setSelectedTags(selectedTags.filter(tag => tag !== tagToRemove));
  };

  const insertFormatting = (format) => {
    const textarea = document.getElementById('announcementContent');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    
    let replacement = '';
    if (format === 'bold') replacement = `<b>${text.substring(start, end)}</b>`;
    if (format === 'italic') replacement = `<i>${text.substring(start, end)}</i>`;
    
    const newText = text.substring(0, start) + replacement + text.substring(end);
    setContent(newText);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);

    try {
      // Replace enters with <br>
      const formattedContent = content.replace(/\n/g, '<br>');
      
      await addDoc(collection(db, 'announcements'), {
        content: formattedContent,
        tags: selectedTags,
        createdAt: serverTimestamp()
      });
      setContent('');
      setSelectedTags([]);
      fetchAnnouncements();
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (confirm('Delete this announcement?')) {
      await deleteDoc(doc(db, 'announcements', id));
      fetchAnnouncements();
    }
  };

  return (
    <div className="animate-fade-in">
      <h1 className="page-title">Announcements Manager</h1>
      <p className="page-subtitle">Create and manage announcements</p>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2>New Announcement</h2>
        
        <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
          <p style={{ fontWeight: '500', marginBottom: '0.5rem' }}>Click to Tag Branches/Faculties:</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {branches.map(b => (
              <button key={b.id} type="button" onClick={() => insertTag(`@${b.tag}`)} className="badge badge-info" style={{ cursor: 'pointer' }}>
                @{b.tag}
              </button>
            ))}
            {faculties.map(f => (
              <button key={f.id} type="button" onClick={() => insertTag(`@${f.tag}`)} className="badge badge-warning" style={{ cursor: 'pointer' }}>
                @{f.tag}
              </button>
            ))}
          </div>
        </div>

        {selectedTags.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>Selected Tags:</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {selectedTags.map(tag => (
                <span key={tag} className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  {tag} <button type="button" onClick={() => removeTag(tag)} style={{ display: 'flex', alignItems: 'center' }}><Trash2 size={12}/></button>
                </span>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <button type="button" onClick={() => insertFormatting('bold')} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }}>
                <Bold size={16} /> Bold
              </button>
              <button type="button" onClick={() => insertFormatting('italic')} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }}>
                <Italic size={16} /> Italic
              </button>
            </div>
            <textarea
              id="announcementContent"
              className="input-control"
              rows={6}
              placeholder="Write your announcement here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            ></textarea>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Posting...' : 'Post Announcement'}
          </button>
        </form>
      </div>

      <div className="card">
        <h2>Past Announcements</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          {announcements.map(ann => (
            <div key={ann.id} style={{ padding: '1rem', border: '1px solid var(--color-bg-secondary)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {ann.tags?.map((tag, idx) => <span key={idx} className="badge badge-info">{tag}</span>)}
                </div>
                <button onClick={() => handleDelete(ann.id)} style={{ color: 'var(--color-danger)' }}>
                  <Trash2 size={16} />
                </button>
              </div>
              <div dangerouslySetInnerHTML={{ __html: ann.content }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
