import { useState, useRef } from 'react';
import ColorWheel from './ColorWheel';

const PRESETS = [
  { name: 'Sunset',  colors: ['#FF6B6B','#FF8E53','#FFC300','#FF5733','#C70039','#900C3F'] },
  { name: 'Ocean',   colors: ['#0077B6','#00B4D8','#90E0EF','#CAF0F8','#023E8A','#03045E'] },
  { name: 'Forest',  colors: ['#2D6A4F','#40916C','#52B788','#74C69D','#95D5B2','#D8F3DC'] },
  { name: 'Candy',   colors: ['#FF77AA','#FF99CC','#FFB347','#FFEC5C','#77DD77','#AEC6CF'] },
  { name: 'Mono',    colors: ['#FFFFFF','#CCCCCC','#999999','#666666','#333333','#000000'] },
  { name: 'Neon',    colors: ['#FF00FF','#00FFFF','#00FF00','#FF6600','#FF0066','#6600FF'] },
];

const CARD = {
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(16px)',
  borderRadius: 16,
  padding: '16px',
  border: '1px solid rgba(180,170,230,0.18)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
};

const LBL = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
  color: 'rgba(200,195,220,0.55)', textTransform: 'uppercase',
  marginBottom: 12, display: 'block',
};

function Swatch({ color, index, selected, onClick }) {
  return (
    <button
      onClick={() => onClick(index)}
      title={`Slot ${index + 1}${color ? ': ' + color : ' (empty)'}`}
      style={{
        width: 44, height: 44, borderRadius: 11, cursor: 'pointer',
        position: 'relative', backgroundColor: color || '#12152a',
        transition: 'all 0.15s',
        border: selected ? '3px solid #e8dfc8' : '2px solid rgba(180,170,230,0.3)',
        transform: selected ? 'scale(1.15)' : 'scale(1)',
        boxShadow: selected
          ? `0 0 0 2px #e8dfc8, 0 4px 18px ${color || '#12152a'}88`
          : 'none',
        flexShrink: 0,
      }}
    >
      {!color && (
        <span style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'rgba(180,170,230,0.45)', fontSize: 16,
        }}>+</span>
      )}
    </button>
  );
}

function CompactDropZone({ onFile }) {
  const [drag, setDrag] = useState(false);
  const ref = useRef(null);
  const handle = (f) => { if (f?.type.startsWith('image/')) onFile(f); };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }}
      onClick={() => ref.current.click()}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 8,
        borderRadius: 12, height: 150, cursor: 'pointer', transition: 'all 0.2s',
        border: `2px dashed ${drag ? '#e8dfc8' : 'rgba(180,170,230,0.3)'}`,
        background: drag ? 'rgba(232,223,200,0.06)' : 'transparent',
      }}
    >
      <span style={{ fontSize: 32, opacity: 0.45 }}>🖼️</span>
      <p style={{ margin: 0, color: '#e8dfc8', fontSize: 12, fontWeight: 500 }}>
        Drop image or click to browse
      </p>
      <p style={{ margin: 0, color: 'rgba(200,195,220,0.55)', fontSize: 10 }}>PNG · JPG · WEBP</p>
      <input
        ref={ref} type="file" accept="image/*"
        style={{ display: 'none' }}
        onChange={e => handle(e.target.files[0])}
      />
    </div>
  );
}

