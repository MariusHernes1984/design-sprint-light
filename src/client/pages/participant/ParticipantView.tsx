import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.js';
import { api } from '../../lib/api.js';
import { connectSocket, joinWorkshop as joinWsRoom } from '../../lib/socket.js';
import { useSocketEvent } from '../../hooks/useSocket.js';
import { StepIndicator } from '../../components/StepIndicator.js';
import { PostIt } from '../../components/PostIt.js';
import { Matrix2x2 } from '../../components/Matrix2x2.js';
import { STEP_LABELS, SESSION_STEP_ORDER } from '../../../shared/types.js';
import { generateReport } from '../../utils/generateReport.js';
import type { WorkshopStep, SessionData, ChallengeData, ClusterData, HkvQuestionData, IdeaData } from '../../../shared/types.js';

const STEP_INFO: Record<WorkshopStep, { icon: string; title: string; description: string }> = {
  PREWORK: { icon: '\u270D\uFE0F', title: 'Innsamling av utfordringer', description: 'Fasilitator samler inn utfordringer fra deltakerne.' },
  SESSIONS: { icon: '\ud83d\udcac', title: 'Utfordringer', description: 'Utfordringer fra gruppediskusjoner samles inn.' },
  CLUSTERING: { icon: '\ud83d\udccb', title: 'Klynging', description: 'Utfordringene grupperes i temaklynger.' },
  HKV: { icon: '\u2753', title: 'HKV-sporsmaal', description: '"Hvordan kan vi..."-sporsmaal formuleres basert pa klyngene.' },
  IDEATION: { icon: '\ud83d\udca1', title: 'Idemyldring', description: 'Ideer og losningsforslag samles inn.' },
  PRIORITIZATION: { icon: '\u2b50', title: 'Prioritering', description: 'Ideene vurderes etter nytteverdi og gjennomforbarhet.' },
  MATRIX: { icon: '\ud83d\udcca', title: 'Prioriteringsmatrise', description: 'Se hvor ideene er plassert i prioriteringsmatrisen.' },
  CANVAS: { icon: '\ud83d\udcc4', title: 'Idecanvas', description: 'De beste ideene utdypes med problemstilling, losning og forste steg.' },
  RESULTS: { icon: '\ud83c\udfc6', title: 'Resultater', description: 'Komplett oppsummering av workshoppen.' },
};

