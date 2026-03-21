export default function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <div style={{
        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
        background: 'linear-gradient(135deg,#e8dfc8,#b4a8d4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
        animation: 'dreamGlow 3s ease-in-out infinite',
      }}>✦</div>
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(180,170,230,0.2)',
        borderRadius: '18px 18px 18px 4px', padding: '12px 16px',
        display: 'flex', gap: 5, alignItems: 'center',
        boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
      }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 7, height: 7, borderRadius: '50%',
            background: 'rgba(200,195,220,0.7)',
            animation: `bounce 1.2s ${i * 0.18}s ease-in-out infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}
