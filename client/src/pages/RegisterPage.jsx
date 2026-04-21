import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const RegisterPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }
    
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
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
    <div className="main-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '90vh', background: 'radial-gradient(circle at center, rgba(157, 78, 221, 0.05) 0%, transparent 70%)' }}>
      <div className="info-card" style={{ 
        width: '100%', 
        maxWidth: '420px', 
        padding: '40px',
        background: 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        borderRadius: '24px'
      }}>
        
        {/* BRANDING SECTION */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ 
            width: '64px', height: '64px', 
            borderRadius: '16px', 
            margin: '0 auto 16px',
            overflow: 'hidden',
            border: '2px solid rgba(157, 78, 221, 0.3)',
            background: 'rgba(0,0,0,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 20px rgba(157, 78, 221, 0.2)'
          }}>
            <img src="/logo.png" alt="PersonaRx" style={{ width: '120%', height: '120%', objectFit: 'cover' }} />
          </div>
          <h1 style={{ fontSize: '28px', color: '#fff', margin: '0 0 4px', fontWeight: 800, letterSpacing: '-0.02em' }}>Join PersonaRx</h1>
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', margin: 0, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Precision Adherence. AI-Driven Care.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="field-list">
          {error && (
            <div style={{ color: '#ff4d6d', fontSize: '13px', padding: '12px', background: 'rgba(255,77,109,0.1)', border: '1px solid rgba(255,77,109,0.2)', borderRadius: '12px', marginBottom: '20px', textAlign: 'center' }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '18px' }}>
            <label className="field-label" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', marginBottom: '6px', display: 'block', fontWeight: 600 }}>EMAIL ADDRESS</label>
            <input
              type="email"
              className="field-item"
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px', color: '#fff', fontSize: '14px' }}
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div style={{ marginBottom: '18px' }}>
            <label className="field-label" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', marginBottom: '6px', display: 'block', fontWeight: 600 }}>PASSWORD</label>
            <input
              type="password"
              className="field-item"
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px', color: '#fff', fontSize: '14px' }}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label className="field-label" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', marginBottom: '6px', display: 'block', fontWeight: 600 }}>CONFIRM PASSWORD</label>
            <input
              type="password"
              className="field-item"
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px', color: '#fff', fontSize: '14px' }}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn-analyze"
            style={{ 
              width: '100%', 
              justifyContent: 'center', 
              padding: '14px', 
              borderRadius: '12px', 
              fontSize: '15px', 
              fontWeight: 700, 
              background: 'linear-gradient(90deg, #9d4edd, #ff4d6d)',
              boxShadow: '0 4px 15px rgba(157, 78, 221, 0.3)'
            }}
            disabled={loading}
          >
            {loading ? 'Creating account...' : 'Create PersonaRx Account'}
          </button>

          <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>
            Already have an account? <Link to="/login" style={{ color: '#ff4d6d', fontWeight: '600', textDecoration: 'none' }}>Sign In</Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterPage;
