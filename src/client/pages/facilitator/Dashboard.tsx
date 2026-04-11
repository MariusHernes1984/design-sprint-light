import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { DashboardLayout } from '../../components/Layout.js';
import { STEP_LABELS } from '../../../shared/types.js';
import type { WorkshopSummary } from '../../../shared/types.js';

export function Dashboard() {
  const navigate = useNavigate();
  const [workshops, setWorkshops] = useState<WorkshopSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCustomer, setNewCustomer] = useState('');
  const [newSessions, setNewSessions] = useState('');

  useEffect(() => {
    api.get<WorkshopSummary[]>('/workshops')
      .then(setWorkshops)
      .finally(() => setLoading(false));
  }, []);

  const createWorkshop = async (e: React.FormEvent) => {
    e.preventDefault();
    const sessions = newSessions
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
      .map(title => ({ title }));

    const workshop = await api.post<WorkshopSummary>('/workshops', {
      title: newTitle,
      customerName: newCustomer || null,
      sessions: sessions.length > 0 ? sessions : [
        { title: 'Administrasjon og gebyr/okonomi' },
        { title: 'Drift og tilsyn' },
        { title: 'Vei og trafikk' },
        { title: 'Prosjekt og planlegging' },
      ],
    });
    navigate(`/workshop/${workshop.id}/manage`);
  };

  const activeWorkshops = workshops.filter(w => w.status === 'ACTIVE' || w.status === 'DRAFT');
  const completedWorkshops = workshops.filter(w => w.status === 'COMPLETED');
  const archivedCount = workshops.filter(w => w.status === 'ARCHIVED').length;

  const archiveWorkshop = async (e: React.MouseEvent, workshopId: string) => {
    e.stopPropagation();
    if (!confirm('Arkivere denne workshopen?')) return;
    await api.delete(`/workshops/${workshopId}`);
    setWorkshops(prev => prev.map(w => w.id === workshopId ? { ...w, status: 'ARCHIVED' as const } : w));
  };

  return (
    <DashboardLayout>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>Oversikt</h1>
            <p>Administrer dine workshops</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + Ny workshop
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="stat-card">
          <div className="stat-label">Totalt workshops</div>
          <div className="stat-value">{workshops.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Aktive</div>
          <div className="stat-value">
            {activeWorkshops.length}
            <span className="stat-change positive">Pagaende</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Totalt deltakere</div>
          <div className="stat-value">{workshops.reduce((sum, w) => sum + w.participantCount, 0)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Utfordringer samlet</div>
          <div className="stat-value">{workshops.reduce((sum, w) => sum + w.challengeCount, 0)}</div>
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <h3>Opprett ny workshop</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>&times;</button>
          </div>
          <form onSubmit={createWorkshop}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Tittel</label>
                <input className="form-input" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="f.eks. AI-workshop Tonsberg" required />
              </div>
              <div className="form-group">
                <label>Kundenavn</label>
                <input className="form-input" value={newCustomer} onChange={e => setNewCustomer(e.target.value)} placeholder="f.eks. Tonsberg kommune" />
              </div>
            </div>
            <div className="form-group">
              <label>Okter (en per linje, la tomt for standard)</label>
              <textarea className="form-input" value={newSessions} onChange={e => setNewSessions(e.target.value)} placeholder={"Administrasjon og gebyr/okonomi\nDrift og tilsyn\nVei og trafikk\nProsjekt og planlegging"} rows={3} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" type="button" onClick={() => setShowCreate(false)}>Avbryt</button>
              <button className="btn btn-primary" type="submit">Opprett workshop</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : workshops.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-state-icon">{'\u2b50'}</div>
          <h3>Ingen workshops enna</h3>
          <p>Opprett din forste workshop for a komme i gang</p>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Ny workshop</button>
        </div>
      ) : (
        <>
          {activeWorkshops.length > 0 && (
            <>
              <div className="section-title">
                Aktive workshops <span className="count">{activeWorkshops.length}</span>
              </div>
              <div className="card-grid" style={{ marginBottom: '2rem' }}>
                {activeWorkshops.map(w => (
                  <WorkshopCard key={w.id} workshop={w} onClick={() => navigate(`/workshop/${w.id}/manage`)} onArchive={archiveWorkshop} />
                ))}
              </div>
            </>
          )}

          {completedWorkshops.length > 0 && (
            <>
              <div className="section-title">
                Fullforte <span className="count">{completedWorkshops.length}</span>
              </div>
              <div className="card-grid">
                {completedWorkshops.map(w => (
                  <WorkshopCard key={w.id} workshop={w} onClick={() => navigate(`/workshop/${w.id}/manage`)} onArchive={archiveWorkshop} />
                ))}
              </div>
            </>
          )}

          {archivedCount > 0 && (
            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
              <button className="btn btn-secondary" onClick={() => navigate('/archive')}>
                Se arkiv ({archivedCount})
              </button>
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
}

function WorkshopCard({ workshop: w, onClick, onArchive }: { workshop: WorkshopSummary; onClick: () => void; onArchive: (e: React.MouseEvent, id: string) => void }) {
  const statusBadge = w.status === 'ACTIVE' ? 'badge-active' : w.status === 'DRAFT' ? 'badge-draft' : 'badge-neutral';
  const statusLabel = w.status === 'DRAFT' ? 'Utkast' : w.status === 'ACTIVE' ? 'Aktiv' : w.status === 'COMPLETED' ? 'Fullfort' : 'Arkivert';

  return (
    <div className="card" style={{ cursor: 'pointer' }} onClick={onClick}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div>
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.125rem' }}>{w.title}</h3>
          {w.customerName && <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>{w.customerName}</p>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className={`badge ${statusBadge}`}>{statusLabel}</span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={(e) => onArchive(e, w.id)}
            title="Arkiver"
            style={{ padding: '0.25rem 0.375rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}
          >
            {'\u2610'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
        <span>{w.participantCount} deltakere</span>
        <span>{w.challengeCount} utfordringer</span>
        <span>{STEP_LABELS[w.currentStep]}</span>
      </div>

      <div className="join-code join-code-sm">{w.joinCode}</div>
    </div>
  );
}
