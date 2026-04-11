import type { IdeaData } from '../../shared/types.js';

interface Matrix2x2Props {
  ideas: IdeaData[];
  onIdeaClick?: (idea: IdeaData) => void;
}

export function Matrix2x2({ ideas, onIdeaClick }: Matrix2x2Props) {
  const quadrants = {
    STRATEGISKE_SATSINGER: ideas.filter(i => i.score?.matrixQuadrant === 'STRATEGISKE_SATSINGER'),
    PRIORITER_NA: ideas.filter(i => i.score?.matrixQuadrant === 'PRIORITER_NA'),
    PARKER: ideas.filter(i => i.score?.matrixQuadrant === 'PARKER'),
    RASKE_GEVINSTER: ideas.filter(i => i.score?.matrixQuadrant === 'RASKE_GEVINSTER'),
  };

  const renderIdeas = (items: IdeaData[]) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
      {items.map(idea => (
        <button
          key={idea.id}
          onClick={() => onIdeaClick?.(idea)}
          style={{
            background: 'rgba(255,255,255,0.7)',
            border: '1px solid rgba(0,0,0,0.1)',
            borderRadius: '4px',
            padding: '0.25rem 0.5rem',
            fontSize: '0.75rem',
            cursor: onIdeaClick ? 'pointer' : 'default',
            textAlign: 'left',
          }}
        >
          {idea.title}
        </button>
      ))}
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
          Gjennomførbarhet &rarr;
        </span>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }}>
          Nytteverdi &rarr;
        </div>
        <div className="matrix-grid" style={{ flex: 1 }}>
          <div className="matrix-quadrant quad-strategiske">
            <h3>Strategiske satsinger</h3>
            <p>Stor nytte, men krevende</p>
            {renderIdeas(quadrants.STRATEGISKE_SATSINGER)}
          </div>
          <div className="matrix-quadrant quad-prioriter">
            <h3>Prioriter na</h3>
            <p>Hoy nytte, lett a gjennomfore</p>
            {renderIdeas(quadrants.PRIORITER_NA)}
          </div>
          <div className="matrix-quadrant quad-parker">
            <h3>Parker</h3>
            <p>Lav nytte, vanskelig</p>
            {renderIdeas(quadrants.PARKER)}
          </div>
          <div className="matrix-quadrant quad-raske">
            <h3>Raske gevinster</h3>
            <p>Enkle tiltak, rask effekt</p>
            {renderIdeas(quadrants.RASKE_GEVINSTER)}
          </div>
        </div>
      </div>
    </div>
  );
}
