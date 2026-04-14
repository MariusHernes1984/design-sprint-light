import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { connectSocket, joinWorkshop as joinWsRoom } from '../../lib/socket.js';
import { useSocketEvent } from '../../hooks/useSocket.js';
import { WorkshopLayout } from '../../components/Layout.js';
import { StepIndicator } from '../../components/StepIndicator.js';
import { PostIt } from '../../components/PostIt.js';
import { ScoreInput } from '../../components/ScoreInput.js';
import { Matrix2x2 } from '../../components/Matrix2x2.js';
import { SESSION_STEP_ORDER, STEP_LABELS } from '../../../shared/types.js';
import { generateReport } from '../../utils/generateReport.js';
import type { WorkshopStep, WorkshopDetail, ChallengeData, ClusterData, HkvQuestionData, IdeaData, ValueLevel } from '../../../shared/types.js';

const SESSION_STEP_DESCRIPTIONS: Record<WorkshopStep, { title: string; tip: string }> = {
  PREWORK: { title: 'Hjemmelekse', tip: '' },
  SESSIONS: { title: 'Utfordringer', tip: 'Skriv og trykk Enter for a legge til raskt.' },
  CLUSTERING: { title: 'Problemklynging', tip: 'Bruk dropdown pa hver lapp for a plassere den i en klynge, eller bruk AI.' },
  HKV: { title: 'Hvordan kan vi...?', tip: 'Hvert sporsmaal har tre deler: Problem, Gevinst og Begrensning.' },
  IDEATION: { title: 'Idemyldring', tip: 'Velg HKV, skriv tittel + Enter. Bruk AI for ekstra inspirasjon.' },
  PRIORITIZATION: { title: 'Prioritering', tip: 'Klikk H/M/L for a score ideene.' },
  MATRIX: { title: 'Prioriteringsmatrise', tip: 'Fokuser pa "Prioriter na"-kvadranten.' },
  CANVAS: { title: 'Idecanvas', tip: 'AI kan generere forsteutkast.' },
  RESULTS: { title: 'Resultater', tip: 'Oppsummering av denne okten.' },
};

