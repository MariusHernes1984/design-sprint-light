import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext.js';
import { api } from '../../lib/api.js';
import { connectSocket, joinWorkshop as joinWsRoom } from '../../lib/socket.js';
import { useSocketEvent } from '../../hooks/useSocket.js';
import { StepIndicator } from '../../components/StepIndicator.js';
import { PostIt } from '../../components/PostIt.js';
import { Matrix2x2 } from '../../components/Matrix2x2.js';
import { STEP_LABELS, SESSION_STEP_ORDER } from '../../../shared/types.js';
import type { WorkshopStep, SessionData, ChallengeData, ClusterData, HkvQuestionData, IdeaData } from '../../../shared/types.js';

export function UserWorkshopView() {
  const { user, logout } = useAuth();
  const workshopId = user?.assignedWorkshopId;

  const [workshopTitle, setWorkshopTitle] = useState('');
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [challenges, setChallenges] = useState<ChallengeData[]>([]);
  const [clusters, setClusters] = useState<ClusterData[]>([]);
  const [hkvQuestions, setHkvQuestions] = useState<HkvQuestionData[]>([]);
  const [ideas, setIdeas] = useState<IdeaData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSummary, setShowSummary] = useState(false);
  const [newChallengeText, setNewChallengeText] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const challengeInputRef = useRef<HTMLInputElement>(null);

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const currentStep: WorkshopStep = activeSession?.currentStep || 'SESSIONS';
  const sessionChallenges = challenges.filter(c => c.sessionId === activeSessionId);
  const sessionClusters = clusters.filter(c => c.sessionId === activeSessionId);
  const sessionHkv = hkvQuestions.filter(h => h.sessionId === activeSessionId);
  const sessionIdeas = ideas.filter(i => i.sessionId === activeSessionId);
  const sessionScoredIdeas = sessionIdeas.filter(i => i.score);
  const sessionPrioritizedIdeas = sessionIdeas.filter(i => i.score?.matrixQuadrant === 'PRIORITER_NA');

  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  useEffect(() => {
    if (!workshopId) { setLoading(false); return; }
    Promise.all([
      api.get<{ title: string; sessions: SessionData[] }>(`/workshops/${workshopId}`),
      api.get<ChallengeData[]>(`/workshops/${workshopId}/challenges`),
      api.get<ClusterData[]>(`/workshops/${workshopId}/clusters`),
      api.get<HkvQuestionData[]>(`/workshops/${workshopId}/hkv`),
      api.get<IdeaData[]>(`/workshops/${workshopId}/ideas`),
    ]).then(([ws, ch, cl, hk, ideas]) => {
      setWorkshopTitle(ws.title);
      setSessions(ws.sessions || []);
      const active = ws.sessions?.find(s => s.isActive) || ws.sessions?.[0];
      if (active) setActiveSessionId(active.id);
      setChallenges(ch);
      setClusters(cl);
      setHkvQuestions(hk);
      setIdeas(ideas);
      setLoading(false);
      connectSocket();
      joinWsRoom(workshopId);
    }).catch(() => setLoading(false));
  }, [workshopId]);

  // Live sync
  const refetchAll = useCallback(() => {
    if (!workshopId) return;
    Promise.all([
      api.get<ChallengeData[]>(`/workshops/${workshopId}/challenges`),
      api.get<ClusterData[]>(`/workshops/${workshopId}/clusters`),
      api.get<HkvQuestionData[]>(`/workshops/${workshopId}/hkv`),
      api.get<IdeaData[]>(`/workshops/${workshopId}/ideas`),
    ]).then(([ch, cl, hk, ideas]) => {
      setChallenges(ch);
      setClusters(cl);
      setHkvQuestions(hk);
      setIdeas(ideas);
    });
  }, [workshopId]);

  useSocketEvent('session:stepChanged', useCallback((data: { sessionId: string; step: WorkshopStep }) => {
    setSessions(prev => prev.map(s => s.id === data.sessionId ? { ...s, currentStep: data.step } : s));
  }, []));
  useSocketEvent('challenge:added', useCallback((data: ChallengeData) => { setChallenges(prev => [...prev, data]); }, []));
  useSocketEvent('idea:added', useCallback((data: IdeaData) => { setIdeas(prev => [...prev, data]); }, []));
  useSocketEvent('cluster:created', refetchAll);
  useSocketEvent('cluster:updated', refetchAll);
  useSocketEvent('hkv:added', refetchAll);
  useSocketEvent('hkv:updated', refetchAll);
  useSocketEvent('score:updated', refetchAll);
  useSocketEvent('ai:processing', refetchAll);

  const flash = (msg: string) => { setSubmitSuccess(msg); setTimeout(() => setSubmitSuccess(''), 2000); };

  const submitChallenge = async () => {
    if (!newChallengeText.trim() || !workshopId || !activeSessionId) return;
    await api.post(`/workshops/${workshopId}/challenges`, {
      text: newChallengeText.trim(),
      source: 'SESSION',
      sessionId: activeSessionId,
    });
    setNewChallengeText('');
    flash('Utfordring sendt inn!');
    challengeInputRef.current?.focus();
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  if (!workshopId) {
    return (
      <div className="full-layout">
        <div className="card" style={{ maxWidth: 400, textAlign: 'center', padding: '2rem' }}>
          <h2>Ingen workshop tildelt</h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>Kontakt administrator for a fa tildelt en workshop.</p>
          <button className="btn btn-secondary" onClick={logout}>Logg ut</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">DS</div>
          <div>
            <div className="sidebar-logo-text">Sprint Light</div>
            <div className="sidebar-logo-sub">{workshopTitle}</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Workshop</div>
          <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
            {activeSession && !showSummary && <>{activeSession.title} — {STEP_LABELS[currentStep]}</>}
            {showSummary && <>Samlet oppsummering</>}
          </div>
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.name}</div>
              <div className="sidebar-user-role">Bruker</div>
            </div>
          </div>
          <button className="sidebar-item" onClick={logout} style={{ marginTop: '0.5rem' }}>
            <span className="icon">{'\u2190'}</span>
            Logg ut
          </button>
        </div>
      </aside>

      <main className="main-content">
        {/* Session tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {sessions.map(s => (
            <button
              key={s.id}
              className={`btn ${s.id === activeSessionId && !showSummary ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setActiveSessionId(s.id); setShowSummary(false); }}
              style={{ fontSize: '0.875rem' }}
            >
              {s.title}
              <span className="badge badge-neutral" style={{ marginLeft: '0.375rem', fontSize: '0.7rem' }}>
                {STEP_LABELS[s.currentStep]}
              </span>
            </button>
          ))}
          <button
            className={`btn ${showSummary ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setShowSummary(true)}
            style={{ marginLeft: 'auto', fontSize: '0.875rem' }}
          >
            Samlet oppsummering
          </button>
        </div>

        {submitSuccess && (
          <div style={{ padding: '0.5rem 1rem', background: 'var(--color-success-light)', color: '#059669', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.8125rem', fontWeight: 500 }}>
            {'\u2713'} {submitSuccess}
          </div>
        )}

        {/* Summary view */}
        {showSummary && (
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>Samlet oppsummering</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              <div className="stat-card"><div className="stat-label">Utfordringer</div><div className="stat-value">{challenges.length}</div></div>
              <div className="stat-card"><div className="stat-label">Ideer</div><div className="stat-value">{ideas.length}</div></div>
              <div className="stat-card"><div className="stat-label">Prioritert</div><div className="stat-value" style={{ color: 'var(--color-success)' }}>{ideas.filter(i => i.score?.matrixQuadrant === 'PRIORITER_NA').length}</div></div>
            </div>
            {ideas.filter(i => i.score).length > 0 && (
              <>
                <div className="section-title">Samlet prioriteringsmatrise</div>
                <div className="matrix-container"><Matrix2x2 ideas={ideas.filter(i => i.score)} /></div>
              </>
            )}
          </div>
        )}

        {/* Session view */}
        {!showSummary && activeSessionId && (
          <div>
            <StepIndicator currentStep={currentStep} steps={SESSION_STEP_ORDER} />

            {/* Challenge input — always visible */}
            <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem', borderLeft: '4px solid var(--color-accent)' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Send inn utfordring</h3>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  ref={challengeInputRef}
                  className="form-input"
                  value={newChallengeText}
                  onChange={e => setNewChallengeText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitChallenge(); } }}
                  placeholder="Skriv en utfordring og trykk Enter..."
                  style={{ flex: 1 }}
                />
                <button className="btn btn-primary" onClick={submitChallenge} disabled={!newChallengeText.trim()}>Send</button>
              </div>
            </div>

            {/* Current step content (read-only) */}
            {(currentStep === 'SESSIONS' || currentStep === 'PREWORK') && (
              <div>
                <div className="section-title">Utfordringer <span className="count">{sessionChallenges.length}</span></div>
                {sessionChallenges.length === 0 ? (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Ingen utfordringer enna. Send inn den forste!</p>
                ) : (
                  <div className="postit-grid">
                    {sessionChallenges.map(c => <PostIt key={c.id} text={c.text} author={c.participantName} />)}
                  </div>
                )}
              </div>
            )}

            {currentStep === 'CLUSTERING' && sessionClusters.length > 0 && (
              <div>
                <div className="section-title">Klynger <span className="count">{sessionClusters.length}</span></div>
                {sessionClusters.map(cl => (
                  <div key={cl.id} className="card" style={{ marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.5rem' }}>{cl.name}</h3>
                    {cl.summary && <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>{cl.summary}</p>}
                    <div className="postit-grid">
                      {cl.challenges.map(c => <PostIt key={c.id} text={c.text} author={c.participantName} />)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(currentStep === 'HKV' || currentStep === 'IDEATION') && sessionHkv.filter(h => h.isApproved).length > 0 && (
              <div>
                <div className="section-title">HKV-sporsmaal</div>
                {sessionHkv.filter(h => h.isApproved).map(h => (
                  <div key={h.id} className="card" style={{ marginBottom: '0.75rem', borderLeft: '3px solid var(--color-accent)' }}>
                    <p style={{ fontStyle: 'italic', fontWeight: 500 }}>{h.fullText}</p>
                  </div>
                ))}
              </div>
            )}

            {(currentStep === 'IDEATION' || currentStep === 'PRIORITIZATION') && sessionIdeas.length > 0 && (
              <div>
                <div className="section-title">Ideer <span className="count">{sessionIdeas.length}</span></div>
                {sessionIdeas.map(idea => (
                  <div key={idea.id} className="idea-card" style={{ marginBottom: '0.5rem' }}>
                    <div className="idea-title">{idea.title}</div>
                    {idea.description && <p className="idea-description">{idea.description}</p>}
                  </div>
                ))}
              </div>
            )}

            {(currentStep === 'MATRIX' || currentStep === 'CANVAS' || currentStep === 'RESULTS') && sessionScoredIdeas.length > 0 && (
              <div>
                <div className="section-title">Prioriteringsmatrise</div>
                <div className="matrix-container"><Matrix2x2 ideas={sessionScoredIdeas} /></div>
                {sessionPrioritizedIdeas.length > 0 && (
                  <>
                    <div className="section-title" style={{ marginTop: '1.5rem' }}>Prioriterte ideer</div>
                    {sessionPrioritizedIdeas.map(idea => (
                      <div key={idea.id} className="idea-card" style={{ marginBottom: '0.5rem' }}>
                        <div className="idea-title">{idea.title}</div>
                        {idea.description && <p className="idea-description">{idea.description}</p>}
                        <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.375rem' }}>
                          <span className="badge badge-high">Nytte: {idea.score?.utilityValue}</span>
                          <span className="badge badge-high">Gjennomf.: {idea.score?.feasibility}</span>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
