const API = import.meta.env.VITE_API_URL || '';

/**
 * Streaming version of sendChat.
 * Yields SSE event objects: { type: 'log'|'done'|'error', ... }
 */
export async function* sendChatStreaming({ sessionId, message, imageBase64, imageFilename }) {
  const res = await fetch(`${API}/agent/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId || null,
      message,
      image_base64: imageBase64 || null,
      image_filename: imageFilename || null,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep last incomplete line
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const raw = line.slice(6).trim();
        if (raw) {
          try { yield JSON.parse(raw); } catch { /* ignore malformed */ }
        }
      }
    }
  }
}

export async function sendChat({ sessionId, message, imageBase64, imageFilename }) {
  const res = await fetch(`${API}/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId || null,
      message,
      image_base64: imageBase64 || null,
      image_filename: imageFilename || null,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function selectPalette(sessionId, index) {
  const res = await fetch(`${API}/agent/chat/${sessionId}/select-palette/${index}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