export function WorkshopManage() {
  const { id } = useParams<{ id: string }>();
  const [workshop, setWorkshop] = useState<WorkshopDetail | null>(null);
  const [challenges, setChallenges] = useState<ChallengeData[]>([]);
  const [clusters, setClusters] = useState<ClusterData[]>([]);
  const [hkvQuestions, setHkvQuestions] = useState<HkvQuestionData[]>([]);
  const [ideas, setIdeas] = useState<IdeaData[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState<string | null>(null);

  // Session navigation
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  // Form states
  const [newChallengeText, setNewChallengeText] = useState('');
  const [newClusterName, setNewClusterName] = useState('');
  const [newHkvProblem, setNewHkvProblem] = useState('');
  const [newHkvBenefit, setNewHkvBenefit] = useState('');
  const [newHkvConstraint, setNewHkvConstraint] = useState('');
  const [newHkvClusterId, setNewHkvClusterId] = useState('');
  const [newIdeaTitle, setNewIdeaTitle] = useState('');
  const [newIdeaDesc, setNewIdeaDesc] = useState('');
  const [newIdeaHkvId, setNewIdeaHkvId] = useState('');
  const [canvasData, setCanvasData] = useState<Record<string, { problemStatement: string; solutionSummary: string; dataNeeds: string; firstSteps: string; expectedOutcome: string }>>({});
  const [showNewCluster, setShowNewCluster] = useState(false);
  const [detailIdeaId, setDetailIdeaId] = useState<string | null>(null);
  const [detailCanvas, setDetailCanvas] = useState<{ problemStatement: string; solutionSummary: string; dataNeeds: string; stakeholders: string | null; firstSteps: string; expectedOutcome: string | null } | null>(null);
  const [showNewHkv, setShowNewHkv] = useState(false);
  const [editingHkvId, setEditingHkvId] = useState<string | null>(null);
  const [editHkvProblem, setEditHkvProblem] = useState('');
  const [editHkvBenefit, setEditHkvBenefit] = useState('');
  const [editHkvConstraint, setEditHkvConstraint] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [postItTexts, setPostItTexts] = useState<string[]>([]);
  const [postItContext, setPostItContext] = useState<'hkv' | 'ideas'>('hkv');
  const [postItClusterId, setPostItClusterId] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const challengeInputRef = useRef<HTMLInputElement>(null);
  const ideaTitleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get<WorkshopDetail>(`/workshops/${id}`),
      api.get<ChallengeData[]>(`/workshops/${id}/challenges`),
      api.get<ClusterData[]>(`/workshops/${id}/clusters`),
      api.get<HkvQuestionData[]>(`/workshops/${id}/hkv`),
      api.get<IdeaData[]>(`/workshops/${id}/ideas`),
    ]).then(([ws, ch, cl, hk, ideas]) => {
      setWorkshop(ws);
      setChallenges(ch);
      setClusters(cl);
      setHkvQuestions(hk);
      setIdeas(ideas);
      setLoading(false);
      connectSocket();
      joinWsRoom(id);
      // Auto-select first session
      if (ws.sessions?.length > 0) {
        setSelectedSessionId(ws.sessions[0].id);
      }
    });
  }, [id]);

  useSocketEvent('challenge:added', useCallback((data: ChallengeData) => {
    setChallenges(prev => [...prev, data]);
  }, []));
  useSocketEvent('ai:processing', useCallback((data: { type: string; status: string }) => {
    setAiLoading(data.status === 'started' ? data.type : null);
  }, []));
  useSocketEvent('idea:added', useCallback((data: IdeaData) => {
    setIdeas(prev => [...prev, data]);
  }, []));
  useSocketEvent('session:stepChanged', useCallback((data: { sessionId: string; step: WorkshopStep }) => {
    setWorkshop(prev => {
      if (!prev) return prev;
      return { ...prev, sessions: prev.sessions.map(s => s.id === data.sessionId ? { ...s, currentStep: data.step } : s) };
    });
  }, []));

  const flash = (msg: string) => { setSubmitSuccess(msg); setTimeout(() => setSubmitSuccess(''), 2000); };

  // ---- Derived state for current session ----
  const selectedSession = workshop?.sessions?.find(s => s.id === selectedSessionId);
  const sessionStep = selectedSession?.currentStep || 'SESSIONS';
  const sessionChallenges = challenges.filter(c => c.sessionId === selectedSessionId);
  const sessionClusters = clusters.filter(c => c.sessionId === selectedSessionId);
  const sessionHkv = hkvQuestions.filter(h => h.sessionId === selectedSessionId);
  const sessionIdeas = ideas.filter(i => i.sessionId === selectedSessionId);
  const sessionApprovedHkv = sessionHkv.filter(h => h.isApproved);
  const unclusteredChallenges = sessionChallenges.filter(c => !c.clusterId);

  // ---- Session step navigation ----
  const changeSessionStep = async (step: WorkshopStep) => {
    if (!selectedSessionId) return;
    await api.patch(`/workshops/${id}/sessions/${selectedSessionId}/step`, { step });
    setWorkshop(prev => {
      if (!prev) return prev;
      return { ...prev, sessions: prev.sessions.map(s => s.id === selectedSessionId ? { ...s, currentStep: step } : s) };
    });
  };

  const nextStep = () => {
    const idx = SESSION_STEP_ORDER.indexOf(sessionStep);
    if (idx < SESSION_STEP_ORDER.length - 1) changeSessionStep(SESSION_STEP_ORDER[idx + 1]);
  };
  const prevStep = () => {
    const idx = SESSION_STEP_ORDER.indexOf(sessionStep);
    if (idx > 0) changeSessionStep(SESSION_STEP_ORDER[idx - 1]);
  };

  // ---- Challenge ----
  const submitChallenge = async () => {
    if (!newChallengeText.trim() || !selectedSessionId) return;
    await api.post(`/workshops/${id}/challenges`, {
      text: newChallengeText.trim(),
      source: 'SESSION',
      sessionId: selectedSessionId,
    });
    setNewChallengeText('');
    flash('Lagt til!');
    challengeInputRef.current?.focus();
  };
  const handleChallengeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitChallenge(); }
  };
  const deleteChallenge = async (challengeId: string) => {
    await api.delete(`/workshops/${id}/challenges/${challengeId}`);
    setChallenges(prev => prev.filter(c => c.id !== challengeId));
  };
  const assignToCluster = async (challengeId: string, clusterId: string | null) => {
    await api.patch(`/workshops/${id}/challenges/${challengeId}/cluster`, { clusterId });
    setChallenges(prev => prev.map(c => c.id === challengeId ? { ...c, clusterId } : c));
    const cl = await api.get<ClusterData[]>(`/workshops/${id}/clusters`);
    setClusters(cl);
  };

  // ---- Idea ----
  const [newIdeaClusterId, setNewIdeaClusterId] = useState('');
  const submitIdea = async () => {
    if (!newIdeaTitle.trim() || !newIdeaClusterId || !selectedSessionId) return;
    await api.post(`/workshops/${id}/ideas`, {
      title: newIdeaTitle.trim(),
      description: newIdeaDesc.trim() || null,
      clusterId: newIdeaClusterId,
      sessionId: selectedSessionId,
    });
    setNewIdeaTitle('');
    setNewIdeaDesc('');
    flash('Ide lagt til!');
    ideaTitleRef.current?.focus();
  };
  const handleIdeaKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitIdea(); }
  };
  const deleteIdea = async (ideaId: string) => {
    await api.delete(`/workshops/${id}/ideas/${ideaId}`);
    setIdeas(prev => prev.filter(i => i.id !== ideaId));
  };

  // ---- Cluster ----
  const aiCluster = async () => {
    if (!selectedSessionId) return;
    setAiLoading('clustering');
    try {
      const result = await api.post<{ suggestions: { name: string; summary: string; challengeIds: string[] }[] }>(`/workshops/${id}/ai/cluster`, { sessionId: selectedSessionId });
      for (const s of result.suggestions) {
        const cluster = await api.post<ClusterData>(`/workshops/${id}/clusters`, { name: s.name, summary: s.summary, sessionId: selectedSessionId });
        for (const cId of s.challengeIds) {
          await api.patch(`/workshops/${id}/challenges/${cId}/cluster`, { clusterId: cluster.id });
        }
      }
      const [cl, ch] = await Promise.all([
        api.get<ClusterData[]>(`/workshops/${id}/clusters`),
        api.get<ChallengeData[]>(`/workshops/${id}/challenges`),
      ]);
      setClusters(cl);
      setChallenges(ch);
    } finally { setAiLoading(null); }
  };

  const createCluster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClusterName.trim() || !selectedSessionId) return;
    const cluster = await api.post<ClusterData>(`/workshops/${id}/clusters`, { name: newClusterName.trim(), sessionId: selectedSessionId });
    setClusters(prev => [...prev, cluster]);
    setNewClusterName('');
    setShowNewCluster(false);
  };

  // ---- HKV ----
  const aiSuggestHkv = async (clusterId: string) => {
    if (!selectedSessionId) return;
    setAiLoading('hkv');
    try {
      const result = await api.post<{ suggestions: { problem: string; benefit: string; constraint: string; fullText: string }[] }>(`/workshops/${id}/ai/hkv`, { clusterId });
      for (const s of result.suggestions) {
        await api.post(`/workshops/${id}/hkv`, { ...s, clusterId, isAiGenerated: true, sessionId: selectedSessionId });
      }
      const hk = await api.get<HkvQuestionData[]>(`/workshops/${id}/hkv`);
      setHkvQuestions(hk);
    } finally { setAiLoading(null); }
  };

  const createHkv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHkvProblem.trim() || !newHkvClusterId || !selectedSessionId) return;
    const fullText = `Hvordan kan vi ${newHkvProblem.trim()}, slik at ${newHkvBenefit.trim() || '...'}, uten at ${newHkvConstraint.trim() || '...'}?`;
    await api.post(`/workshops/${id}/hkv`, {
      problem: newHkvProblem.trim(), benefit: newHkvBenefit.trim(), constraint: newHkvConstraint.trim(),
      fullText, clusterId: newHkvClusterId, isAiGenerated: false, sessionId: selectedSessionId,
    });
    const hk = await api.get<HkvQuestionData[]>(`/workshops/${id}/hkv`);
    setHkvQuestions(hk);
    setNewHkvProblem(''); setNewHkvBenefit(''); setNewHkvConstraint('');
    setShowNewHkv(false);
  };

  const startEditHkv = (h: HkvQuestionData) => {
    setEditingHkvId(h.id);
    setEditHkvProblem(h.problem);
    setEditHkvBenefit(h.benefit);
    setEditHkvConstraint(h.constraint);
  };

  const updateHkv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHkvId || !editHkvProblem.trim()) return;
    const fullText = `Hvordan kan vi ${editHkvProblem.trim()}, slik at ${editHkvBenefit.trim() || '...'}, uten at ${editHkvConstraint.trim() || '...'}?`;
    await api.patch(`/workshops/${id}/hkv/${editingHkvId}`, {
      problem: editHkvProblem.trim(),
      benefit: editHkvBenefit.trim(),
      constraint: editHkvConstraint.trim(),
    });
    setHkvQuestions(prev => prev.map(q => q.id === editingHkvId ? { ...q, problem: editHkvProblem.trim(), benefit: editHkvBenefit.trim(), constraint: editHkvConstraint.trim(), fullText } : q));
    setEditingHkvId(null);
    flash('HKV oppdatert!');
  };

  const deleteHkv = async (hkvId: string) => {
    if (!confirm('Slette dette HKV-sporsmaalet?')) return;
    await api.delete(`/workshops/${id}/hkv/${hkvId}`);
    setHkvQuestions(prev => prev.filter(q => q.id !== hkvId));
    flash('HKV slettet');
  };

  // ---- Post-it scanning ----
  const openPostItScan = (context: 'hkv' | 'ideas', clusterId?: string) => {
    setPostItContext(context);
    setPostItClusterId(clusterId || '');
    setPostItTexts([]);
    fileInputRef.current?.click();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    e.target.value = '';

    setAiLoading('postit-scan');
    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.readAsDataURL(file);
      });

      const result = await api.post<{ texts: string[] }>(`/workshops/${id}/ai/read-postits`, {
        image: base64,
        context: postItContext,
      });

      if (result.texts.length === 0) {
        flash('Ingen post-it-lapper funnet i bildet');
        return;
      }

      setPostItTexts(result.texts);
    } catch (err) {
      console.error('Post-it scan error:', err);
      flash('Feil ved lesing av bilde');
    } finally {
      setAiLoading(null);
    }
  };

  const importPostItAsHkv = async (text: string, clusterId: string) => {
    if (!selectedSessionId) return;
    const fullText = `Hvordan kan vi ${text}?`;
    await api.post(`/workshops/${id}/hkv`, {
      problem: text, benefit: '', constraint: '',
      fullText, clusterId, isAiGenerated: false, sessionId: selectedSessionId,
    });
    const hk = await api.get<HkvQuestionData[]>(`/workshops/${id}/hkv`);
    setHkvQuestions(hk);
    setPostItTexts(prev => prev.filter(t => t !== text));
    flash('HKV lagt til!');
  };

  const importPostItAsIdea = async (text: string, clusterId: string) => {
    if (!selectedSessionId) return;
    await api.post(`/workshops/${id}/ideas`, {
      title: text, clusterId, sessionId: selectedSessionId, isAiGenerated: false,
    });
    const updatedIdeas = await api.get<IdeaData[]>(`/workshops/${id}/ideas`);
    setIdeas(updatedIdeas);
    setPostItTexts(prev => prev.filter(t => t !== text));
    flash('Ide lagt til!');
  };

  const importAllPostIts = async () => {
    if (!selectedSessionId || !postItClusterId) return;
    setAiLoading('import');
    try {
      for (const text of postItTexts) {
        if (postItContext === 'hkv') {
          await api.post(`/workshops/${id}/hkv`, {
            problem: text, benefit: '', constraint: '',
            fullText: `Hvordan kan vi ${text}?`, clusterId: postItClusterId,
            isAiGenerated: false, sessionId: selectedSessionId,
          });
        } else {
          await api.post(`/workshops/${id}/ideas`, {
            title: text, clusterId: postItClusterId,
            sessionId: selectedSessionId, isAiGenerated: false,
          });
        }
      }
      if (postItContext === 'hkv') {
        const hk = await api.get<HkvQuestionData[]>(`/workshops/${id}/hkv`);
        setHkvQuestions(hk);
      } else {
        const updatedIdeas = await api.get<IdeaData[]>(`/workshops/${id}/ideas`);
        setIdeas(updatedIdeas);
      }
      setPostItTexts([]);
      flash(`${postItTexts.length} oppforinger importert!`);
    } finally { setAiLoading(null); }
  };

  // ---- Ideation AI ----
  const aiSuggestIdeas = async (clusterId: string) => {
    if (!selectedSessionId) return;
    setAiLoading('ideation');
    try {
      const result = await api.post<{ suggestions: { title: string; description: string }[] }>(`/workshops/${id}/ai/ideate`, { clusterId });
      for (const s of result.suggestions) {
        await api.post(`/workshops/${id}/ideas`, { title: s.title, description: s.description, clusterId, isAiGenerated: true, sessionId: selectedSessionId });
      }
      const updatedIdeas = await api.get<IdeaData[]>(`/workshops/${id}/ideas`);
      setIdeas(updatedIdeas);
    } finally { setAiLoading(null); }
  };

  // ---- Scoring ----
  const scoreIdea = async (ideaId: string, utilityValue: ValueLevel, feasibility: ValueLevel) => {
    await api.post(`/workshops/${id}/ideas/${ideaId}/score`, { utilityValue, feasibility });
    const updatedIdeas = await api.get<IdeaData[]>(`/workshops/${id}/ideas`);
    setIdeas(updatedIdeas);
  };

  // ---- Canvas ----
  // Load existing canvases from DB when entering canvas step
  useEffect(() => {
    if (sessionStep !== 'CANVAS' || !id) return;
    const prioritized = sessionIdeas.filter(i => i.score?.matrixQuadrant === 'PRIORITER_NA');
    for (const idea of prioritized) {
      if (canvasData[idea.id]) continue; // already in local state
      api.get<{ problemStatement: string; solutionSummary: string; dataNeeds: string; stakeholders?: string; firstSteps: string; expectedOutcome?: string }>(`/workshops/${id}/canvas/${idea.id}`)
        .then(c => setCanvasData(prev => ({ ...prev, [idea.id]: { problemStatement: c.problemStatement || '', solutionSummary: c.solutionSummary || '', dataNeeds: c.dataNeeds || '', firstSteps: c.firstSteps || '', expectedOutcome: c.expectedOutcome || '' } })))
        .catch(() => { /* no canvas yet */ });
    }
  }, [sessionStep, id, sessionIdeas.length]);

  const saveCanvas = async (ideaId: string) => {
    const data = canvasData[ideaId];
    if (!data) return;
    await api.put(`/workshops/${id}/canvas/${ideaId}`, data);
    flash('Canvas lagret!');
  };
  const aiGenerateCanvas = async (ideaId: string) => {
    setAiLoading('canvas');
    try {
      const result = await api.post<{ canvas: { problemStatement: string; solutionSummary: string; dataNeeds: string; firstSteps: string; expectedOutcome: string } }>(`/workshops/${id}/ai/canvas`, { ideaId });
      const canvas = result.canvas;
      setCanvasData(prev => ({ ...prev, [ideaId]: canvas }));
      // Auto-save to DB
      await api.put(`/workshops/${id}/canvas/${ideaId}`, { ...canvas, isAiDraft: true });
      flash('AI-utkast generert og lagret!');
    } finally { setAiLoading(null); }
  };

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
    } catch { /* no canvas saved */ }
  };

  const closeIdeaDetail = () => {
    setDetailIdeaId(null);
    setDetailCanvas(null);
  };

  const detailIdea = ideas.find(i => i.id === detailIdeaId);
  const detailHkv = detailIdea?.hkvQuestionId ? hkvQuestions.find(h => h.id === detailIdea.hkvQuestionId) : null;
  const detailCluster = detailIdea?.clusterId ? clusters.find(c => c.id === detailIdea.clusterId) : (detailHkv ? clusters.find(c => c.id === detailHkv.clusterId) : null);
  const detailPrioritizedIdeas = showSummary
    ? ideas.filter(i => i.score?.matrixQuadrant === 'PRIORITER_NA')
    : sessionIdeas.filter(i => i.score?.matrixQuadrant === 'PRIORITER_NA');
  const detailCurrentIdx = detailIdea ? detailPrioritizedIdeas.findIndex(i => i.id === detailIdea.id) : -1;

  const navigateDetail = (dir: 1 | -1) => {
    const nextIdx = detailCurrentIdx + dir;
    if (nextIdx >= 0 && nextIdx < detailPrioritizedIdeas.length) {
      openIdeaDetail(detailPrioritizedIdeas[nextIdx].id);
    }
  };

  // ---- PDF export ----
  const downloadPdf = async () => {
    if (!id) return;
    setPdfLoading(true);
    try {
      const reportData = await api.get<Parameters<typeof generateReport>[0]>(`/workshops/${id}/report`);
      generateReport(reportData);
      flash('PDF-rapport lastet ned!');
    } catch (err) {
      console.error('PDF export error:', err);
      flash('Feil ved generering av PDF');
    } finally {
      setPdfLoading(false);
    }
  };

  if (loading || !workshop) {
    return <WorkshopLayout><div className="loading"><div className="spinner" /></div></WorkshopLayout>;
  }

  const sessionStepIdx = SESSION_STEP_ORDER.indexOf(sessionStep);
  const stepInfo = SESSION_STEP_DESCRIPTIONS[sessionStep];

  // ============================
  // RENDER
  // ============================
  return (
    <WorkshopLayout workshopTitle={workshop.title} workshopId={id} joinCode={workshop.joinCode} currentStep={sessionStep}>
      <div className="page-header">
        <div className="page-header-row">
          <div>
            <h1>{workshop.title}</h1>
            <p>{workshop.customerName || 'Workshop'}</p>
          </div>
        </div>
      </div>

      {/* ====== SESSION TABS ====== */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {workshop.sessions.map(session => (
          <button
            key={session.id}
            className={session.id === selectedSessionId && !showSummary ? 'btn btn-primary' : 'btn btn-secondary'}
            onClick={() => { setSelectedSessionId(session.id); setShowSummary(false); }}
            style={{ position: 'relative' }}
          >
            {session.title}
            <span style={{
              marginLeft: '0.5rem',
              background: session.id === selectedSessionId && !showSummary ? 'rgba(255,255,255,0.3)' : 'var(--color-bg)',
              padding: '0.125rem 0.5rem',
              borderRadius: '999px',
              fontSize: '0.6875rem',
              fontWeight: 600,
            }}>
              {STEP_LABELS[session.currentStep]}
            </span>
          </button>
        ))}
        <button
          className={showSummary ? 'btn btn-primary' : 'btn btn-secondary'}
          onClick={() => setShowSummary(true)}
          style={{ marginLeft: 'auto' }}
        >
          Samlet oppsummering
        </button>
      </div>

      {/* ====== SUMMARY VIEW ====== */}
      {showSummary && (
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>Samlet oppsummering - alle okter</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div className="stat-card"><div className="stat-label">Utfordringer</div><div className="stat-value">{challenges.length}</div></div>
            <div className="stat-card"><div className="stat-label">Klynger</div><div className="stat-value">{clusters.length}</div></div>
            <div className="stat-card"><div className="stat-label">HKV-sporsmaal</div><div className="stat-value">{hkvQuestions.filter(h => h.isApproved).length}</div></div>
            <div className="stat-card"><div className="stat-label">Ideer</div><div className="stat-value">{ideas.length}</div></div>
            <div className="stat-card"><div className="stat-label">Prioritert</div><div className="stat-value" style={{ color: 'var(--color-success)' }}>{ideas.filter(i => i.score?.matrixQuadrant === 'PRIORITER_NA').length}</div></div>
          </div>

          {/* Per-session summary */}
          {workshop.sessions.map(session => {
            const sIdeas = ideas.filter(i => i.sessionId === session.id);
            const sChallenges = challenges.filter(c => c.sessionId === session.id);
            const sScoredIdeas = sIdeas.filter(i => i.score);
            const sPrioritized = sIdeas.filter(i => i.score?.matrixQuadrant === 'PRIORITER_NA');
            return (
              <div key={session.id} className="card" style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>{session.title}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div className="stat-card"><div className="stat-label">Utfordringer</div><div className="stat-value">{sChallenges.length}</div></div>
                  <div className="stat-card"><div className="stat-label">Ideer</div><div className="stat-value">{sIdeas.length}</div></div>
                  <div className="stat-card"><div className="stat-label">Vurdert</div><div className="stat-value">{sScoredIdeas.length}</div></div>
                  <div className="stat-card"><div className="stat-label">Prioritert</div><div className="stat-value" style={{ color: 'var(--color-success)' }}>{sPrioritized.length}</div></div>
                </div>
                {sScoredIdeas.length > 0 && (
                  <div className="matrix-container" style={{ marginBottom: '1rem' }}>
                    <Matrix2x2 ideas={sScoredIdeas} />
                  </div>
                )}
                {sPrioritized.map(idea => (
                  <div key={idea.id} className="idea-card" style={{ marginBottom: '0.5rem', cursor: 'pointer' }}
                    onClick={() => openIdeaDetail(idea.id)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="idea-title">{idea.title}</div>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '1rem' }}>{'\u203A'}</span>
                    </div>
                    {idea.description && <p className="idea-description">{idea.description}</p>}
                    <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.375rem' }}>
                      <span className="badge badge-high">Nytte: {idea.score?.utilityValue}</span>
                      <span className="badge badge-high">Gjennomf.: {idea.score?.feasibility}</span>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          {/* Combined matrix */}
          {ideas.filter(i => i.score).length > 0 && (
            <>
              <div className="section-title">Samlet prioriteringsmatrise</div>
              <div className="matrix-container"><Matrix2x2 ideas={ideas.filter(i => i.score)} /></div>
            </>
          )}
        </div>
      )}

      {/* ====== PER-SESSION CONTENT ====== */}
      {!showSummary && selectedSessionId && (
        <div>
          <StepIndicator currentStep={sessionStep} steps={SESSION_STEP_ORDER} onStepClick={changeSessionStep} />

          {/* Nav buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <button className="btn btn-secondary" onClick={prevStep} disabled={sessionStepIdx === 0}>
              {'\u2190'} Forrige
            </button>
            <button className="btn btn-primary" onClick={nextStep} disabled={sessionStepIdx === SESSION_STEP_ORDER.length - 1}>
              Neste: {sessionStepIdx < SESSION_STEP_ORDER.length - 1 ? STEP_LABELS[SESSION_STEP_ORDER[sessionStepIdx + 1]] : ''} {'\u2192'}
            </button>
          </div>

          {/* Step info */}
          <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid var(--color-accent)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.25rem' }}>{stepInfo.title}</h3>
            {stepInfo.tip && <p style={{ fontSize: '0.75rem', color: 'var(--color-accent)', fontWeight: 500 }}>Tips: {stepInfo.tip}</p>}
          </div>

          {aiLoading && (
            <div className="ai-processing">
              <div className="spinner spinner-sm" style={{ borderTopColor: '#008A00' }} />
              AI analyserer ({aiLoading})...
            </div>
          )}
          {submitSuccess && (
            <div style={{ padding: '0.5rem 1rem', background: 'var(--color-success-light)', color: '#059669', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.8125rem', fontWeight: 500 }}>
              {'\u2713'} {submitSuccess}
            </div>
          )}

          {/* ====== SESSIONS (Utfordringer) ====== */}
          {sessionStep === 'SESSIONS' && (
            <div>
              <div className="stat-card" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                <div className="stat-label">Utfordringer i denne okten</div>
                <div className="stat-value">{sessionChallenges.length}</div>
              </div>
              <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem', borderLeft: '4px solid var(--color-accent)' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input ref={challengeInputRef} className="form-input" value={newChallengeText}
                    onChange={e => setNewChallengeText(e.target.value)} onKeyDown={handleChallengeKeyDown}
                    placeholder="Skriv utfordring og trykk Enter..." style={{ flex: 1 }} autoFocus />
                  <button className="btn btn-primary" onClick={submitChallenge} disabled={!newChallengeText.trim()}>+</button>
                </div>
              </div>
              {sessionChallenges.length === 0 ? (
                <div className="card empty-state"><div className="empty-state-icon">{'\u270D'}</div><h3>Ingen utfordringer enna</h3><p>Skriv inn utfordringene deltakerne nevner</p></div>
              ) : (
                <div className="postit-grid">
                  {sessionChallenges.map((c, i) => <PostIt key={c.id} challenge={c} colorIndex={i} onDelete={() => deleteChallenge(c.id)} />)}
                </div>
              )}
            </div>
          )}

          {/* ====== CLUSTERING ====== */}
          {sessionStep === 'CLUSTERING' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div className="section-title" style={{ marginBottom: 0 }}>Klynger <span className="count">{sessionClusters.length}</span></div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowNewCluster(!showNewCluster)}>+ Ny klynge</button>
                  <button className="btn btn-ai" onClick={aiCluster} disabled={!!aiLoading || unclusteredChallenges.length === 0}>
                    {'\u2728'} AI-klynger ({unclusteredChallenges.length})
                  </button>
                </div>
              </div>
              {showNewCluster && (
                <form onSubmit={createCluster} className="card" style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label>Klyngenavn</label>
                    <input className="form-input" value={newClusterName} onChange={e => setNewClusterName(e.target.value)} placeholder="F.eks. Informasjonsflyt" required autoFocus />
                  </div>
                  <button className="btn btn-primary" type="submit">Opprett</button>
                  <button className="btn btn-ghost" type="button" onClick={() => setShowNewCluster(false)}>&times;</button>
                </form>
              )}
              {sessionClusters.map(cl => (
                <div key={cl.id} className="cluster-card">
                  <div className="cluster-header">
                    <h3 className="cluster-name">{cl.name}</h3>
                    <span className="badge badge-neutral">{cl.challenges.length} utfordringer</span>
                  </div>
                  {cl.summary && <p className="cluster-summary">{cl.summary}</p>}
                  <div className="postit-grid">
                    {cl.challenges.map((c, i) => (
                      <div key={c.id}>
                        <PostIt challenge={c} colorIndex={i} onDelete={() => deleteChallenge(c.id)} />
                        <select className="form-input" style={{ fontSize: '0.6875rem', padding: '0.25rem', marginTop: '0.25rem', color: 'var(--color-text-muted)' }}
                          value={c.clusterId || ''} onChange={e => assignToCluster(c.id, e.target.value || null)}>
                          <option value="">Fjern fra klynge</option>
                          {sessionClusters.map(t => <option key={t.id} value={t.id}>{t.id === cl.id ? `${t.name} (na)` : t.name}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {unclusteredChallenges.length > 0 && (
                <div className="cluster-card cluster-dashed">
                  <div className="cluster-header">
                    <h3 className="cluster-name" style={{ color: 'var(--color-text-muted)' }}>Uklyngede utfordringer</h3>
                    <span className="badge badge-neutral">{unclusteredChallenges.length}</span>
                  </div>
                  <div className="postit-grid">
                    {unclusteredChallenges.map((c, i) => (
                      <div key={c.id}>
                        <PostIt challenge={c} colorIndex={i} onDelete={() => deleteChallenge(c.id)} />
                        {sessionClusters.length > 0 && (
                          <select className="form-input" style={{ fontSize: '0.6875rem', padding: '0.25rem', marginTop: '0.25rem', color: 'var(--color-accent)', fontWeight: 500 }}
                            value="" onChange={e => { if (e.target.value) assignToCluster(c.id, e.target.value); }}>
                            <option value="">Plasser i klynge...</option>
                            {sessionClusters.map(cl => <option key={cl.id} value={cl.id}>{cl.name}</option>)}
                          </select>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ====== HKV ====== */}
          {sessionStep === 'HKV' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div className="section-title" style={{ marginBottom: 0 }}>HKV-sporsmaal <span className="count">{sessionHkv.length}</span></div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => openPostItScan('hkv')} disabled={!!aiLoading}>{'\ud83d\udcf7'} Skann post-its</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowNewHkv(!showNewHkv)}>+ Skriv eget HKV</button>
                </div>
              </div>
              {showNewHkv && (
                <form onSubmit={createHkv} className="card" style={{ marginBottom: '1rem' }}>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem' }}>Nytt HKV-sporsmaal</h4>
                  <div className="form-group">
                    <label>Velg klynge</label>
                    <select className="form-input" value={newHkvClusterId} onChange={e => setNewHkvClusterId(e.target.value)} required>
                      <option value="">-- Velg klynge --</option>
                      {sessionClusters.map(cl => <option key={cl.id} value={cl.id}>{cl.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Hvordan kan vi... (problem)</label>
                    <input className="form-input" value={newHkvProblem} onChange={e => setNewHkvProblem(e.target.value)} placeholder="...lose utfordringen med informasjonsflyt" required />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group"><label>...slik at (gevinst)</label><input className="form-input" value={newHkvBenefit} onChange={e => setNewHkvBenefit(e.target.value)} placeholder="ansatte sparer tid" /></div>
                    <div className="form-group"><label>...uten at (begrensning)</label><input className="form-input" value={newHkvConstraint} onChange={e => setNewHkvConstraint(e.target.value)} placeholder="det gar ut over kvaliteten" /></div>
                  </div>
                  {newHkvProblem && (
                    <div style={{ padding: '0.75rem', background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.8125rem', fontStyle: 'italic', color: 'var(--color-text-secondary)' }}>
                      Forhandsvisning: Hvordan kan vi {newHkvProblem}{newHkvBenefit ? `, slik at ${newHkvBenefit}` : ''}{newHkvConstraint ? `, uten at ${newHkvConstraint}` : ''}?
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost" type="button" onClick={() => setShowNewHkv(false)}>Avbryt</button>
                    <button className="btn btn-primary" type="submit">Legg til HKV</button>
                  </div>
                </form>
              )}
              {sessionClusters.map(cl => (
                <div key={cl.id} className="cluster-card">
                  <div className="cluster-header">
                    <h3 className="cluster-name">{cl.name}</h3>
                    <button className="btn btn-ai btn-sm" onClick={() => aiSuggestHkv(cl.id)} disabled={!!aiLoading}>{'\u2728'} AI: Foresla HKV</button>
                  </div>
                  {sessionHkv.filter(h => h.clusterId === cl.id).length === 0 ? (
                    <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Ingen HKV enna.</p>
                  ) : (
                    sessionHkv.filter(h => h.clusterId === cl.id).map(h => (
                      <div key={h.id} className="hkv-card">
                        {editingHkvId === h.id ? (
                          <form onSubmit={updateHkv}>
                            <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                              <label style={{ fontSize: '0.75rem' }}>Hvordan kan vi... (problem)</label>
                              <input className="form-input" value={editHkvProblem} onChange={e => setEditHkvProblem(e.target.value)} required />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ fontSize: '0.75rem' }}>...slik at (gevinst)</label>
                                <input className="form-input" value={editHkvBenefit} onChange={e => setEditHkvBenefit(e.target.value)} />
                              </div>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label style={{ fontSize: '0.75rem' }}>...uten at (begrensning)</label>
                                <input className="form-input" value={editHkvConstraint} onChange={e => setEditHkvConstraint(e.target.value)} />
                              </div>
                            </div>
                            {editHkvProblem && (
                              <div style={{ padding: '0.5rem', background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', marginBottom: '0.5rem', fontSize: '0.8125rem', fontStyle: 'italic', color: 'var(--color-text-secondary)' }}>
                                Hvordan kan vi {editHkvProblem}{editHkvBenefit ? `, slik at ${editHkvBenefit}` : ''}{editHkvConstraint ? `, uten at ${editHkvConstraint}` : ''}?
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end' }}>
                              <button className="btn btn-ghost btn-sm" type="button" onClick={() => setEditingHkvId(null)}>Avbryt</button>
                              <button className="btn btn-primary btn-sm" type="submit">Lagre</button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <p className="hkv-text">{h.fullText}</p>
                            <div className="hkv-meta">
                              {h.isAiGenerated && <span className="badge badge-ai">{'\u2728'} AI</span>}
                              {h.isApproved ? (
                                <span className="badge badge-high">{'\u2713'} Godkjent</span>
                              ) : (
                                <button className="btn btn-success btn-sm" onClick={() => api.patch(`/workshops/${id}/hkv/${h.id}`, { isApproved: true }).then(() => setHkvQuestions(prev => prev.map(q => q.id === h.id ? { ...q, isApproved: true } : q)))}>{'\u2713'} Godkjenn</button>
                              )}
                              <button className="btn btn-ghost btn-sm" onClick={() => startEditHkv(h)}>Rediger</button>
                              <button className="btn btn-ghost btn-sm" onClick={() => deleteHkv(h.id)} style={{ color: '#dc2626' }}>Slett</button>
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ====== IDEATION ====== */}
          {sessionStep === 'IDEATION' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="stat-card"><div className="stat-label">Ideer</div><div className="stat-value">{sessionIdeas.length}</div></div>
                <div className="stat-card"><div className="stat-label">AI-genererte</div><div className="stat-value">{sessionIdeas.filter(i => i.isAiGenerated).length}</div></div>
              </div>
              {sessionClusters.map(cl => {
                const clusterHkv = sessionHkv.filter(h => h.clusterId === cl.id);
                const clusterIdeas = sessionIdeas.filter(i => i.clusterId === cl.id);
                return (
                  <div key={cl.id} className="cluster-card">
                    <div className="cluster-header">
                      <h3 className="cluster-name">{cl.name}</h3>
                      <div style={{ display: 'flex', gap: '0.375rem' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openPostItScan('ideas', cl.id)} disabled={!!aiLoading}>{'\ud83d\udcf7'}</button>
                        <button className="btn btn-ai btn-sm" onClick={() => aiSuggestIdeas(cl.id)} disabled={!!aiLoading}>{'\u2728'} AI-ideer</button>
                      </div>
                    </div>
                    {clusterHkv.length > 0 && (
                      <div style={{ marginBottom: '0.75rem', padding: '0.625rem', background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--color-accent)' }}>
                        <div style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '0.375rem' }}>HKV-inspirasjon</div>
                        {clusterHkv.map(h => (
                          <p key={h.id} style={{ fontSize: '0.8125rem', fontStyle: 'italic', color: 'var(--color-text-secondary)', marginBottom: '0.25rem', lineHeight: 1.4 }}>{h.fullText}</p>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <input ref={newIdeaClusterId === cl.id ? ideaTitleRef : undefined} className="form-input" value={newIdeaClusterId === cl.id ? newIdeaTitle : ''} onChange={e => { setNewIdeaClusterId(cl.id); setNewIdeaTitle(e.target.value); }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (newIdeaClusterId === cl.id && newIdeaTitle.trim()) submitIdea(); } }} placeholder="Skriv ide + Enter..." style={{ flex: 1 }} />
                      <button className="btn btn-primary btn-sm" onClick={() => { setNewIdeaClusterId(cl.id); submitIdea(); }} disabled={newIdeaClusterId !== cl.id || !newIdeaTitle.trim()}>+</button>
                    </div>
                    {clusterIdeas.length === 0 ? (
                      <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Ingen ideer enna.</p>
                    ) : (
                      <div style={{ display: 'grid', gap: '0.5rem' }}>
                        {clusterIdeas.map(idea => (
                          <div key={idea.id} className="idea-card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div style={{ flex: 1 }}><div className="idea-title">{idea.title}</div>{idea.description && <p className="idea-description">{idea.description}</p>}</div>
                              <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', flexShrink: 0 }}>
                                {idea.isAiGenerated && <span className="badge badge-ai">{'\u2728'} AI</span>}
                                <button className="btn btn-ghost btn-sm" onClick={() => deleteIdea(idea.id)} style={{ padding: '0.125rem 0.375rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>&times;</button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ====== PRIORITIZATION ====== */}
          {sessionStep === 'PRIORITIZATION' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="stat-card"><div className="stat-label">Ideer</div><div className="stat-value">{sessionIdeas.length}</div></div>
                <div className="stat-card"><div className="stat-label">Vurdert</div><div className="stat-value">{sessionIdeas.filter(i => i.score).length} / {sessionIdeas.length}</div></div>
              </div>
              <div className="section-title">Vurder ideene <span className="count">{sessionIdeas.length}</span></div>
              {sessionIdeas.map(idea => (
                <div key={idea.id} className="idea-card" style={{ marginBottom: '0.75rem' }}>
                  <div className="idea-title">{idea.title}</div>
                  {idea.description && <p className="idea-description" style={{ marginBottom: '0.75rem' }}>{idea.description}</p>}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <ScoreInput label="Nytteverdi" value={idea.score?.utilityValue} onChange={v => scoreIdea(idea.id, v, idea.score?.feasibility || 'MEDIUM')} />
                    <ScoreInput label="Gjennomforbarhet" value={idea.score?.feasibility} onChange={v => scoreIdea(idea.id, idea.score?.utilityValue || 'MEDIUM', v)} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ====== MATRIX ====== */}
          {sessionStep === 'MATRIX' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="stat-card"><div className="stat-label">Prioriter na</div><div className="stat-value" style={{ color: 'var(--color-success)' }}>{sessionIdeas.filter(i => i.score?.matrixQuadrant === 'PRIORITER_NA').length}</div></div>
                <div className="stat-card"><div className="stat-label">Strategiske</div><div className="stat-value" style={{ color: 'var(--color-warning)' }}>{sessionIdeas.filter(i => i.score?.matrixQuadrant === 'STRATEGISKE_SATSINGER').length}</div></div>
                <div className="stat-card"><div className="stat-label">Raske gevinster</div><div className="stat-value" style={{ color: 'var(--color-accent)' }}>{sessionIdeas.filter(i => i.score?.matrixQuadrant === 'RASKE_GEVINSTER').length}</div></div>
                <div className="stat-card"><div className="stat-label">Parker</div><div className="stat-value" style={{ color: 'var(--color-text-muted)' }}>{sessionIdeas.filter(i => i.score?.matrixQuadrant === 'PARKER').length}</div></div>
              </div>
              <div className="matrix-container"><Matrix2x2 ideas={sessionIdeas.filter(i => i.score)} /></div>
            </div>
          )}

          {/* ====== CANVAS ====== */}
          {sessionStep === 'CANVAS' && (
            <div>
              <div className="section-title">Idecanvas</div>
              {sessionIdeas.filter(i => i.score?.matrixQuadrant === 'PRIORITER_NA').length === 0 ? (
                <div className="card empty-state"><div className="empty-state-icon">{'\ud83d\udcdd'}</div><h3>Ingen prioriterte ideer</h3><p>Ga tilbake til Prioritering og vurder ideene forst</p></div>
              ) : (
                sessionIdeas.filter(i => i.score?.matrixQuadrant === 'PRIORITER_NA').map(idea => {
                  const canvas = canvasData[idea.id] || { problemStatement: '', solutionSummary: '', dataNeeds: '', firstSteps: '', expectedOutcome: '' };
                  return (
                    <div key={idea.id} className="card" style={{ marginBottom: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{idea.title}</h3>
                        <button className="btn btn-ai btn-sm" onClick={() => aiGenerateCanvas(idea.id)} disabled={!!aiLoading}>{'\u2728'} AI-utkast</button>
                      </div>
                      <div style={{ display: 'grid', gap: '1rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}><label>Problemstilling</label><textarea className="form-input" rows={2} value={canvas.problemStatement} onChange={e => setCanvasData(prev => ({ ...prev, [idea.id]: { ...canvas, problemStatement: e.target.value } }))} placeholder="Beskriv problemet..." /></div>
                        <div className="form-group" style={{ marginBottom: 0 }}><label>Losningsbeskrivelse</label><textarea className="form-input" rows={2} value={canvas.solutionSummary} onChange={e => setCanvasData(prev => ({ ...prev, [idea.id]: { ...canvas, solutionSummary: e.target.value } }))} placeholder="Beskriv losningen..." /></div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <div className="form-group" style={{ marginBottom: 0 }}><label>Databehov</label><textarea className="form-input" rows={2} value={canvas.dataNeeds} onChange={e => setCanvasData(prev => ({ ...prev, [idea.id]: { ...canvas, dataNeeds: e.target.value } }))} placeholder="Hvilke data trengs?" /></div>
                          <div className="form-group" style={{ marginBottom: 0 }}><label>Forventet effekt</label><textarea className="form-input" rows={2} value={canvas.expectedOutcome} onChange={e => setCanvasData(prev => ({ ...prev, [idea.id]: { ...canvas, expectedOutcome: e.target.value } }))} placeholder="Hva er forventet effekt?" /></div>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}><label>Forste steg</label><textarea className="form-input" rows={2} value={canvas.firstSteps} onChange={e => setCanvasData(prev => ({ ...prev, [idea.id]: { ...canvas, firstSteps: e.target.value } }))} placeholder="Forste konkrete steg?" /></div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}><button className="btn btn-primary" onClick={() => saveCanvas(idea.id)}>Lagre canvas</button></div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ====== RESULTS (per session) ====== */}
          {sessionStep === 'RESULTS' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                <button className="btn btn-primary" onClick={downloadPdf} disabled={pdfLoading} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {pdfLoading ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Genererer...</> : <>{'\ud83d\udcc4'} Last ned PDF-rapport</>}
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                <div className="stat-card"><div className="stat-label">Utfordringer</div><div className="stat-value">{sessionChallenges.length}</div></div>
                <div className="stat-card"><div className="stat-label">Klynger</div><div className="stat-value">{sessionClusters.length}</div></div>
                <div className="stat-card"><div className="stat-label">HKV</div><div className="stat-value">{sessionApprovedHkv.length}</div></div>
                <div className="stat-card"><div className="stat-label">Ideer</div><div className="stat-value">{sessionIdeas.length}</div></div>
                <div className="stat-card"><div className="stat-label">Prioritert</div><div className="stat-value" style={{ color: 'var(--color-success)' }}>{sessionIdeas.filter(i => i.score?.matrixQuadrant === 'PRIORITER_NA').length}</div></div>
              </div>
              {sessionIdeas.filter(i => i.score).length > 0 && (
                <>
                  <div className="section-title">Prioriteringsmatrise</div>
                  <div className="matrix-container" style={{ marginBottom: '2rem' }}><Matrix2x2 ideas={sessionIdeas.filter(i => i.score)} /></div>
                </>
              )}
              <div className="section-title">Prioriterte ideer <span style={{ fontSize: '0.8125rem', fontWeight: 400, color: 'var(--color-text-muted)' }}>&mdash; klikk for detaljer</span></div>
              {sessionIdeas.filter(i => i.score?.matrixQuadrant === 'PRIORITER_NA').map(idea => {
                const cl = idea.clusterId ? clusters.find(c => c.id === idea.clusterId) : null;
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
                      {cl && <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>Klynge: {cl.name}</span>}
                    </div>
                  </div>
                );
              })}
              {sessionIdeas.filter(i => i.score?.matrixQuadrant === 'PRIORITER_NA').length === 0 && (
                <div className="card empty-state"><div className="empty-state-icon">{'\ud83c\udfc6'}</div><h3>Ingen prioriterte ideer enna</h3></div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ====== IDEA DETAIL MODAL ====== */}
      {detailIdea && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeIdeaDetail(); }}>
          <div className="modal-content">
            <div className="modal-header">
              <h2>{detailIdea.title}</h2>
              <button className="modal-close" onClick={closeIdeaDetail}>&times;</button>
            </div>

            <div className="modal-body">
              {/* Idea description */}
              {detailIdea.description && (
                <div className="modal-section">
                  <div className="modal-section-label"><span className="section-icon">{'\ud83d\udca1'}</span> Idebeskrivelse</div>
                  <div className="modal-section-content">
                    <p>{detailIdea.description}</p>
                  </div>
                </div>
              )}

              {/* Cluster + Challenges */}
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

              {/* HKV Question */}
              {detailHkv && (
                <div className="modal-section">
                  <div className="modal-section-label"><span className="section-icon">{'\u2753'}</span> HKV-sporsmaal</div>
                  <div className="modal-section-content" style={{ borderLeft: '3px solid var(--color-accent)' }}>
                    <p style={{ fontWeight: 600, fontStyle: 'italic' }}>{detailHkv.fullText}</p>
                  </div>
                </div>
              )}

              {/* Score / Prioritization */}
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

              {/* Canvas */}
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

            {/* Navigation footer */}
            {detailPrioritizedIdeas.length > 1 && (
              <div className="modal-nav">
                <button className="btn btn-secondary btn-sm" disabled={detailCurrentIdx <= 0} onClick={() => navigateDetail(-1)}>&larr; Forrige</button>
                <span className="modal-nav-counter">{detailCurrentIdx + 1} av {detailPrioritizedIdeas.length}</span>
                <button className="btn btn-secondary btn-sm" disabled={detailCurrentIdx >= detailPrioritizedIdeas.length - 1} onClick={() => navigateDetail(1)}>Neste &rarr;</button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Hidden file input for post-it scanning */}
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleImageUpload} />

      {/* Post-it scan results modal */}
      {postItTexts.length > 0 && (
        <div className="modal-overlay" onClick={() => setPostItTexts([])}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.125rem' }}>Post-it-lapper funnet ({postItTexts.length})</h2>
              <button className="modal-close" onClick={() => setPostItTexts([])}>&times;</button>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
              Velg klynge og importer {postItContext === 'hkv' ? 'som HKV-sporsmaal' : 'som ideer'}:
            </p>
            {!postItClusterId && (
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <select className="form-input" value={postItClusterId} onChange={e => setPostItClusterId(e.target.value)}>
                  <option value="">-- Velg klynge --</option>
                  {sessionClusters.map(cl => <option key={cl.id} value={cl.id}>{cl.name}</option>)}
                </select>
              </div>
            )}
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {postItTexts.map((text, i) => (
                <div key={i} className="card" style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input className="form-input" value={text} onChange={e => setPostItTexts(prev => prev.map((t, idx) => idx === i ? e.target.value : t))} style={{ flex: 1, fontSize: '0.875rem' }} />
                  <button className="btn btn-ghost btn-sm" onClick={() => setPostItTexts(prev => prev.filter((_, idx) => idx !== i))} style={{ color: '#dc2626', flexShrink: 0 }}>&times;</button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button className="btn btn-ghost" onClick={() => setPostItTexts([])}>Avbryt</button>
              <button className="btn btn-primary" onClick={importAllPostIts} disabled={!postItClusterId || !!aiLoading}>
                {aiLoading === 'import' ? 'Importerer...' : `Importer alle (${postItTexts.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </WorkshopLayout>
  );
}
