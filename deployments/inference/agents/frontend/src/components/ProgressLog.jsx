import { useRef, useEffect } from 'react';

// Per-logger display metadata.
// `summary`: when set, this fixed string is shown instead of the raw log message,
//            and all entries from that logger are collapsed into a single line.
const LOGGER_META = {
  chat_agent:     { label: 'chat',     color: '#9ab4cc', summary: 'Processing chat...' },
  input_analyzer: { label: 'analyzer', color: '#e8dfc8', summary: 'Analyzing input...' },
  image_agent:    { label: 'image',    color: '#7eb8f7' },
  palette_agent:  { label: 'palette',  color: '#c8a0e8' },
  slot_checker:   { label: 'checker',  color: '#8fd4a8' },
  recolor_agent:  { label: 'recolor',  color: '#f5d67a' },
  routing:        { label: 'route',    color: '#b4a8d4' },
};

// Strip redundant "logger_name | " prefix that some nodes prepend
function cleanMsg(msg, loggerName) {
  const prefix = `${loggerName} | `;
  return msg.startsWith(prefix) ? msg.slice(prefix.length) : msg;
}

// Build the display list:
// - Loggers with `summary` → one deduplicated entry showing the summary text
// - Other loggers         → every entry shown with its raw message
function buildDisplayRows(logs) {
  const rows = [];
  const summarySeen = new Set();

  for (const log of logs) {
    const meta = LOGGER_META[log.logger];
    if (!meta) continue;

    if (meta.summary) {
      if (!summarySeen.has(log.logger)) {
        summarySeen.add(log.logger);
        rows.push({ logger: log.logger, level: log.level, msg: meta.summary, isSummary: true });
      }
      // subsequent entries from the same summarised logger are silently dropped
    } else {
      rows.push({ logger: log.logger, level: log.level, msg: cleanMsg(log.msg, log.logger) });
    }
  }
  return rows;
}

// Derive the label + color of the most recent active logger
function currentStageMeta(logs) {
  for (let i = logs.length - 1; i >= 0; i--) {
    const meta = LOGGER_META[logs[i].logger];
    if (meta) return meta;
  }
  return null;
}

export default function ProgressLog({ logs }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  const rows = buildDisplayRows(logs);
  const stageMeta = currentStageMeta(logs.filter(l => LOGGER_META[l.logger]));

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 14 }}>
      {/* Agent avatar */}
      <div style={{
        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
        background: 'linear-gradient(135deg,#e8dfc8,#b4a8d4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
        animation: 'dreamGlow 3s ease-in-out infinite',
      }}>✦</div>

      <div style={{
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(180,170,230,0.15)',
        borderRadius: '18px 18px 18px 4px',
        padding: '10px 14px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
        minWidth: 240, maxWidth: 540,
        display: 'flex', flexDirection: 'column', gap: 0,
      }}>

        {/* Header: bouncing dots + current stage label */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          paddingBottom: rows.length > 0 ? 8 : 0,
          borderBottom: rows.length > 0 ? '1px solid rgba(180,170,230,0.1)' : 'none',
          marginBottom: rows.length > 0 ? 8 : 0,
        }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'rgba(200,195,220,0.7)',
              animation: `bounce 1.2s ${i * 0.18}s ease-in-out infinite`,
              flexShrink: 0,
            }} />
          ))}
          {stageMeta && (
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
              color: stageMeta.color,
              textTransform: 'uppercase', marginLeft: 2,
              transition: 'color 0.3s ease',
            }}>{stageMeta.label}</span>
          )}
        </div>

        {/* Log rows */}
        {rows.length > 0 && (
          <div style={{
            maxHeight: 180, overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            {rows.map((row, i) => {
              const meta = LOGGER_META[row.logger];
              return (
                <div
                  key={i}
                  className="msg-enter"
                  style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}
                >
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                    color: meta.color, textTransform: 'uppercase',
                    flexShrink: 0, minWidth: 54, opacity: 0.9,
                  }}>{meta.label}</span>
                  <span style={{
                    fontSize: 11,
                    color: row.level === 'warning' || row.level === 'error'
                      ? 'rgba(245,180,100,0.8)'
                      : row.isSummary
                        ? 'rgba(200,195,220,0.45)'   // dimmer for summary lines
                        : 'rgba(200,195,220,0.6)',
                    lineHeight: 1.45,
                    wordBreak: 'break-word',
                    fontFamily: "'SF Mono', 'Fira Code', monospace",
                    whiteSpace: 'pre-wrap',
                    fontStyle: row.isSummary ? 'italic' : 'normal',
                  }}>
                    {row.msg.length > 140 ? row.msg.slice(0, 140) + '…' : row.msg}
                  </span>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  );
}
