import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc, getDocs, collection, query, where, limit } from 'firebase/firestore';
import { Eye, EyeOff, ArrowLeft, Mail, KeyRound, Building2 } from 'lucide-react';

export default function LoginRegister() {
  // ─── Mode state ───────────────────────────────────────────────────────────
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot-verify' | 'forgot-sent'

  // ─── General ──────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [faculties, setFaculties] = useState([]);
  const [branches, setBranches] = useState([]);
  const navigate = useNavigate();

  // ─── Password visibility toggles ─────────────────────────────────────────
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // ─── Login / Register form ────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    middleName: '',
    username: '',
    password: '',
    confirmPassword: '',
    selectedFaculties: [],
    selectedBranch: '',
    personalEmail: '',
    role: 'trainer'
  });

  // ─── Forgot-password form ─────────────────────────────────────────────────
  const [forgotData, setForgotData] = useState({
    username: '',      // the part before @ksp.rw
    role: 'trainer',
    firstName: '',
    lastName: '',
    personalEmail: ''
  });

  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      const [fSnap, bSnap] = await Promise.all([
        getDocs(collection(db, 'faculties')),
        getDocs(collection(db, 'branches'))
      ]);
      setFaculties(fSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setBranches(bSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchData();
  }, []);

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const clearErrors = () => setError('');

  const generatedEmail = formData.username
    ? `${formData.username.toLowerCase().replace(/\s+/g, '')}@ksp.rw`
    : '';

  const forgotGeneratedEmail = forgotData.username
    ? `${forgotData.username.toLowerCase().replace(/\s+/g, '')}@ksp.rw`
    : '';

  const handleChange = (e) => {
    if (e.target.name === 'selectedFaculties') {
      const value = Array.from(e.target.selectedOptions, o => o.value);
      setFormData({ ...formData, selectedFaculties: value });
    } else {
      setFormData({ ...formData, [e.target.name]: e.target.value });
    }
  };

  const handleForgotChange = (e) => {
    setForgotData({ ...forgotData, [e.target.name]: e.target.value });
  };

  const switchMode = (newMode) => {
    clearErrors();
    setMode(newMode);
  };

  // ─── Login / Register submit ───────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    clearErrors();
    setLoading(true);

    try {
      if (mode === 'login') {
        const loginEmail = formData.username.includes('@')
          ? formData.username
          : generatedEmail;
        await signInWithEmailAndPassword(auth, loginEmail, formData.password);
        navigate('/admin');
      } else {
        if (formData.password !== formData.confirmPassword) {
          throw new Error('Passwords do not match');
        }

        const userCredential = await createUserWithEmailAndPassword(
          auth,
          generatedEmail,
          formData.password
        );
        const user = userCredential.user;

        const role = generatedEmail === 'egihemanager@ksp.rw' ? 'superadmin' : formData.role;
        const status = generatedEmail === 'egihemanager@ksp.rw' ? 'approved' : 'pending';

        const userRecord = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          middleName: formData.middleName,
          username: formData.username,
          email: generatedEmail,
          personalEmail: formData.personalEmail,
          role,
          status,
          createdAt: new Date().toISOString()
        };

        // Attach role-specific fields
        if (role === 'branch_manager') {
          userRecord.branch = formData.selectedBranch;
        } else {
          userRecord.faculties = formData.selectedFaculties;
        }

        await setDoc(doc(db, 'users', user.uid), userRecord);

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

  // ─── Forgot Password: verify identity ─────────────────────────────────────
  const handleForgotVerify = async (e) => {
    e.preventDefault();
    clearErrors();
    setLoading(true);

    try {
      if (!forgotGeneratedEmail) throw new Error('Please enter a valid username.');

      // Query Firestore for a user matching all four fields
      const q = query(
        collection(db, 'users'),
        where('email', '==', forgotGeneratedEmail),
        where('role', '==', forgotData.role),
        where('firstName', '==', forgotData.firstName),
        where('lastName', '==', forgotData.lastName),
        limit(1)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        throw new Error(
          'No account found matching these details. Please check your information and try again.'
        );
      }

      const userDoc = snapshot.docs[0].data();

      // Verify personal email as an extra security factor
      if (
        forgotData.personalEmail &&
        userDoc.personalEmail &&
        userDoc.personalEmail.toLowerCase() !== forgotData.personalEmail.toLowerCase()
      ) {
        throw new Error('Personal email does not match our records.');
      }

      // Send reset link to their @ksp.rw email (Firebase Auth account email)
      await sendPasswordResetEmail(auth, forgotGeneratedEmail);

      setMode('forgot-sent');
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  // ─── UI ───────────────────────────────────────────────────────────────────
  return (
    <div className="auth-container">
      <div className="auth-card animate-fade-in">

        {/* ── LOGIN ────────────────────────────────────────────────────────── */}
        {mode === 'login' && (
          <>
            <h2 style={{ textAlign: 'center', marginBottom: '0.5rem', fontSize: '2rem', fontWeight: '800' }}>
              Welcome Back
            </h2>
            <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', marginBottom: '2rem' }}>
              Login to access the Admin Portal
            </p>

            {error && (
              <div className="badge badge-danger" style={{ display: 'block', marginBottom: '1.5rem', padding: '1rem', whiteSpace: 'normal', borderRadius: 'var(--radius-md)' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <label>Email or Username</label>
                <input
                  type="text"
                  name="username"
                  className="input-control"
                  required
                  value={formData.username}
                  onChange={handleChange}
                />
              </div>

              <div className="input-group" style={{ position: 'relative' }}>
                <label>Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  className="input-control"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  style={{ paddingRight: '3rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '1rem', top: '2.5rem', color: 'var(--color-text-secondary)' }}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
                {/* Forgot Password link */}
                <div style={{ textAlign: 'right', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => switchMode('forgot-verify')}
                    style={{ fontSize: '0.875rem', color: 'var(--color-accent)', fontWeight: '500', textDecoration: 'underline' }}
                  >
                    Forgot password?
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '1rem', marginTop: '0.5rem' }}
                disabled={loading}
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </form>

            <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--color-text-secondary)' }}>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => switchMode('register')}
                style={{ color: 'var(--color-text-primary)', fontWeight: '600', textDecoration: 'underline' }}
              >
                Register
              </button>
            </p>
          </>
        )}

        {/* ── REGISTER ─────────────────────────────────────────────────────── */}
        {mode === 'register' && (
          <>
            <h2 style={{ textAlign: 'center', marginBottom: '0.5rem', fontSize: '2rem', fontWeight: '800' }}>
              Join eGIHE
            </h2>
            <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', marginBottom: '2rem' }}>
              {formData.role === 'branch_manager' ? 'Register as a Branch Manager' : 'Register to become a Trainer'}
            </p>

            {error && (
              <div className="badge badge-danger" style={{ display: 'block', marginBottom: '1.5rem', padding: '1rem', whiteSpace: 'normal', borderRadius: 'var(--radius-md)' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
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
                <label>Middle Name <span style={{ color: 'var(--color-text-secondary)', fontWeight: 400 }}>(Optional)</span></label>
                <input type="text" name="middleName" className="input-control" value={formData.middleName} onChange={handleChange} />
              </div>

              <div className="input-group">
                <label>Username</label>
                <input
                  type="text"
                  name="username"
                  className="input-control"
                  required
                  value={formData.username}
                  onChange={handleChange}
                />
                {generatedEmail && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
                    Your institutional email will be: <strong>{generatedEmail}</strong>
                  </p>
                )}
              </div>

              <div className="input-group">
                <label>
                  Personal Email{' '}
                  <span style={{ color: 'var(--color-text-secondary)', fontWeight: 400 }}>(used for account recovery)</span>
                </label>
                <input
                  type="email"
                  name="personalEmail"
                  className="input-control"
                  value={formData.personalEmail}
                  onChange={handleChange}
                  placeholder="e.g. yourname@gmail.com"
                />
              </div>

              {/* Role Selector */}
              <div className="input-group">
                <label>Role</label>
                <select
                  name="role"
                  className="input-control"
                  value={formData.role}
                  onChange={handleChange}
                >
                  <option value="trainer">Trainer</option>
                  <option value="branch_manager">Branch Manager</option>
                </select>
              </div>

              {/* Faculty selector — only for trainers */}
              {formData.role === 'trainer' && (
                <div className="input-group">
                  <label>Faculties <span style={{ color: 'var(--color-text-secondary)', fontWeight: 400 }}>(Hold Ctrl/Cmd to select multiple)</span></label>
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

              {/* Branch selector — only for branch managers */}
              {formData.role === 'branch_manager' && (
                <div className="input-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Building2 size={14} /> Assigned Branch
                  </label>
                  <select
                    name="selectedBranch"
                    className="input-control"
                    required
                    value={formData.selectedBranch}
                    onChange={handleChange}
                  >
                    <option value="">— Select Branch —</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="input-group" style={{ position: 'relative' }}>
                <label>Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  className="input-control"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  style={{ paddingRight: '3rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '1rem', top: '2.5rem', color: 'var(--color-text-secondary)' }}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              <div className="input-group" style={{ position: 'relative' }}>
                <label>Confirm Password</label>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  className="input-control"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  style={{ paddingRight: '3rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{ position: 'absolute', right: '1rem', top: '2.5rem', color: 'var(--color-text-secondary)' }}
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '1rem', marginTop: '0.5rem' }}
                disabled={loading}
              >
                {loading ? 'Registering...' : 'Register'}
              </button>
            </form>

            <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--color-text-secondary)' }}>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => switchMode('login')}
                style={{ color: 'var(--color-text-primary)', fontWeight: '600', textDecoration: 'underline' }}
              >
                Login
              </button>
            </p>
          </>
        )}

        {/* ── FORGOT — VERIFY IDENTITY ──────────────────────────────────────── */}
        {mode === 'forgot-verify' && (
          <>
            <button
              type="button"
              onClick={() => switchMode('login')}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}
            >
              <ArrowLeft size={16} /> Back to Login
            </button>

            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ width: '56px', height: '56px', background: 'rgba(37,99,235,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <KeyRound size={24} color="var(--color-accent)" />
              </div>
              <h2 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '0.5rem' }}>
                Forgot Password?
              </h2>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>
                Verify your identity and we'll send a reset link to your institutional email.
              </p>
            </div>

            {error && (
              <div className="badge badge-danger" style={{ display: 'block', marginBottom: '1.5rem', padding: '1rem', whiteSpace: 'normal', borderRadius: 'var(--radius-md)' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleForgotVerify}>
              <div className="input-group">
                <label>Institutional Email (Username)</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="text"
                    name="username"
                    className="input-control"
                    required
                    placeholder="your.username"
                    value={forgotData.username}
                    onChange={handleForgotChange}
                    style={{ paddingRight: '7rem' }}
                  />
                  <span style={{
                    position: 'absolute', right: '1rem',
                    color: 'var(--color-text-secondary)', fontSize: '0.875rem', pointerEvents: 'none'
                  }}>
                    @ksp.rw
                  </span>
                </div>
                {forgotGeneratedEmail && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
                    Will look up: <strong>{forgotGeneratedEmail}</strong>
                  </p>
                )}
              </div>

              <div className="input-group">
                <label>Your Role</label>
                <select
                  name="role"
                  className="input-control"
                  value={forgotData.role}
                  onChange={handleForgotChange}
                  required
                >
                  <option value="trainer">Trainer</option>
                  <option value="branch_manager">Branch Manager</option>
                  <option value="superadmin">Super Admin</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>First Name</label>
                  <input
                    type="text"
                    name="firstName"
                    className="input-control"
                    required
                    value={forgotData.firstName}
                    onChange={handleForgotChange}
                  />
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>Last Name</label>
                  <input
                    type="text"
                    name="lastName"
                    className="input-control"
                    required
                    value={forgotData.lastName}
                    onChange={handleForgotChange}
                  />
                </div>
              </div>

              <div className="input-group">
                <label>
                  Personal Email{' '}
                  <span style={{ color: 'var(--color-text-secondary)', fontWeight: 400 }}>(the one you registered with)</span>
                </label>
                <input
                  type="email"
                  name="personalEmail"
                  className="input-control"
                  placeholder="e.g. yourname@gmail.com"
                  value={forgotData.personalEmail}
                  onChange={handleForgotChange}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '1rem', marginTop: '0.5rem' }}
                disabled={loading}
              >
                {loading ? 'Verifying...' : 'Verify & Send Reset Link'}
              </button>
            </form>
          </>
        )}

        {/* ── FORGOT — LINK SENT ────────────────────────────────────────────── */}
        {mode === 'forgot-sent' && (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ width: '72px', height: '72px', background: 'rgba(16,185,129,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
              <Mail size={32} color="var(--color-success)" />
            </div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '0.75rem' }}>
              Reset Link Sent!
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '0.5rem', lineHeight: '1.6' }}>
              A password reset link has been sent to your institutional email address{' '}
              <strong>({forgotGeneratedEmail})</strong>.
            </p>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginBottom: '2rem' }}>
              Please check your inbox and follow the instructions in the email.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => switchMode('login')}
              style={{ width: '100%', padding: '1rem' }}
            >
              Back to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
