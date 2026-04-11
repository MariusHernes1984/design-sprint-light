import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { DashboardLayout } from '../../components/Layout.js';
import { STEP_LABELS } from '../../../shared/types.js';
import type { WorkshopSummary } from '../../../shared/types.js';

export function Archive() {
  const navigate = useNavigate();
  const [workshops, setWorkshops] = useState<WorkshopSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    api.get<WorkshopSummary[]>('/workshops')
      .then(all => setWorkshops(all.filter(w => w.status === 'ARCHIVED')))
      .finally(() => setLoading(false));
  }, []);

  const restoreWorkshop = async (id: string) => {
    setRestoring(id);
    try {
      await api.patch(`/workshops/${id}`, { status: 'COMPLETED' });
      setWorkshops(prev => prev.filter(w => w.id !== id));
    } finally {
      setRestoring(null);
    }
  };

  const deleteWorkshop = async (id: string) => {
    if (!confirm('Er du sikker pa at du vil slette denne workshopen permanent? Denne handlingen kan ikke angres.')) return;
    await api.delete(`/workshops/${id}/permanent`);
    setWorkshops(prev => prev.filter(w => w.id !== id));
  };

  return (
    <DashboardLayout>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>Arkiv</h1>
            <p>Arkiverte workshops</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : workshops.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-icon">{'\u{1F4E6}'}</div>
          <h3>Ingen arkiverte workshops</h3>
          <p>Workshops du arkiverer vil vises her</p>
          <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
            Tilbake til oversikt
          </button>
        </div>
      ) : (
        <>
          <div className="section-title">
            Arkiverte workshops <span className="count">{workshops.length}</span>
          </div>
          <div className="card-grid">
            {workshops.map(w => (
              <div key={w.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.125rem' }}>{w.title}</h3>
                    {w.customerName && <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>{w.customerName}</p>}
                  </div>
                  <span className="badge badge-neutral">Arkivert</span>
                </div>

                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                  <span>{w.participantCount} deltakere</span>
                  <span>{w.challengeCount} utfordringer</span>
                  <span>{STEP_LABELS[w.currentStep]}</span>
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                  Opprettet: {new Date(w.createdAt).toLocaleDateString('nb-NO')}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => restoreWorkshop(w.id)}
                    disabled={restoring === w.id}
                    style={{ flex: 1 }}
                  >
                    {restoring === w.id ? 'Gjenoppretter...' : 'Gjenopprett'}
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => navigate(`/workshop/${w.id}/manage`)}
                    style={{ flex: 1 }}
                  >
                    Se innhold
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
