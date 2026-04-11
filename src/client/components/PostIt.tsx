import type { ChallengeData } from '../../shared/types.js';

const COLORS = ['postit-yellow', 'postit-blue', 'postit-green', 'postit-pink', 'postit-orange', 'postit-purple'];

interface PostItProps {
  challenge: ChallengeData;
  colorIndex?: number;
  onDelete?: () => void;
}

export function PostIt({ challenge, colorIndex = 0, onDelete }: PostItProps) {
  const color = COLORS[colorIndex % COLORS.length];

  return (
    <div className={`postit ${color}`}>
      <p>{challenge.text}</p>
      <div className="postit-author">
        {challenge.participantName}
        {onDelete && (
          <button onClick={onDelete} style={{ background: 'none', border: 'none', color: 'inherit', fontSize: 'inherit', cursor: 'pointer', marginLeft: '0.5rem', opacity: 0.6 }}>
            &times;
          </button>
        )}
      </div>
    </div>
  );
}
