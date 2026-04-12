import { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';
import { DashboardLayout } from '../../components/Layout.js';
import type { WorkshopSummary } from '../../../shared/types.js';

interface UserData {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'USER';
  assignedWorkshopId: string | null;
  assignedWorkshopTitle: string | null;
  createdAt: string;
}

export function Users() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [workshops, setWorkshops] = useState<WorkshopSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<'ADMIN' | 'USER'>('USER');
  const [formWorkshopId, setFormWorkshopId] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<UserData[]>('/auth/users'),
      api.get<WorkshopSummary[]>('/workshops'),
    ]).then(([u, w]) => {
      setUsers(u);
      setWorkshops(w.filter(ws => ws.status !== 'ARCHIVED'));
    }).finally(() => setLoading(false));
  }, []);

  const flash = (msg: string) => { setFormSuccess(msg); setTimeout(() => setFormSuccess(''), 3000); };

  const resetForm = () => {
    setFormName(''); setFormEmail(''); setFormPassword('');
    setFormRole('USER'); setFormWorkshopId(''); setFormError('');
    setShowCreate(false); setEditingId(null);
  };

  const startEdit = (user: UserData) => {
    setEditingId(user.id);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormPassword('');
    setFormRole(user.role);
    setFormWorkshopId(user.assignedWorkshopId || '');
    setFormError('');
    setShowCreate(false);
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    try {
      const user = await api.post<UserData>('/auth/users', {
        name: formName,
        email: formEmail,
        password: formPassword,
        role: formRole,
        assignedWorkshopId: formRole === 'USER' ? (formWorkshopId || null) : null,
      });
      setUsers(prev => [user, ...prev]);
      resetForm();
      flash('Bruker opprettet!');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Feil ved opprettelse');
    }
  };

  const updateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setFormError('');
    try {
      const data: Record<string, unknown> = {
        name: formName,
        email: formEmail,
        role: formRole,
        assignedWorkshopId: formRole === 'USER' ? (formWorkshopId || null) : null,
      };
      if (formPassword) data.password = formPassword;

      const user = await api.patch<UserData>(`/auth/users/${editingId}`, data);
      setUsers(prev => prev.map(u => u.id === editingId ? { ...u, ...user } : u));
      resetForm();
      flash('Bruker oppdatert!');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Feil ved oppdatering');
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Slette denne brukeren?')) return;
    try {
      await api.delete(`/auth/users/${userId}`);
      setUsers(prev => prev.filter(u => u.id !== userId));
      flash('Bruker slettet');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Feil ved sletting');
    }
  };

  const roleBadge = (role: string) =>
    role === 'ADMIN' ? 'badge-active' : 'badge-draft';
  const roleLabel = (role: string) =>
    role === 'ADMIN' ? 'Admin' : 'Bruker';

  return (
    <DashboardLayout>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>Brukere</h1>
            <p>Administrer tilgang til plattformen</p>
          </div>
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowCreate(true); }}>
            + Ny bruker
          </button>
        </div>
      </div>

      {formSuccess && (
        <div style={{ padding: '0.5rem 1rem', background: 'var(--color-success-light)', color: '#059669', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.8125rem', fontWeight: 500 }}>
          {'\u2713'} {formSuccess}
        </div>
      )}

      {/* Create / Edit form */}
      {(showCreate || editingId) && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <h3>{editingId ? 'Rediger bruker' : 'Opprett ny bruker'}</h3>
            <button className="btn btn-ghost btn-sm" onClick={resetForm}>&times;</button>
          </div>

          {formError && (
            <div style={{ padding: '0.75rem 1rem', background: 'var(--color-danger-light)', color: '#dc2626', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.8125rem' }}>
              {formError}
            </div>
          )}

          <form onSubmit={editingId ? updateUser : createUser}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Navn</label>
                <input className="form-input" value={formName} onChange={e => setFormName(e.target.value)} placeholder="Fullt navn" required />
              </div>
              <div className="form-group">
                <label>E-post</label>
                <input className="form-input" type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="navn@example.no" required />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>{editingId ? 'Nytt passord (la tomt for a beholde)' : 'Passord'}</label>
                <input className="form-input" type="password" value={formPassword} onChange={e => setFormPassword(e.target.value)} placeholder="Passord" required={!editingId} />
              </div>
              <div className="form-group">
                <label>Rolle</label>
                <select className="form-input" value={formRole} onChange={e => setFormRole(e.target.value as 'ADMIN' | 'USER')}>
                  <option value="ADMIN">Admin - Full tilgang</option>
                  <option value="USER">Bruker - Begrenset tilgang</option>
                </select>
              </div>
            </div>
            {formRole === 'USER' && (
              <div className="form-group">
                <label>Tildelt workshop</label>
                <select className="form-input" value={formWorkshopId} onChange={e => setFormWorkshopId(e.target.value)}>
                  <option value="">-- Ingen workshop tildelt --</option>
                  {workshops.map(w => (
                    <option key={w.id} value={w.id}>{w.title}{w.customerName ? ` (${w.customerName})` : ''}</option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" type="button" onClick={resetForm}>Avbryt</button>
              <button className="btn btn-primary" type="submit">{editingId ? 'Lagre endringer' : 'Opprett bruker'}</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : users.length === 0 ? (
        <div className="card empty-state">
          <h3>Ingen brukere enna</h3>
          <p>Opprett din forste bruker for a komme i gang</p>
        </div>
      ) : (
        <div className="card">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>Navn</th>
                <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>E-post</th>
                <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>Rolle</th>
                <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>Tildelt workshop</th>
                <th style={{ padding: '0.75rem 0.5rem', fontWeight: 600, textAlign: 'right' }}>Handlinger</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500 }}>{u.name}</td>
                  <td style={{ padding: '0.75rem 0.5rem', color: 'var(--color-text-secondary)' }}>{u.email}</td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>
                    <span className={`badge ${roleBadge(u.role)}`}>{roleLabel(u.role)}</span>
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', color: 'var(--color-text-secondary)' }}>
                    {u.role === 'USER' ? (u.assignedWorkshopTitle || '-- Ikke tildelt --') : '--'}
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => startEdit(u)} style={{ marginRight: '0.25rem' }}>Rediger</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => deleteUser(u.id)} style={{ color: '#dc2626' }}>Slett</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  );
}
