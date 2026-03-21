import { useState, useRef, useEffect, useCallback } from 'react';
import { sendChatStreaming, selectPalette } from './api';
import { fileToBase64 } from './utils';
import LeftPanel from './components/LeftPanel';
import MessageBubble from './components/MessageBubble';
import ProgressLog from './components/ProgressLog';
import SidePanel from './components/SidePanel';
import InputBar from './components/InputBar';

const WELCOME =
  "Hi! I'm your recolorization assistant.\n\n" +
  "Here's how to get started:\n" +
  "1. Upload an image using the left panel\n" +
  "2. Build a palette with the color wheel, presets, or hex input\n" +
  "3. Toggle \"Include palette\" and send a message — or just describe what you want!";

export default function App() {
  const [messages, setMessages]   = useState([{ role: 'agent', content: WELCOME }]);
  const [input, setInput]         = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [progressLogs, setProgressLogs] = useState([]);
  const [dragOver, setDragOver]   = useState(false);

  // Shared attachment state (left panel upload or chat input attach)
  const [attachedFile, setAttachedFile] = useState(null);
  const [attachedB64, setAttachedB64]   = useState(null);

  // Session-level display state (side panel)
  const [currentImageUrl, setCurrentImageUrl] = useState(null);
  const [currentResult, setCurrentResult]     = useState(null);
  const [currentPalette, setCurrentPalette]   = useState(null);
  const [recolorCount, setRecolorCount]       = useState(0);

  // Palette builder state (left panel)
  const [palette, setPalette]           = useState(Array(6).fill(null));
  const [attachPalette, setAttachPalette] = useState(false);

  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // ── File handling ────────────────────────────────────────────────────────
  const handleFile = useCallback(async (file) => {
    if (!file?.type.startsWith('image/')) return;
    const b64 = await fileToBase64(file);
    const url = URL.createObjectURL(file);
    setAttachedFile(prev => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return { name: file.name, url };
    });
    setAttachedB64(b64);
  }, []);

  const removeAttachment = useCallback(() => {
    setAttachedFile(prev => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
    setAttachedB64(null);
  }, []);

  // ── Send ─────────────────────────────────────────────────────────────────
  const send = async () => {
    const text = input.trim();
    const filledColors = palette.filter(Boolean);
    if (!text && !attachedB64) return;
    if (loading) return;

    // Append palette hex codes to message if the toggle is on
    let finalMessage = text;
    if (attachPalette && filledColors.length > 0) {
      const hexList = filledColors.join(', ');
      finalMessage = text
        ? `${text}\n\n[Custom palette: ${hexList}]`
        : `Please use this palette: ${hexList}`;
    }

    const userMsg = {
      role: 'user',
      content: text || (attachedB64 ? 'I have uploaded an image.' : finalMessage),
      image_url: attachedFile?.url || null,
      customPalette: attachPalette && filledColors.length > 0 ? filledColors : null,
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setProgressLogs([]);

    const b64Snap = attachedB64;
    const fnSnap  = attachedFile?.name;
    const urlSnap = attachedFile?.url;
    // Clear the attachment without revoking the URL — we may need it for currentImageUrl
    setAttachedFile(null);
    setAttachedB64(null);
    setLoading(true);

    try {
      const stream = sendChatStreaming({
        sessionId,
        message: finalMessage || 'I have uploaded an image.',
        imageBase64: b64Snap,
        imageFilename: fnSnap,
      });

      for await (const event of stream) {
        if (event.type === 'log') {
          setProgressLogs(prev => [...prev, event]);
        } else if (event.type === 'done') {
          const data = event;
          setSessionId(data.session_id);
          if (data.has_image && urlSnap) {
            setCurrentImageUrl(prev => {
              if (prev) URL.revokeObjectURL(prev);
              return urlSnap;
            });
          }
          if (data.has_palette && data.palette)  setCurrentPalette(data.palette);
          if (data.result_base64) {
            setCurrentResult(data.result_base64);
            setRecolorCount(data.recolor_count || 0);
          }
          setMessages(prev => [...prev, {
            role: 'agent',
            content: data.response,
            palette: data.has_palette ? data.palette : null,
            palette_candidates: data.palette_candidates?.length > 1 ? data.palette_candidates : null,
            result_b64:    data.result_base64 || null,
            recolor_count: data.recolor_count,
          }]);
          if (data.error) {
            setMessages(prev => [...prev, { role: 'agent', content: `⚠ ${data.error}` }]);
          }
        } else if (event.type === 'error') {
          setMessages(prev => [...prev, { role: 'agent', content: `⚠ ${event.content}` }]);
        }
      }
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'agent',
        content: `Connection error: ${e.message}\n\nIs the server running at port 8001?`,
      }]);
    } finally {
      setLoading(false);
      setProgressLogs([]);
    }
  };

  // ── Palette candidate selection ───────────────────────────────────────────
  const pickPalette = async (index) => {
    if (!sessionId) return;
    try {
      const data = await selectPalette(sessionId, index);
      setCurrentPalette(data.palette);
      setMessages(prev => [...prev, {
        role: 'agent',
        content: `Selected: ${data.description}`,
        palette: data.palette,
      }]);
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'agent', content: `Error selecting palette: ${e.message}`,
      }]);
    }
  };

  // ── New chat ──────────────────────────────────────────────────────────────
  const newChat = () => {
    if (attachedFile?.url) URL.revokeObjectURL(attachedFile.url);
    setAttachedFile(null);
    setAttachedB64(null);
    if (currentImageUrl) URL.revokeObjectURL(currentImageUrl);
    setMessages([{ role: 'agent', content: WELCOME }]);
    setSessionId(null);
    setInput('');
    setCurrentImageUrl(null);
    setCurrentResult(null);
    setCurrentPalette(null);
    setRecolorCount(0);
    setPalette(Array(6).fill(null));
    setAttachPalette(false);
  };

  const canSend = !loading && (input.trim().length > 0 || !!attachedB64);
  const filledCount = palette.filter(Boolean).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>

      {/* ── Header ── */}
      <header style={{
        padding: '11px 20px',
        borderBottom: '1px solid rgba(180,170,230,0.15)',
        display: 'flex', alignItems: 'center', gap: 12,
        flexShrink: 0,
        background: 'rgba(13,15,28,0.85)',
        backdropFilter: 'blur(20px)',
        zIndex: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg,#e8dfc8,#b4a8d4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
          animation: 'dreamGlow 3s ease-in-out infinite',
        }}>✦</div>

        <div style={{ flex: 1 }}>
          <h1 style={{
            fontSize: 16, fontWeight: 800, letterSpacing: '-0.3px',
            background: 'linear-gradient(135deg,#e8dfc8,#b4a8d4)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            lineHeight: 1.2,
          }}>Recolorize!</h1>
          <p style={{ fontSize: 10, color: '#ACBAC4', marginTop: 1 }}>
            {sessionId ? `Session ${sessionId.slice(0, 8)}…` : 'No active session'}
          </p>
        </div>

        <button
          onClick={newChat}
          title="Reset chat"
          style={{
            background: 'none', border: '1px solid rgba(180,170,230,0.35)',
            borderRadius: 8, padding: '5px 12px',
            color: 'var(--lavender)', fontSize: 11, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
            transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#e8dfc8'; e.currentTarget.style.color = '#e8dfc8'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(180,170,230,0.35)'; e.currentTarget.style.color = 'var(--lavender)'; }}
        >
          <span style={{ fontSize: 13 }}>↺</span> New chat
        </button>
      </header>

      {/* ── Body ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Left panel */}
        <LeftPanel
          attachedFile={attachedFile}
          onFile={handleFile}
          onRemoveAttachment={removeAttachment}
          palette={palette}
          setPalette={setPalette}
          attachPalette={attachPalette}
          setAttachPalette={setAttachPalette}
        />

        {/* Chat column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Messages */}
          <div
            style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 6px', position: 'relative' }}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={async (e) => {
              e.preventDefault();
              setDragOver(false);
              await handleFile(e.dataTransfer.files[0]);
            }}
          >
            {dragOver && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(225,217,188,0.05)',
                border: '2px dashed #E1D9BC',
                borderRadius: 12, zIndex: 10, pointerEvents: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 18, color: '#E1D9BC', fontWeight: 700 }}>
                  Drop image to attach
                </span>
              </div>
            )}

            {messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} onPick={pickPalette} />
            ))}
            {loading && <ProgressLog logs={progressLogs} />}
            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <InputBar
            input={input}
            setInput={setInput}
            onSend={send}
            onFile={handleFile}
            attachedFile={attachedFile}
            onRemoveAttachment={removeAttachment}
            canSend={canSend}
            loading={loading}
            attachPalette={attachPalette}
            paletteCount={filledCount}
          />
        </div>

        {/* Side panel */}
        <SidePanel
          currentResult={currentResult}
          currentPalette={currentPalette}
          recolorCount={recolorCount}
        />
      </div>
    </div>
  );
}
