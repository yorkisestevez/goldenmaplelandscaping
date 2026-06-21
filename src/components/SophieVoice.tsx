import { useEffect, createElement } from 'react';

// Sophie — web voice agent (ElevenLabs ConvAI embed).
//
// Renders ONLY when a web/ConvAI agent id is configured, so the site is safe to
// ship before the voice agent exists. To enable:
//   1. ElevenLabs → Conversational AI → create (or reuse) a web agent for Sophie.
//   2. Copy its public Agent ID.
//   3. Netlify → Environment variables → add VITE_ELEVENLABS_AGENT_ID = <id>, redeploy.
// The official embed injects its own floating "talk" button.
const AGENT_ID = import.meta.env.VITE_ELEVENLABS_AGENT_ID as string | undefined;

export default function SophieVoice() {
  useEffect(() => {
    if (!AGENT_ID) return;
    if (document.querySelector('script[data-elevenlabs-convai]')) return;
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed';
    s.async = true;
    s.setAttribute('data-elevenlabs-convai', '');
    document.body.appendChild(s);
  }, []);

  if (!AGENT_ID) return null;
  // Custom element — use createElement to avoid JSX intrinsic-element typing.
  return createElement('elevenlabs-convai', { 'agent-id': AGENT_ID });
}
