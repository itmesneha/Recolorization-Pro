import { useRef } from 'react';

export default function InputBar({
  input, setInput, onSend, onFile,
  attachedFile, onRemoveAttachment,
  canSend, loading,
  attachPalette, paletteCount,
}) {
  const fileRef = useRef(null);
  const textareaRef = useRef(null);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const handleInput = (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 110) + 'px';
  };

  return (
    <div style={{
      padding: '10px 16px 14px',
      borderTop: '1px solid rgba(180,170,230,0.15)',
      flexShrink: 0,
    }}>
      {/* Attachment preview */}
      {attachedFile && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
          padding: '6px 10px',
          background: 'rgba(232,223,200,0.06)', borderRadius: 10,
          border: '1px solid rgba(232,223,200,0.2)',
        }}>
          <img
            src={attachedFile.url} alt=""
            style={{ width: 34, height: 34, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
          />
          <span style={{
            fontSize: 12, color: '#e8dfc8', flex: 1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {attachedFile.name}
          </span>
          <button
            onClick={onRemoveAttachment}
            style={{
              background: 'none', border: 'none', color: 'rgba(200,195,220,0.55)',
              cursor: 'pointer', fontSize: 15, padding: '0 2px', lineHeight: 1,
            }}
          >✕</button>
        </div>
      )}

      {/* Palette-attached indicator */}
      {attachPalette && paletteCount > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
          padding: '5px 10px',
          background: 'rgba(232,223,200,0.05)', borderRadius: 8,
          border: '1px solid rgba(232,223,200,0.18)',
        }}>
          <span style={{ fontSize: 13 }}>🎨</span>
          <span style={{ fontSize: 11, color: '#e8dfc8' }}>
            {paletteCount} palette colors will be included
          </span>
        </div>
      )}

      {/* Input row */}
      <div style={{
        display: 'flex', gap: 8, alignItems: 'flex-end',
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(180,170,230,0.2)',
        borderRadius: 16, padding: '8px 8px 8px 12px',
        boxShadow: '0 2px 16px rgba(0,0,0,0.3)',
      }}>
        {/* Image attach */}
        <button
          onClick={() => fileRef.current.click()}
          title="Attach image"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: attachedFile ? '#e8dfc8' : 'rgba(200,195,220,0.5)',
            fontSize: 17, padding: '3px 4px', flexShrink: 0,
            display: 'flex', alignItems: 'center',
            transition: 'color 0.15s',
          }}
        >📎</button>
        <input
          ref={fileRef} type="file" accept="image/*"
          style={{ display: 'none' }}
          onChange={e => { onFile(e.target.files[0]); e.target.value = ''; }}
        />

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={
            attachPalette && paletteCount > 0
              ? 'Palette ready — describe or ask to recolor…'
              : 'Describe a mood, ask to recolor, or ask for palette suggestions…'
          }
          rows={1}
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            color: '#ede8d8', fontSize: 14, lineHeight: 1.55,
            padding: '3px 0', maxHeight: 110, overflowY: 'auto',
            fontFamily: 'inherit', resize: 'none',
          }}
        />

        {/* Send button */}
        <button
          onClick={onSend}
          disabled={!canSend}
          title="Send (Enter)"
          style={{
            width: 34, height: 34, borderRadius: 10, border: 'none', flexShrink: 0,
            background: canSend
              ? 'linear-gradient(135deg,#e8dfc8,#b4a8d4)'
              : 'rgba(180,170,230,0.1)',
            color: canSend ? '#0d0f1c' : 'rgba(180,170,230,0.35)',
            cursor: canSend ? 'pointer' : 'not-allowed',
            fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
            boxShadow: canSend ? '0 4px 16px rgba(180,160,230,0.35)' : 'none',
          }}
        >↑</button>
      </div>

      <p style={{ fontSize: 10, color: 'rgba(200,195,220,0.4)', marginTop: 5, paddingLeft: 2 }}>
        Enter to send · Shift+Enter for newline · Build palette on the left · Drag &amp; drop image
      </p>
    </div>
  );
}
