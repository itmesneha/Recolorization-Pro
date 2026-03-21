export default function ResultImage({ b64, count }) {
  const url = `data:image/png;base64,${b64}`;
  return (
    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{
        borderRadius: 12, overflow: 'hidden',
        border: '1px solid var(--accent)', background: 'rgba(0,0,0,0.2)',
      }}>
        <img src={url} alt="recolored" style={{
          width: '100%', maxHeight: 240, objectFit: 'contain', display: 'block',
        }} />
      </div>
      <a href={url} download={`recolored_${count}.png`} style={{
        display: 'block', textAlign: 'center', padding: '8px 0', borderRadius: 10,
        background: 'rgba(225,217,188,0.1)', border: '1px solid var(--accent)',
        color: 'var(--accent)', fontSize: 12, fontWeight: 600, textDecoration: 'none',
      }}>
        ↓ Download PNG
      </a>
    </div>
  );
}
