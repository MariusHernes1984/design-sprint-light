import { useNavigate } from 'react-router-dom';

export function Landing() {
  const navigate = useNavigate();

  return (
    <div className="full-layout" style={{ flexDirection: 'column', gap: '2rem' }}>
      <div style={{ textAlign: 'center', maxWidth: 560 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
          <div style={{ width: 48, height: 48, background: '#008A00', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '1.125rem' }}>DS</div>
          <span style={{ fontWeight: 700, fontSize: '1.25rem' }}>Sprint Light</span>
        </div>

        <h1 style={{ fontSize: '2.75rem', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '1rem' }}>
          Design Sprint<br />
          <span style={{ color: '#008A00' }}>Light</span>
        </h1>
        <p style={{ fontSize: '1.0625rem', color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: '2rem' }}>
          Digital plattform for AI-workshops. Identifiser utfordringer,
          generer ideer og prioriter tiltak med AI-assistanse.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button className="btn btn-primary btn-lg" onClick={() => navigate('/login')}>
            Fasilitator
          </button>
          <button className="btn btn-secondary btn-lg" onClick={() => navigate('/join')}>
            Presentasjonsvisning
          </button>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 480, width: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {[
            { step: '01', title: 'Hjemmelekse', desc: 'Beskriv utfordringer' },
            { step: '02', title: 'Klynging', desc: 'AI grupperer temaer' },
            { step: '03', title: 'Idemyldring', desc: 'Generer losninger' },
            { step: '04', title: 'Prioritering', desc: 'Nytteverdi-matrise' },
          ].map(item => (
            <div key={item.step} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <span style={{ fontWeight: 800, fontSize: '0.875rem', color: '#008A00', fontFamily: 'monospace' }}>{item.step}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{item.title}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
