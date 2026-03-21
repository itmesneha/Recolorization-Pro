import { toHex } from '../utils';

const LBL = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.13em',
  color: 'rgba(200,195,220,0.55)', textTransform: 'uppercase',
  display: 'block', marginBottom: 8,
};

const CARD = {
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(16px)',
  borderRadius: 14,
  padding: '14px',
  border: '1px solid rgba(180,170,230,0.18)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
};

function Placeholder({ label, icon }) {
  return (
    <div style={{
      borderRadius: 10, border: '1px dashed rgba(180,170,230,0.25)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 6, padding: '20px 10px',
      color: 'rgba(200,195,220,0.45)', fontSize: 12,
    }}>
      {icon && <span style={{ fontSize: 28, opacity: 0.35 }}>{icon}</span>}
      <span>{label}</span>
    </div>
  );
}

export default function SidePanel({ currentResult, currentPalette, recolorCount }) {
  return (
    <div style={{
      width: 320, flexShrink: 0,
      borderLeft: '1px solid rgba(180,170,230,0.15)',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.025) 0%, transparent 100%)',
      padding: '18px 16px', display: 'flex', flexDirection: 'column',
      gap: 16, overflowY: 'auto',
    }}>

      {/* Active palette */}
      <div style={CARD}>
        <span style={LBL}>Active Palette</span>
        {currentPalette?.length === 6 ? (
          <>
            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
              {currentPalette.map((c, i) => {
                const hex = Array.isArray(c) ? toHex(c) : c;
                return (
                  <div
                    key={i}
                    title={hex}
                    style={{
                      flex: 1, height: 48, borderRadius: 9,
                      backgroundColor: hex,
                      border: '1px solid rgba(255,255,255,0.08)',
                      boxShadow: `0 2px 12px ${hex}44`,
                    }}
                  />
                );
              })}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {currentPalette.map((c, i) => {
                const hex = Array.isArray(c) ? toHex(c) : c;
                return (
                  <span key={i} style={{
                    fontSize: 9, fontFamily: 'monospace',
                    color: 'rgba(200,195,220,0.5)', letterSpacing: '0.04em',
                  }}>
                    {hex.toUpperCase()}
                  </span>
                );
              })}
            </div>
          </>
        ) : (
          <Placeholder icon="🎨" label="No palette yet" />
        )}
      </div>

      {/* Recolored result */}
      <div style={{ ...CARD, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <span style={LBL}>
          Result{recolorCount > 0 ? ` #${recolorCount}` : ''}
        </span>
        {currentResult ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{
              borderRadius: 10, overflow: 'hidden',
              border: '1px solid rgba(232,223,200,0.35)',
              background: 'rgba(0,0,0,0.2)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}>
              <img
                src={`data:image/png;base64,${currentResult}`}
                alt="result"
                style={{ width: '100%', objectFit: 'contain', display: 'block' }}
              />
            </div>
            <a
              href={`data:image/png;base64,${currentResult}`}
              download={`recolored_${recolorCount}.png`}
              style={{
                display: 'block', textAlign: 'center',
                padding: '9px 0', borderRadius: 10,
                background: 'rgba(232,223,200,0.07)',
                border: '1px solid rgba(232,223,200,0.3)',
                color: '#e8dfc8', fontSize: 12, fontWeight: 600,
                textDecoration: 'none', transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(232,223,200,0.14)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(232,223,200,0.07)'}
            >
              ↓ Download PNG
            </a>
          </div>
        ) : (
          <Placeholder icon="🖼️" label="Recolored image will appear here" />
        )}
      </div>
    </div>
  );
}
