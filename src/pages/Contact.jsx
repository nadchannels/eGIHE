import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    branch: '',
    faculty: '',
    message: ''
  });
  const [branches, setBranches] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchBranches();
    fetchFaculties();
  }, []);

  const fetchBranches = async () => {
    const snapshot = await getDocs(collection(db, 'branches'));
    setBranches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const fetchFaculties = async () => {
    const snapshot = await getDocs(collection(db, 'faculties'));
    setFaculties(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'comments'), {
        ...formData,
        createdAt: serverTimestamp(),
        status: 'unread'
      });
      setSuccess(true);
      setFormData({ name: '', branch: '', faculty: '', message: '' });
      setTimeout(() => setSuccess(false), 5000);
    } catch (error) {
      console.error(error);
      alert('Failed to send message');
    }
    setLoading(false);
  };

  return (
    <div className="animate-fade-in">
      <h1 className="page-title">Contact Us</h1>
      <p className="page-subtitle">Leave your comment, thought, idea, or question below.</p>

      <div className="card" style={{ maxWidth: '600px' }}>
        {success && (
          <div className="badge badge-success" style={{ display: 'block', marginBottom: '1.5rem', padding: '1rem' }}>
            Your message has been sent successfully!
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Name (Optional)</label>
            <input 
              type="text" 
              name="name"
              className="input-control" 
              placeholder="Enter your name" 
              value={formData.name}
              onChange={handleChange}
            />
          </div>
          <div className="input-group">
            <label>Branch</label>
            <select 
              name="branch"
              className="input-control"
              required
              value={formData.branch}
              onChange={handleChange}
            >
              <option value="">Select Branch</option>
              {branches.map(b => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>
          <div className="input-group">
            <label>Faculty</label>
            <select 
              name="faculty"
              className="input-control"
              required
              value={formData.faculty}
              onChange={handleChange}
            >
              <option value="">Select Faculty</option>
              {faculties.map(f => (
                <option key={f.id} value={f.name}>{f.name}</option>
              ))}
            </select>
          </div>
          <div className="input-group">
            <label>Message</label>
            <textarea 
              name="message"
              className="input-control" 
              placeholder="Write your thought, idea, or question..."
              required
              value={formData.message}
              onChange={handleChange}
            ></textarea>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Sending...' : 'Send Message'}
          </button>
        </form>
      </div>
    </div>
  );
}