export default function LeftPanel({
  attachedFile, onFile, onRemoveAttachment,
  palette, setPalette,
  attachPalette, setAttachPalette,
}) {
  const [slot, setSlot] = useState(0);
  const [tab, setTab] = useState('wheel');
  const [hex, setHex] = useState('#');

  const filled = palette.filter(Boolean);

  const pickColor = (color) => {
    const next = [...palette];
    next[slot] = color;
    setPalette(next);
    const ne = next.findIndex((c, i) => i > slot && !c);
    if (ne !== -1) setSlot(ne);
  };

  const Tab = (id, label) => (
    <button
      key={id}
      onClick={() => setTab(id)}
      style={{
        flex: 1, padding: '6px 0', borderRadius: 9, fontSize: 11,
        fontWeight: 600, cursor: 'pointer', border: 'none',
        transition: 'all 0.15s',
        background: tab === id ? '#e8dfc8' : 'transparent',
        color: tab === id ? '#0d0f1c' : 'rgba(200,195,220,0.55)',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{
      width: 360, flexShrink: 0,
      borderRight: '1px solid rgba(180,170,230,0.15)',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.025) 0%, transparent 100%)',
      padding: '18px', overflowY: 'auto',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>

      {/* ── 1 · Image ── */}
      <div style={CARD}>
        <span style={LBL}>1 · Image</span>
        {attachedFile ? (
          <div style={{
            position: 'relative', borderRadius: 10, overflow: 'hidden',
            border: '1px solid rgba(180,170,230,0.25)', background: 'rgba(0,0,0,0.2)', height: 150,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <img
              src={attachedFile.url}
              alt="uploaded"
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
            />
            <button
              onClick={onRemoveAttachment}
              style={{
                position: 'absolute', top: 6, right: 6,
                background: 'rgba(13,15,28,0.9)', border: '1px solid rgba(180,170,230,0.3)',
                color: '#ede8d8', borderRadius: '50%',
                width: 22, height: 22, cursor: 'pointer', fontSize: 11,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >✕</button>
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'linear-gradient(transparent,rgba(0,0,0,0.7))',
              padding: '5px 10px 7px',
            }}>
              <p style={{
                margin: 0, fontSize: 10, color: '#ede8d8',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {attachedFile.name}
              </p>
            </div>
          </div>
        ) : (
          <CompactDropZone onFile={onFile} />
        )}
      </div>

      {/* ── 2 · Palette ── */}
      <div style={CARD}>
        <span style={LBL}>2 · Palette</span>

        {/* Swatches */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, justifyContent: 'space-between' }}>
          {palette.map((c, i) => (
            <Swatch key={i} color={c} index={i} selected={slot === i} onClick={setSlot} />
          ))}
        </div>

        {/* Color bar */}
        <div style={{
          display: 'flex', height: 5, borderRadius: 5, overflow: 'hidden',
          marginBottom: 12, border: '1px solid rgba(180,170,230,0.15)',
          background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(180,170,230,0.1) 50%, rgba(255,255,255,0) 100%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 3s linear infinite',
        }}>
          {palette.map((c, i) => (
            <div key={i} style={{ flex: 1, background: c || 'rgba(180,170,230,0.1)' }} />
          ))}
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 3,
          background: 'rgba(180,170,230,0.08)',
          borderRadius: 10, padding: 3, marginBottom: 14,
        }}>
          {Tab('wheel', '🎨 Wheel')}
          {Tab('presets', '✨ Presets')}
          {Tab('hex', '# Hex')}
        </div>

        {/* ── Wheel ── */}
        {tab === 'wheel' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(200,195,220,0.55)' }}>
              Slot <span style={{ color: '#e8dfc8', fontWeight: 700 }}>{slot + 1}</span>
              {palette[slot] && (
                <span style={{ marginLeft: 8, fontFamily: 'monospace', color: palette[slot] }}>
                  {palette[slot]}
                </span>
              )}
            </p>
            <ColorWheel onPick={pickColor} size={210} />
            <p style={{ margin: 0, fontSize: 11, color: 'rgba(200,195,220,0.45)' }}>Click or drag to pick</p>
          </div>
        )}

        {/* ── Presets ── */}
        {tab === 'presets' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            {PRESETS.map(p => (
              <button
                key={p.name}
                onClick={() => { setPalette([...p.colors]); setSlot(0); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '8px 9px', borderRadius: 10,
                  background: 'rgba(180,170,230,0.06)',
                  border: '1px solid rgba(180,170,230,0.2)', cursor: 'pointer',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#e8dfc8'; e.currentTarget.style.background = 'rgba(232,223,200,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(180,170,230,0.2)'; e.currentTarget.style.background = 'rgba(180,170,230,0.06)'; }}
              >
                <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                  {p.colors.map((c, i) => (
                    <div key={i} style={{
                      width: 10, height: 18, backgroundColor: c,
                      borderRadius: i === 0 ? '3px 0 0 3px' : i === 5 ? '0 3px 3px 0' : 0,
                    }} />
                  ))}
                </div>
                <span style={{ fontSize: 11, color: '#ede8d8', fontWeight: 500 }}>{p.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* ── Hex ── */}
        {tab === 'hex' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(200,195,220,0.55)' }}>
              Slot <span style={{ color: '#e8dfc8', fontWeight: 700 }}>{slot + 1}</span>
            </p>
            <div style={{ display: 'flex', gap: 7 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  value={hex}
                  onChange={e => setHex(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && /^#[0-9a-fA-F]{6}$/.test(hex) && pickColor(hex)}
                  placeholder="#FF6B6B"
                  maxLength={7}
                  style={{
                    width: '100%', background: 'rgba(180,170,230,0.08)',
                    border: '1px solid rgba(180,170,230,0.25)', borderRadius: 10,
                    padding: '8px 32px 8px 10px', fontSize: 13,
                    fontFamily: 'monospace', color: '#ede8d8',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
                {/^#[0-9a-fA-F]{6}$/.test(hex) && (
                  <div style={{
                    position: 'absolute', right: 8, top: '50%',
                    transform: 'translateY(-50%)',
                    width: 16, height: 16, borderRadius: '50%',
                    backgroundColor: hex, border: '1px solid rgba(180,170,230,0.35)',
                  }} />
                )}
              </div>
              <button
                onClick={() => /^#[0-9a-fA-F]{6}$/.test(hex) && pickColor(hex)}
                style={{
                  padding: '0 12px', background: '#e8dfc8', border: 'none',
                  borderRadius: 10, color: '#0d0f1c', fontSize: 12,
                  fontWeight: 600, cursor: 'pointer',
                }}
              >Set</button>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['#FF6B6B','#FFD93D','#6BCB77','#4D96FF','#FF6BAE','#C77DFF'].map(c => (
                <button
                  key={c}
                  onClick={() => { setHex(c); pickColor(c); }}
                  style={{
                    width: 28, height: 28, borderRadius: 8,
                    backgroundColor: c, border: '2px solid rgba(180,170,230,0.25)', cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Footer: clear + attach toggle ── */}
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={() => { setPalette(Array(6).fill(null)); setSlot(0); setAttachPalette(false); }}
            style={{
              background: 'none', border: 'none', color: 'rgba(200,195,220,0.45)',
              fontSize: 11, cursor: 'pointer', textAlign: 'left', padding: 0,
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#e8dfc8'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(200,195,220,0.45)'}
          >
            ↺ Clear palette
          </button>

          {filled.length > 0 && (
            <div
              onClick={() => setAttachPalette(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                cursor: 'pointer', padding: '9px 10px',
                background: attachPalette ? 'rgba(232,223,200,0.07)' : 'rgba(180,170,230,0.05)',
                border: `1px solid ${attachPalette ? '#e8dfc8' : 'rgba(180,170,230,0.2)'}`,
                borderRadius: 10, transition: 'all 0.15s',
              }}
            >
              {/* Toggle pill */}
              <div style={{
                width: 36, height: 20, borderRadius: 10, flexShrink: 0,
                background: attachPalette ? '#e8dfc8' : 'rgba(180,170,230,0.2)',
                position: 'relative', transition: 'background 0.2s',
              }}>
                <div style={{
                  width: 14, height: 14,
                  background: attachPalette ? '#0d0f1c' : 'rgba(180,170,230,0.5)',
                  borderRadius: '50%', position: 'absolute', top: 3,
                  left: attachPalette ? 18 : 3, transition: 'left 0.2s',
                }} />
              </div>
              <span style={{ fontSize: 11, color: attachPalette ? '#e8dfc8' : 'rgba(200,195,220,0.55)' }}>
                {attachPalette
                  ? `Sending ${filled.length} colors with message`
                  : 'Include palette with next message'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
