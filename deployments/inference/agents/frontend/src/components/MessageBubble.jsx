import PaletteStrip from './PaletteStrip';
import PaletteCandidates from './PaletteCandidates';
import ResultImage from './ResultImage';

export default function MessageBubble({ msg, onPick }) {
  const isUser = msg.role === 'user';

  return (
    <div className="msg-enter" style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 14,
      alignItems: 'flex-start',
    }}>
      {!isUser && (
        <div style={{
          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg,#e8dfc8,#b4a8d4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, marginRight: 8, marginTop: 2,
          animation: 'dreamGlow 3s ease-in-out infinite',
        }}>✦</div>
      )}

      <div style={{
        maxWidth: '70%',
        background: isUser
          ? 'rgba(232,223,200,0.1)'
          : 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(12px)',
        border: `1px solid ${isUser ? 'rgba(232,223,200,0.2)' : 'rgba(180,170,230,0.2)'}`,
        borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        padding: '10px 14px',
        boxShadow: isUser
          ? '0 2px 12px rgba(0,0,0,0.25)'
          : '0 2px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}>
        {/* Attached image */}
        {msg.image_url && (
          <div style={{ marginBottom: 8, borderRadius: 8, overflow: 'hidden' }}>
            <img src={msg.image_url} alt="attached"
              style={{ maxWidth: '100%', maxHeight: 180, objectFit: 'contain', display: 'block' }} />
          </div>
        )}

        {/* User's custom palette */}
        {msg.customPalette && (
          <div style={{ marginBottom: 8 }}>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
              color: 'rgba(232,223,200,0.45)', textTransform: 'uppercase',
              display: 'block', marginBottom: 4,
            }}>Custom palette</span>
            <div style={{ display: 'flex', gap: 3 }}>
              {msg.customPalette.map((hex, i) => (
                <div key={i} title={hex} style={{
                  width: 22, height: 22, borderRadius: 6, backgroundColor: hex,
                  border: '1px solid rgba(255,255,255,0.12)',
                }} />
              ))}
            </div>
          </div>
        )}

        <p style={{
          fontSize: 14, lineHeight: 1.65, whiteSpace: 'pre-wrap',
          color: 'var(--text)', wordBreak: 'break-word',
        }}>
          {msg.content}
        </p>

        {msg.palette && <PaletteStrip colors={msg.palette} />}

        {msg.palette_candidates?.length > 1 && (
          <PaletteCandidates candidates={msg.palette_candidates} onPick={onPick} />
        )}

        {msg.result_b64 && (
          <ResultImage b64={msg.result_b64} count={msg.recolor_count || 0} />
        )}
      </div>
    </div>
  );
}
