import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      login(data.token);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
      <div className="info-card" style={{ width: '100%', maxWidth: '400px' }}>
        <div className="info-card-header">
          <div className="info-card-icon pink">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13.8 12H3"/>
            </svg>
          </div>
          <div className="info-card-title">Login to PrescriptAI</div>
        </div>

        <form onSubmit={handleSubmit} className="field-list">
          {error && (
            <div style={{ color: 'var(--error)', fontSize: '13px', padding: '10px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', marginBottom: '10px' }}>
              ⚠️ {error}
            </div>
          )}

          <div style={{ marginBottom: '15px' }}>
            <label className="field-label">Email Address</label>
            <input
              type="email"
              className="field-item"
              style={{ width: '100%', outline: 'none', color: 'var(--text-1)' }}
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label className="field-label">Password</label>
            <input
              type="password"
              className="field-item"
              style={{ width: '100%', outline: 'none', color: 'var(--text-1)' }}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn-analyze"
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>

          <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '14px', color: 'var(--text-2)' }}>
            Don't have an account? <Link to="/register" style={{ color: 'var(--accent)', fontWeight: '600' }}>Register</Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