export function ParticipantView() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [workshopTitle, setWorkshopTitle] = useState('');
  const [challenges, setChallenges] = useState<ChallengeData[]>([]);
  const [clusters, setClusters] = useState<ClusterData[]>([]);
  const [hkvQuestions, setHkvQuestions] = useState<HkvQuestionData[]>([]);
  const [ideas, setIdeas] = useState<IdeaData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSummary, setShowSummary] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [detailIdeaId, setDetailIdeaId] = useState<string | null>(null);
  const [detailCanvas, setDetailCanvas] = useState<{ problemStatement: string; solutionSummary: string; dataNeeds: string; stakeholders: string | null; firstSteps: string; expectedOutcome: string | null } | null>(null);

  // Determine active session and its current step
  const activeSession = sessions.find(s => s.id === activeSessionId);
  const currentStep: WorkshopStep = activeSession?.currentStep || 'SESSIONS';

  // Filter data by active session
  const sessionChallenges = challenges.filter(c => c.sessionId === activeSessionId);
  const sessionClusters = clusters.filter(c => c.sessionId === activeSessionId);
  const sessionHkv = hkvQuestions.filter(h => h.sessionId === activeSessionId);
  const sessionIdeas = ideas.filter(i => i.sessionId === activeSessionId);
  const sessionApprovedHkv = sessionHkv.filter(h => h.isApproved);
  const sessionScoredIdeas = sessionIdeas.filter(i => i.score);
  const sessionPrioritizedIdeas = sessionIdeas.filter(i => i.score?.matrixQuadrant === 'PRIORITER_NA');

  // All data for summary view
  const allScoredIdeas = ideas.filter(i => i.score);
  const allPrioritizedIdeas = ideas.filter(i => i.score?.matrixQuadrant === 'PRIORITER_NA');

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get<{ title: string; currentStep: WorkshopStep; sessions: SessionData[] }>(`/workshops/${id}`),
      api.get<ChallengeData[]>(`/workshops/${id}/challenges`),
      api.get<ClusterData[]>(`/workshops/${id}/clusters`),
      api.get<HkvQuestionData[]>(`/workshops/${id}/hkv`),
      api.get<IdeaData[]>(`/workshops/${id}/ideas`),
    ]).then(([ws, ch, cl, hk, ideas]) => {
      setWorkshopTitle(ws.title);
      setSessions(ws.sessions || []);
      // Select the active session, or the first one
      const active = ws.sessions?.find(s => s.isActive) || ws.sessions?.[0];
      if (active) setActiveSessionId(active.id);
      setChallenges(ch);
      setClusters(cl);
      setHkvQuestions(hk);
      setIdeas(ideas);
      setLoading(false);

      connectSocket();
      joinWsRoom(id);
    });
  }, [id]);

  // Listen for session step changes
  useSocketEvent('session:stepChanged', useCallback((data: { sessionId: string; step: WorkshopStep }) => {
    setSessions(prev => prev.map(s =>
      s.id === data.sessionId ? { ...s, currentStep: data.step } : s
    ));
  }, []));

  // Listen for session activation
  useSocketEvent('workshop:sessionActivated', useCallback((data: { sessionId: string }) => {
    setActiveSessionId(data.sessionId);
    setShowSummary(false);
    setSessions(prev => prev.map(s => ({ ...s, isActive: s.id === data.sessionId })));
  }, []));

  useSocketEvent('challenge:added', useCallback((data: ChallengeData) => {
    setChallenges(prev => [...prev, data]);
  }, []));

  useSocketEvent('idea:added', useCallback((data: IdeaData) => {
    setIdeas(prev => [...prev, data]);
  }, []));

  useSocketEvent('cluster:updated', useCallback(() => {
    if (id) api.get<ClusterData[]>(`/workshops/${id}/clusters`).then(setClusters);
  }, [id]));

  useSocketEvent('score:updated', useCallback(() => {
    if (id) api.get<IdeaData[]>(`/workshops/${id}/ideas`).then(setIdeas);
  }, [id]));

  // ---- Idea detail modal ----
  const QUAD_LABELS: Record<string, string> = {
    PRIORITER_NA: 'Prioriter na',
    STRATEGISKE_SATSINGER: 'Strategiske satsinger',
    RASKE_GEVINSTER: 'Raske gevinster',
    PARKER: 'Parker',
  };

  const openIdeaDetail = async (ideaId: string) => {
    setDetailIdeaId(ideaId);
    setDetailCanvas(null);
    try {
      const canvas = await api.get<{ problemStatement: string; solutionSummary: string; dataNeeds: string; stakeholders: string | null; firstSteps: string; expectedOutcome: string | null }>(`/workshops/${id}/canvas/${ideaId}`);
      setDetailCanvas(canvas);
    } catch { /* no canvas */ }
  };

  const closeIdeaDetail = () => { setDetailIdeaId(null); setDetailCanvas(null); };

  const detailIdea = ideas.find(i => i.id === detailIdeaId);
  const detailHkv = detailIdea ? hkvQuestions.find(h => h.id === detailIdea.hkvQuestionId) : null;
  const detailCluster = detailHkv ? clusters.find(c => c.id === detailHkv.clusterId) : null;
  const viewPrioritizedIdeas = showSummary ? allPrioritizedIdeas : sessionPrioritizedIdeas;
  const detailCurrentIdx = detailIdea ? viewPrioritizedIdeas.findIndex(i => i.id === detailIdea.id) : -1;

  const navigateDetail = (dir: 1 | -1) => {
    const nextIdx = detailCurrentIdx + dir;
    if (nextIdx >= 0 && nextIdx < viewPrioritizedIdeas.length) {
      openIdeaDetail(viewPrioritizedIdeas[nextIdx].id);
    }
  };

  const downloadPdf = async () => {
    if (!id) return;
    setPdfLoading(true);
    try {
      const reportData = await api.get<Parameters<typeof generateReport>[0]>(`/workshops/${id}/report`);
      generateReport(reportData);
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setPdfLoading(false);
    }
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  const info = STEP_INFO[currentStep];

  return (
    <div className="participant-layout">
      {/* Top bar */}
      <header className="participant-topbar">
        <div className="participant-topbar-left">
          <div className="participant-topbar-logo">
            <div className="participant-topbar-logo-icon">DS</div>
            <span className="participant-topbar-title">Sprint Light</span>
          </div>
          <div className="participant-topbar-sep" />
          <span className="participant-topbar-workshop">{workshopTitle}</span>
        </div>
        <div className="participant-topbar-right">
          {activeSession && !showSummary && (
            <div className="participant-topbar-step">
              <span className="dot" />
              {activeSession.title} &mdash; {STEP_LABELS[currentStep]}
            </div>
          )}
          {showSummary && (
            <div className="participant-topbar-step">
              <span className="dot" />
              Samlet oppsummering
            </div>
          )}
        </div>
      </header>

      <div className="participant-content">
        {/* Session tabs */}
        {sessions.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {sessions.map(s => (
              <button
                key={s.id}
                className={`btn ${s.id === activeSessionId && !showSummary ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.875rem', padding: '0.375rem 0.75rem' }}
                onClick={() => { setActiveSessionId(s.id); setShowSummary(false); }}
              >
                {s.title}
                <span className="badge badge-neutral" style={{ marginLeft: '0.375rem', fontSize: '0.7rem' }}>
                  {STEP_LABELS[s.currentStep]}
                </span>
              </button>
            ))}
            <button
              className={`btn ${showSummary ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.875rem', padding: '0.375rem 0.75rem' }}
              onClick={() => setShowSummary(true)}
            >
              Samlet oppsummering
            </button>
          </div>
        )}

        {/* ====== SUMMARY VIEW ====== */}
        {showSummary && (
          <>
            <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid var(--color-accent)' }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '2rem' }}>{'\ud83c\udfc6'}</span>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>Samlet oppsummering</h3>
                    <p style={{ fontSize: '0.9375rem', color: 'var(--color-text-secondary)' }}>Resultater fra alle okter samlet.</p>
                  </div>
                </div>
                <button className="btn btn-primary" onClick={downloadPdf} disabled={pdfLoading} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {pdfLoading ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Genererer...</> : <>{'\ud83d\udcc4'} Last ned PDF</>}
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="stat-card">
                <div className="stat-label">Totalt utfordringer</div>
                <div className="stat-value">{challenges.length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Totalt ideer</div>
                <div className="stat-value">{ideas.length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Totalt klynger</div>
                <div className="stat-value">{clusters.length}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Prioritert</div>
                <div className="stat-value" style={{ color: 'var(--color-success)' }}>
                  {allPrioritizedIdeas.length}
                </div>
              </div>
            </div>

            {/* Per-session stats */}
            {sessions.map(s => {
              const sChallenges = challenges.filter(c => c.sessionId === s.id);
              const sIdeas = ideas.filter(i => i.sessionId === s.id);
              const sClusters = clusters.filter(c => c.sessionId === s.id);
              const sPrioritized = sIdeas.filter(i => i.score?.matrixQuadrant === 'PRIORITER_NA');
              return (
                <div key={s.id} className="card" style={{ marginBottom: '0.75rem' }}>
                  <h4 style={{ marginBottom: '0.5rem' }}>{s.title}</h4>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                    <span>{sChallenges.length} utfordringer</span>
                    <span>{sClusters.length} klynger</span>
                    <span>{sIdeas.length} ideer</span>
                    <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>{sPrioritized.length} prioritert</span>
                  </div>
                </div>
              );
            })}

            {allScoredIdeas.length > 0 && (
              <>
                <div className="section-title" style={{ marginTop: '1.5rem' }}>Samlet prioriteringsmatrise</div>
                <div className="matrix-container" style={{ marginBottom: '1.5rem' }}>
                  <Matrix2x2 ideas={allScoredIdeas} />
                </div>
              </>
            )}

            {allPrioritizedIdeas.length > 0 && (
              <>
                <div className="section-title">Alle prioriterte ideer <span style={{ fontSize: '0.8125rem', fontWeight: 400, color: 'var(--color-text-muted)' }}>&mdash; klikk for detaljer</span></div>
                {allPrioritizedIdeas.map(idea => {
                  const hkv = hkvQuestions.find(h => h.id === idea.hkvQuestionId);
                  return (
                    <div key={idea.id} className="card" style={{ marginBottom: '0.75rem', cursor: 'pointer', transition: 'box-shadow 0.15s' }} onClick={() => openIdeaDetail(idea.id)}
                      onMouseEnter={e => (e.currentTarget.style.boxShadow = 'var(--shadow-md)')}
                      onMouseLeave={e => (e.currentTarget.style.boxShadow = '')}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div className="idea-title" style={{ fontSize: '1rem' }}>{idea.title}</div>
                          {idea.description && <p className="idea-description" style={{ marginTop: '0.25rem' }}>{idea.description}</p>}
                        </div>
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '1.25rem', marginLeft: '0.75rem', flexShrink: 0 }}>{'\u203a'}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                        <span className="badge badge-high">Nytte: {idea.score?.utilityValue}</span>
                        <span className="badge badge-high">Gjennomf.: {idea.score?.feasibility}</span>
                        {hkv && <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>HKV: {hkv.fullText.slice(0, 50)}...</span>}
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            <div className="card" style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <p style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.25rem' }}>Takk for deltakelsen!</p>
              <p style={{ fontSize: '0.9375rem', color: 'var(--color-text-secondary)' }}>Resultater og neste steg deles med dere.</p>
            </div>
          </>
        )}

        {/* ====== SESSION VIEW ====== */}
        {!showSummary && activeSession && (
          <>
            <StepIndicator currentStep={currentStep} steps={SESSION_STEP_ORDER} />

            {/* Step info */}
            <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid var(--color-accent)' }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '2rem' }}>{info.icon}</span>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>{info.title}</h3>
                  <p style={{ fontSize: '0.9375rem', color: 'var(--color-text-secondary)' }}>{info.description}</p>
                </div>
              </div>
            </div>

            {/* ====== SESSIONS (Utfordringer) ====== */}
            {currentStep === 'SESSIONS' && (
              <>
                <div className="stat-card" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                  <div className="stat-label">Utfordringer i denne okten</div>
                  <div className="stat-value" style={{ fontSize: '2.5rem' }}>{sessionChallenges.length}</div>
                </div>

                {sessionChallenges.length > 0 ? (
                  <>
                    <div className="section-title">
                      Utfordringer <span className="count">{sessionChallenges.length}</span>
                    </div>
                    <div className="postit-grid">
                      {sessionChallenges.map((c, i) => (
                        <PostIt key={c.id} challenge={c} colorIndex={i} />
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="card participant-waiting">
                    <div className="participant-waiting-icon">{'\ud83d\udcac'}</div>
                    <h3>Okten er i gang</h3>
                    <p>Utfordringene fra diskusjonen vises her fortlopende.</p>
                  </div>
                )}
              </>
            )}

            {/* ====== CLUSTERING ====== */}
            {currentStep === 'CLUSTERING' && (
              <>
                {sessionClusters.length === 0 ? (
                  <div className="card participant-waiting">
                    <div className="participant-waiting-icon">{'\u2728'}</div>
                    <h3>Klynging pagar</h3>
                    <p>Utfordringene grupperes i temaklynger. Klyngene vises her nar de er klare.</p>
                  </div>
                ) : (
                  <>
                    <div className="section-title">
                      Klynger <span className="count">{sessionClusters.length}</span>
                    </div>
                    {sessionClusters.map(cl => (
                      <div key={cl.id} className="cluster-card">
                        <div className="cluster-header">
                          <span className="cluster-name">{cl.name}</span>
                          <span className="badge badge-neutral">{cl.challenges.length} utfordringer</span>
                        </div>
                        {cl.summary && <p className="cluster-summary">{cl.summary}</p>}
                        <div className="postit-grid">
                          {cl.challenges.map((c, i) => (
                            <PostIt key={c.id} challenge={c} colorIndex={i} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}

            {/* ====== HKV ====== */}
            {currentStep === 'HKV' && (
              <>
                {sessionApprovedHkv.length === 0 ? (
                  <div className="card participant-waiting">
                    <div className="participant-waiting-icon">{'\ud83d\udcdd'}</div>
                    <h3>HKV-sporsmaal formuleres</h3>
                    <p>"Hvordan kan vi"-sporsmaal formuleres. De vises her nar de er godkjent.</p>
                  </div>
                ) : (
                  <>
                    <div className="section-title">
                      Godkjente HKV-sporsmaal <span className="count">{sessionApprovedHkv.length}</span>
                    </div>
                    {sessionApprovedHkv.map(h => (
                      <div key={h.id} className="hkv-card">
                        <div className="hkv-text" style={{ fontSize: '1.0625rem' }}>{h.fullText}</div>
                        <div className="hkv-meta">
                          <span className="badge badge-active">{'\u2713'} Godkjent</span>
                          {h.isAiGenerated && <span className="badge badge-ai">{'\u2728'} AI</span>}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}

            {/* ====== IDEATION ====== */}
            {currentStep === 'IDEATION' && (
              <>
                <div className="stat-card" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                  <div className="stat-label">Ideer innsamlet</div>
                  <div className="stat-value" style={{ fontSize: '2.5rem' }}>{sessionIdeas.length}</div>
                </div>

                {sessionIdeas.length > 0 ? (
                  <>
                    {sessionApprovedHkv.map(h => {
                      const hkvIdeas = sessionIdeas.filter(i => i.hkvQuestionId === h.id);
                      if (hkvIdeas.length === 0) return null;
                      return (
                        <div key={h.id} style={{ marginBottom: '1.5rem' }}>
                          <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-accent)', marginBottom: '0.5rem' }}>
                            {h.fullText}
                          </p>
                          {hkvIdeas.map(idea => (
                            <div key={idea.id} className="idea-card">
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                  <div className="idea-title">{idea.title}</div>
                                  {idea.description && <div className="idea-description">{idea.description}</div>}
                                </div>
                                {idea.isAiGenerated && <span className="badge badge-ai">{'\u2728'} AI</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <div className="card participant-waiting">
                    <div className="participant-waiting-icon">{'\ud83d\udca1'}</div>
                    <h3>Idemyldring pagar</h3>
                    <p>Ideene vises her fortlopende.</p>
                  </div>
                )}
              </>
            )}

            {/* ====== PRIORITIZATION ====== */}
            {currentStep === 'PRIORITIZATION' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div className="stat-card">
                    <div className="stat-label">Ideer under vurdering</div>
                    <div className="stat-value">{sessionIdeas.length}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Vurdert</div>
                    <div className="stat-value">{sessionScoredIdeas.length}</div>
                  </div>
                </div>

                <div className="section-title">Ideer som vurderes</div>
                {sessionIdeas.map(idea => (
                  <div key={idea.id} className="idea-card" style={{ marginBottom: '0.5rem' }}>
                    <div className="idea-title">{idea.title}</div>
                    {idea.description && <div className="idea-description">{idea.description}</div>}
                    {idea.score && (
                      <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.5rem' }}>
                        <span className={`badge badge-${idea.score.utilityValue === 'HIGH' ? 'high' : idea.score.utilityValue === 'MEDIUM' ? 'medium' : 'low'}`}>
                          Nytte: {idea.score.utilityValue}
                        </span>
                        <span className={`badge badge-${idea.score.feasibility === 'HIGH' ? 'high' : idea.score.feasibility === 'MEDIUM' ? 'medium' : 'low'}`}>
                          Gjennomf.: {idea.score.feasibility}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}

            {/* ====== MATRIX ====== */}
            {currentStep === 'MATRIX' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div className="stat-card">
                    <div className="stat-label">Prioriter na</div>
                    <div className="stat-value" style={{ color: 'var(--color-success)' }}>
                      {sessionPrioritizedIdeas.length}
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Totalt vurdert</div>
                    <div className="stat-value">{sessionScoredIdeas.length}</div>
                  </div>
                </div>

                <div className="matrix-container">
                  <Matrix2x2 ideas={sessionScoredIdeas} />
                </div>
              </>
            )}

            {/* ====== CANVAS ====== */}
            {currentStep === 'CANVAS' && (
              <>
                {sessionPrioritizedIdeas.length > 0 ? (
                  <>
                    <div className="section-title">Prioriterte ideer under utdypning</div>
                    {sessionPrioritizedIdeas.map(idea => (
                      <div key={idea.id} className="card" style={{ marginBottom: '0.75rem' }}>
                        <div className="idea-title" style={{ fontSize: '1rem' }}>{idea.title}</div>
                        {idea.description && <p className="idea-description" style={{ marginTop: '0.25rem' }}>{idea.description}</p>}
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                          <span className="badge badge-high">Nytte: {idea.score?.utilityValue}</span>
                          <span className="badge badge-high">Gjennomf.: {idea.score?.feasibility}</span>
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="card participant-waiting">
                    <div className="participant-waiting-icon">{'\ud83d\udcdd'}</div>
                    <h3>Canvas utarbeides</h3>
                    <p>De prioriterte ideene utdypes av fasilitator.</p>
                  </div>
                )}
              </>
            )}

            {/* ====== RESULTS ====== */}
            {currentStep === 'RESULTS' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div className="stat-card">
                    <div className="stat-label">Utfordringer</div>
                    <div className="stat-value">{sessionChallenges.length}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Ideer</div>
                    <div className="stat-value">{sessionIdeas.length}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Klynger</div>
                    <div className="stat-value">{sessionClusters.length}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Prioritert</div>
                    <div className="stat-value" style={{ color: 'var(--color-success)' }}>
                      {sessionPrioritizedIdeas.length}
                    </div>
                  </div>
                </div>

                <div className="section-title">Prioriteringsmatrise</div>
                <div className="matrix-container" style={{ marginBottom: '1.5rem' }}>
                  <Matrix2x2 ideas={sessionScoredIdeas} />
                </div>

                <div className="section-title">Prioriterte ideer <span style={{ fontSize: '0.8125rem', fontWeight: 400, color: 'var(--color-text-muted)' }}>&mdash; klikk for detaljer</span></div>
                {sessionPrioritizedIdeas.map(idea => {
                  const hkv = hkvQuestions.find(h => h.id === idea.hkvQuestionId);
                  return (
                    <div key={idea.id} className="card" style={{ marginBottom: '0.75rem', cursor: 'pointer', transition: 'box-shadow 0.15s' }} onClick={() => openIdeaDetail(idea.id)}
                      onMouseEnter={e => (e.currentTarget.style.boxShadow = 'var(--shadow-md)')}
                      onMouseLeave={e => (e.currentTarget.style.boxShadow = '')}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div className="idea-title" style={{ fontSize: '1rem' }}>{idea.title}</div>
                          {idea.description && <p className="idea-description" style={{ marginTop: '0.25rem' }}>{idea.description}</p>}
                        </div>
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '1.25rem', marginLeft: '0.75rem', flexShrink: 0 }}>{'\u203a'}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                        {idea.score && <span className="badge badge-high">Nytte: {idea.score.utilityValue}</span>}
                        {idea.score && <span className="badge badge-high">Gjennomf.: {idea.score.feasibility}</span>}
                        {hkv && <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>HKV: {hkv.fullText.slice(0, 50)}...</span>}
                      </div>
                    </div>
                  );
                })}

                <div className="card" style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                  <p style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.25rem' }}>Okt fullfort!</p>
                  <p style={{ fontSize: '0.9375rem', color: 'var(--color-text-secondary)' }}>Se "Samlet oppsummering" for resultater fra alle okter.</p>
                </div>
              </>
            )}
          </>
        )}

        {/* No sessions fallback */}
        {!showSummary && !activeSession && (
          <div className="card participant-waiting">
            <div className="participant-waiting-icon">{'\u23f3'}</div>
            <h3>Venter pa at fasilitator starter en okt</h3>
            <p>Workshoppen vil starte snart.</p>
          </div>
        )}
      </div>

      {/* ====== IDEA DETAIL MODAL ====== */}
      {detailIdea && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeIdeaDetail(); }}>
          <div className="modal-content">
            <div className="modal-header">
              <h2>{detailIdea.title}</h2>
              <button className="modal-close" onClick={closeIdeaDetail}>&times;</button>
            </div>

            <div className="modal-body">
              {detailIdea.description && (
                <div className="modal-section">
                  <div className="modal-section-label"><span className="section-icon">{'\ud83d\udca1'}</span> Idebeskrivelse</div>
                  <div className="modal-section-content">
                    <p>{detailIdea.description}</p>
                  </div>
                </div>
              )}

              {detailCluster && (
                <div className="modal-section">
                  <div className="modal-section-label"><span className="section-icon">{'\ud83d\udccb'}</span> Utfordringer fra klynge: {detailCluster.name}</div>
                  <div className="modal-section-content">
                    <ul className="modal-challenge-list">
                      {detailCluster.challenges.map(c => (
                        <li key={c.id} className="modal-challenge-item">
                          <span className="modal-challenge-bullet">&bull;</span>
                          {c.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {detailHkv && (
                <div className="modal-section">
                  <div className="modal-section-label"><span className="section-icon">{'\u2753'}</span> HKV-sporsmaal</div>
                  <div className="modal-section-content" style={{ borderLeft: '3px solid var(--color-accent)' }}>
                    <p style={{ fontWeight: 600, fontStyle: 'italic' }}>{detailHkv.fullText}</p>
                  </div>
                </div>
              )}

              {detailIdea.score && (
                <div className="modal-section">
                  <div className="modal-section-label"><span className="section-icon">{'\u2b50'}</span> Prioritering</div>
                  <div className="modal-section-content">
                    <div className="modal-score-grid">
                      <div className="modal-score-item">
                        <span className="score-label">Nytteverdi</span>
                        <span className="score-value">
                          <span className={`badge badge-${detailIdea.score.utilityValue === 'HIGH' ? 'high' : detailIdea.score.utilityValue === 'MEDIUM' ? 'medium' : 'low'}`}>
                            {detailIdea.score.utilityValue}
                          </span>
                        </span>
                      </div>
                      <div className="modal-score-item">
                        <span className="score-label">Gjennomforbarhet</span>
                        <span className="score-value">
                          <span className={`badge badge-${detailIdea.score.feasibility === 'HIGH' ? 'high' : detailIdea.score.feasibility === 'MEDIUM' ? 'medium' : 'low'}`}>
                            {detailIdea.score.feasibility}
                          </span>
                        </span>
                      </div>
                      <div className="modal-score-item">
                        <span className="score-label">Kvadrant</span>
                        <span className="score-value" style={{ color: 'var(--color-accent)' }}>{QUAD_LABELS[detailIdea.score.matrixQuadrant] || detailIdea.score.matrixQuadrant}</span>
                      </div>
                      {detailIdea.score.timeHorizon && (
                        <div className="modal-score-item">
                          <span className="score-label">Tidshorisont</span>
                          <span className="score-value">{detailIdea.score.timeHorizon}</span>
                        </div>
                      )}
                    </div>
                    {detailIdea.score.dataAvailability && (
                      <div style={{ marginTop: '0.625rem', fontSize: '0.875rem' }}>
                        <span style={{ fontWeight: 600 }}>Data: </span>{detailIdea.score.dataAvailability}
                      </div>
                    )}
                    {detailIdea.score.systemReadiness && (
                      <div style={{ fontSize: '0.875rem' }}>
                        <span style={{ fontWeight: 600 }}>System: </span>{detailIdea.score.systemReadiness}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {detailCanvas && (
                <div className="modal-section">
                  <div className="modal-section-label"><span className="section-icon">{'\ud83d\udcc4'}</span> Idecanvas</div>
                  <div className="modal-section-content">
                    <div className="modal-canvas-grid">
                      {detailCanvas.problemStatement && (
                        <div className="modal-canvas-field">
                          <span className="field-label">Problemstilling</span>
                          <span className="field-value">{detailCanvas.problemStatement}</span>
                        </div>
                      )}
                      {detailCanvas.solutionSummary && (
                        <div className="modal-canvas-field">
                          <span className="field-label">Losningsbeskrivelse</span>
                          <span className="field-value">{detailCanvas.solutionSummary}</span>
                        </div>
                      )}
                      {detailCanvas.dataNeeds && (
                        <div className="modal-canvas-field">
                          <span className="field-label">Databehov</span>
                          <span className="field-value">{detailCanvas.dataNeeds}</span>
                        </div>
                      )}
                      {detailCanvas.stakeholders && (
                        <div className="modal-canvas-field">
                          <span className="field-label">Interessenter</span>
                          <span className="field-value">{detailCanvas.stakeholders}</span>
                        </div>
                      )}
                      {detailCanvas.firstSteps && (
                        <div className="modal-canvas-field">
                          <span className="field-label">Forste steg</span>
                          <span className="field-value">{detailCanvas.firstSteps}</span>
                        </div>
                      )}
                      {detailCanvas.expectedOutcome && (
                        <div className="modal-canvas-field">
                          <span className="field-label">Forventet effekt</span>
                          <span className="field-value">{detailCanvas.expectedOutcome}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {!detailCanvas && (
                <div className="modal-section">
                  <div className="modal-section-label"><span className="section-icon">{'\ud83d\udcc4'}</span> Idecanvas</div>
                  <div className="modal-section-content" style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                    <p>Ingen canvas utfylt for denne ideen enna.</p>
                  </div>
                </div>
              )}
            </div>

            {viewPrioritizedIdeas.length > 1 && (
              <div className="modal-nav">
                <button className="btn btn-secondary btn-sm" disabled={detailCurrentIdx <= 0} onClick={() => navigateDetail(-1)}>&larr; Forrige</button>
                <span className="modal-nav-counter">{detailCurrentIdx + 1} av {viewPrioritizedIdeas.length}</span>
                <button className="btn btn-secondary btn-sm" disabled={detailCurrentIdx >= viewPrioritizedIdeas.length - 1} onClick={() => navigateDetail(1)}>Neste &rarr;</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
