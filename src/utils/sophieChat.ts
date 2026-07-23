/**
 * sophieChat — the website talks to the SAME Sophie who answers the phone.
 *
 * Until now the site had its own chatbot (a DeepSeek prompt in a Netlify
 * function) that knew nothing about the CRM: it could only capture a lead
 * through a text sentinel and had a separate personality to maintain. This
 * connects the browser to the real ElevenLabs agent in text-only mode, so
 * website visitors get the same assistant — with her real tools (booking,
 * taking a message) writing straight into the CRM.
 *
 * No API key ships to the browser: the agent is public and locked to our
 * domains by an ElevenLabs allowlist. Voice is never started, so a website
 * conversation costs LLM tokens only, not call minutes.
 */

const AGENT_ID = 'agent_8901knsvwj12f57axdj4z9fm9gzs';
const WS_URL = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${AGENT_ID}`;

/** How long to wait for the socket to come up before falling back. */
const CONNECT_TIMEOUT_MS = 8000;

export interface SophieSession {
  send: (text: string) => void;
  close: () => void;
}

export interface SophieHandlers {
  onReply: (text: string) => void;
  /** Fired once if the session can't be established or drops unexpectedly. */
  onUnavailable: () => void;
}

/**
 * Open a text-only conversation. Resolves once Sophie's session is live;
 * rejects if it can't connect, so the caller can fall back to canned answers.
 */
export function openSophieSession(handlers: SophieHandlers): Promise<SophieSession> {
  return new Promise((resolve, reject) => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(WS_URL);
    } catch {
      reject(new Error('websocket unavailable'));
      return;
    }

    let ready = false;
    const timer = setTimeout(() => {
      if (!ready) {
        try { ws.close(); } catch { /* already closing */ }
        reject(new Error('timeout'));
      }
    }, CONNECT_TIMEOUT_MS);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'conversation_initiation_client_data',
        conversation_config_override: {
          // text_only keeps this a chat: no audio is generated or billed.
          conversation: { text_only: true },
          // Her phone greeting ("thanks for calling…") is wrong here, and the
          // widget already shows its own opener — blank it so the first thing
          // she says is an actual answer.
          agent: { first_message: ' ' },
        },
      }));
    };

    ws.onmessage = (ev) => {
      let msg: Record<string, unknown>;
      try { msg = JSON.parse(String(ev.data)); } catch { return; }

      switch (msg.type) {
        case 'conversation_initiation_metadata':
          ready = true;
          clearTimeout(timer);
          resolve({
            send: (text: string) => ws.send(JSON.stringify({ type: 'user_message', text })),
            close: () => { try { ws.close(); } catch { /* already closing */ } },
          });
          break;
        case 'ping': {
          // Keepalive — the socket is dropped if these go unanswered.
          const id = (msg.ping_event as { event_id?: number } | undefined)?.event_id;
          ws.send(JSON.stringify({ type: 'pong', event_id: id }));
          break;
        }
        case 'agent_response': {
          const reply = (msg.agent_response_event as { agent_response?: string } | undefined)?.agent_response;
          if (reply && reply.trim()) handlers.onReply(reply.trim());
          break;
        }
        default:
          break; // audio / vad / interruption events are irrelevant in text mode
      }
    };

    ws.onerror = () => {
      clearTimeout(timer);
      if (ready) handlers.onUnavailable();
      else reject(new Error('connection error'));
    };

    ws.onclose = () => {
      clearTimeout(timer);
      if (ready) handlers.onUnavailable();
      else reject(new Error('closed before ready'));
    };
  });
}
