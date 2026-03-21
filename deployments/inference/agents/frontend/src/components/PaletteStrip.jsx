import { toHex } from '../utils';

export default function PaletteStrip({ colors }) {
  if (!colors?.length) return null;
  return (
    <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
      {colors.map((c, i) => {
        const hex = Array.isArray(c) ? toHex(c) : c;
        return (
          <div key={i} title={hex} style={{
            width: 26, height: 26, borderRadius: 7, backgroundColor: hex,
            border: '1px solid rgba(255,255,255,0.12)', flexShrink: 0,
          }} />
        );
      })}
    </div>
  );
}
