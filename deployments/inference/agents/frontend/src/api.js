const API = import.meta.env.VITE_API_URL || '';

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
