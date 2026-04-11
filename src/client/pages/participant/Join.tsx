import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.js';

export function Join() {
  const navigate = useNavigate();
  const { joinWorkshop } = useAuth();
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { workshopId } = await joinWorkshop(joinCode.toUpperCase(), 'Presentasjon');
      navigate(`/workshop/${workshopId}/participant`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke koble til');
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
          <h2 style={{ fontSize: '1.375rem', fontWeight: 700 }}>Presentasjonsvisning</h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginTop: '0.375rem' }}>
            Apne pa storskjerm/projektor for a vise workshoppen for deltakerne
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
              <label>Workshop-kode</label>
              <input
                className="form-input form-input-lg"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder="F.eks. K7X2M9"
                maxLength={6}
                style={{ textAlign: 'center', letterSpacing: '0.3em', fontWeight: 700, fontFamily: 'monospace' }}
                required
              />
            </div>
            <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{ width: '100%', marginTop: '0.5rem' }}>
              {loading ? 'Kobler til...' : 'Apne presentasjon'}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '1.25rem' }}>
            Denne visningen folger workshoppen i sanntid. Fasilitator styrer alt innhold fra sitt dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
