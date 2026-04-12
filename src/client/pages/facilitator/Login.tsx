import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.js';

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Noe gikk galt');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="full-layout">
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ width: 40, height: 40, background: '#008A00', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '1rem' }}>DS</div>
            <span style={{ fontWeight: 700, fontSize: '1.125rem' }}>Sprint Light</span>
          </div>
          <h2 style={{ fontSize: '1.375rem', fontWeight: 700 }}>Logg inn</h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginTop: '0.375rem' }}>
            Bruk kontoen du har fatt tildelt
          </p>
        </div>

        <div className="card" style={{ padding: '2rem' }}>
          {error && (
            <div style={{ padding: '0.75rem 1rem', background: 'var(--color-danger-light)', color: '#dc2626', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem', fontSize: '0.8125rem', fontWeight: 500 }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>E-post</label>
              <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="navn@atea.no" required />
            </div>
            <div className="form-group">
              <label>Passord</label>
              <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Skriv inn passord" required />
            </div>
            <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{ width: '100%', marginTop: '0.5rem' }}>
              {loading ? 'Vennligst vent...' : 'Logg inn'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
