import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDocs, collection } from 'firebase/firestore';
import { Eye, EyeOff } from 'lucide-react';

export default function LoginRegister() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const [faculties, setFaculties] = useState([]);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    middleName: '',
    username: '',
    password: '',
    confirmPassword: '',
    selectedFaculties: []
  });

  useEffect(() => {
    const fetchFaculties = async () => {
      const snapshot = await getDocs(collection(db, 'faculties'));
      setFaculties(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchFaculties();
  }, []);

  const handleChange = (e) => {
    if (e.target.name === 'selectedFaculties') {
      const value = Array.from(e.target.selectedOptions, option => option.value);
      setFormData({ ...formData, selectedFaculties: value });
    } else {
      setFormData({ ...formData, [e.target.name]: e.target.value });
    }
  };

  const generatedEmail = formData.username ? `${formData.username.toLowerCase().replace(/\s+/g, '')}@ksp.rw` : '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const loginEmail = formData.username.includes('@') ? formData.username : generatedEmail;
        await signInWithEmailAndPassword(auth, loginEmail, formData.password);
        navigate('/admin');
      } else {
        if (formData.password !== formData.confirmPassword) {
          throw new Error('Passwords do not match');
        }
        
        const userCredential = await createUserWithEmailAndPassword(auth, generatedEmail, formData.password);
        const user = userCredential.user;

        const role = generatedEmail === 'egihemanager@ksp.rw' ? 'superadmin' : 'trainer';
        const status = generatedEmail === 'egihemanager@ksp.rw' ? 'approved' : 'pending';

        await setDoc(doc(db, 'users', user.uid), {
          firstName: formData.firstName,
          lastName: formData.lastName,
          middleName: formData.middleName,
          username: formData.username,
          email: generatedEmail,
          faculties: formData.selectedFaculties,
          role: role,
          status: status,
          createdAt: new Date().toISOString()
        });

        if (status === 'approved') {
          navigate('/admin');
        } else {
          navigate('/admin/approval-pending');
        }
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-card animate-fade-in">
        <h2 style={{ textAlign: 'center', marginBottom: '0.5rem', fontSize: '2rem', fontWeight: '800' }}>
          {isLogin ? 'Welcome Back' : 'Join eGIHE'}
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', marginBottom: '2rem' }}>
          {isLogin ? 'Login to access the Admin Portal' : 'Register to become a Trainer'}
        </p>

        {error && (
          <div className="badge badge-danger" style={{ display: 'block', marginBottom: '1.5rem', padding: '1rem', whiteSpace: 'normal' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>First Name</label>
                  <input type="text" name="firstName" className="input-control" required value={formData.firstName} onChange={handleChange} />
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>Last Name</label>
                  <input type="text" name="lastName" className="input-control" required value={formData.lastName} onChange={handleChange} />
                </div>
              </div>
              <div className="input-group">
                <label>Middle Name (Optional)</label>
                <input type="text" name="middleName" className="input-control" value={formData.middleName} onChange={handleChange} />
              </div>
            </>
          )}

          <div className="input-group">
            <label>{isLogin ? 'Email or Username' : 'Username'}</label>
            <input 
              type="text" 
              name="username" 
              className="input-control" 
              required 
              value={formData.username} 
              onChange={handleChange} 
            />
            {!isLogin && generatedEmail && (
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
                Your email will be: <strong>{generatedEmail}</strong>
              </p>
            )}
          </div>

          {!isLogin && (
            <div className="input-group">
              <label>Faculties (Hold Ctrl/Cmd to select multiple)</label>
              <select 
                name="selectedFaculties" 
                className="input-control" 
                multiple 
                required 
                value={formData.selectedFaculties} 
                onChange={handleChange}
                style={{ height: '100px' }}
              >
                {faculties.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="input-group" style={{ position: 'relative' }}>
            <label>Password</label>
            <input 
              type={showPassword ? "text" : "password"} 
              name="password" 
              className="input-control" 
              required 
              value={formData.password} 
              onChange={handleChange} 
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)}
              style={{ position: 'absolute', right: '1rem', top: '2.5rem', color: 'var(--color-text-secondary)' }}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {!isLogin && (
            <div className="input-group">
              <label>Confirm Password</label>
              <input 
                type="password" 
                name="confirmPassword" 
                className="input-control" 
                required 
                value={formData.confirmPassword} 
                onChange={handleChange} 
              />
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '1rem', marginTop: '1rem' }} disabled={loading}>
            {loading ? 'Processing...' : isLogin ? 'Login' : 'Register'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--color-text-secondary)' }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button 
            type="button" 
            onClick={() => setIsLogin(!isLogin)} 
            style={{ color: 'var(--color-text-primary)', fontWeight: '600', textDecoration: 'underline' }}
          >
            {isLogin ? 'Register' : 'Login'}
          </button>
        </p>
      </div>
    </div>
  );
}
