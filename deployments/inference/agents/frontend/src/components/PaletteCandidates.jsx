import { toHex } from '../utils';

export default function PaletteCandidates({ candidates, onPick }) {
  return (
    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
        color: 'var(--muted)', textTransform: 'uppercase',
      }}>
        {candidates.length} candidates — pick one
      </span>
      {candidates.map((c, i) => (
        <button
          key={i}
          onClick={() => onPick(i)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(180,170,230,0.06)',
            border: '1px solid rgba(180,170,230,0.2)',
            borderRadius: 10, padding: '8px 10px', cursor: 'pointer',
            transition: 'border-color 0.15s, background 0.15s',
            textAlign: 'left',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = '#e8dfc8';
            e.currentTarget.style.background = 'rgba(232,223,200,0.08)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'rgba(180,170,230,0.2)';
            e.currentTarget.style.background = 'rgba(180,170,230,0.06)';
          }}
        >
          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
            {c.colors.map((col, j) => (
              <div key={j} style={{
                width: 13, height: 24, backgroundColor: toHex(col),
                borderRadius:
                  j === 0 ? '4px 0 0 4px'
                  : j === c.colors.length - 1 ? '0 4px 4px 0'
                  : 0,
              }} />
            ))}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>
            {c.description || `Palette ${i + 1}`}
          </span>
        </button>
      ))}
    </div>
  );
}
