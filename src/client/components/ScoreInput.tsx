import type { ValueLevel } from '../../shared/types.js';

interface ScoreInputProps {
  label: string;
  value: ValueLevel | undefined;
  onChange: (value: ValueLevel) => void;
}

const LEVELS: { value: ValueLevel; label: string; className: string }[] = [
  { value: 'HIGH', label: 'Høy', className: 'badge-high' },
  { value: 'MEDIUM', label: 'Middels', className: 'badge-medium' },
  { value: 'LOW', label: 'Lav', className: 'badge-low' },
];

export function ScoreInput({ label, value, onChange }: ScoreInputProps) {
  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <span style={{ fontSize: '0.8125rem', fontWeight: 500, marginRight: '0.5rem' }}>{label}:</span>
      <div style={{ display: 'inline-flex', gap: '0.25rem' }}>
        {LEVELS.map(level => (
          <button
            key={level.value}
            className={`badge ${value === level.value ? level.className : ''}`}
            onClick={() => onChange(level.value)}
            style={{
              cursor: 'pointer',
              border: value === level.value ? '2px solid currentColor' : '2px solid transparent',
              background: value !== level.value ? 'var(--color-bg)' : undefined,
              color: value !== level.value ? 'var(--color-text-muted)' : undefined,
            }}
          >
            {level.label}
          </button>
        ))}
      </div>
    </div>
  );
}
