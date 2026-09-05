import { useState, useRef, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, X, Send, Leaf } from 'lucide-react';
import { trackEngagement, trackCall, trackLead } from '../utils/analytics';
import { openSophieSession, type SophieSession } from '../utils/sophieChat';
import { BUSINESS, publicClaimCopy, publicContact } from '../data/business';

type Role = 'user' | 'assistant';
interface Msg { role: Role; content: string }

/** Legacy DeepSeek chat function — now only a fallback if the live agent is unreachable. */
const CHAT_ENDPOINT = '/.netlify/functions/chat';

const GREETING =
  "Hi! I'm Sophie. Ask me about our services, process, service areas, or a project conversation. For numbers, the cost estimator can provide a planning range.";

const SUGGESTIONS = [
  'Can you help me book a project call?',
  "What's your warranty?",
  'Which areas do you serve?',
  'Do you build composite decks?',
];

/** Local canned answers so the widget is fully testable in `vite dev` (no function/key).
 *  Production uses the real DeepSeek-backed function — this is only hit when the
 *  endpoint isn't reachable (dev) or errors. */
function fallbackReply(q: string): string {
  const t = q.toLowerCase();
  if (/cost|price|pricing|how much|\$|budget|quote|expensive/.test(t))
    return "The cost calculator can provide an itemized planning range from your project details. Final scope and pricing are confirmed for the specific property.";
  if (/warranty|guarantee|sink|settle/.test(t))
    return `${publicClaimCopy(BUSINESS.credentials.workmanshipWarranty, 'Written workmanship terms are available.')} ${publicClaimCopy(BUSINESS.credentials.wsib, 'Current coverage documentation is available.')}`;
  if (/area|serve|location|barrie|innisfil|orillia|wasaga|midland|collingwood|springwater|oro/.test(t))
    return 'Service availability depends on project scope and address. Contact us to confirm whether your area is currently covered.';
  if (/start|timeline|how soon|when|lead time|book|schedule/.test(t))
    return 'Project timing depends on scope, site conditions, and the current schedule. A project conversation is the best way to discuss timing.';
  return 'Happy to help! I can talk through our services, process, warranty, service areas, and rough pricing. The cost calculator can provide an itemized planning range. What are you planning?';
}

export default function ChatWidget() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([{ role: 'assistant', content: GREETING }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (open) {
      trackEngagement('chat_open');
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [open]);

  // The live agent session. Opened lazily on the first message so visitors who
  // never chat cost nothing, and reused for the rest of the conversation so
  // Sophie keeps her context (and her tools) across turns.
  const sessionRef = useRef<SophieSession | null>(null);
  const liveRef = useRef(true);

  useEffect(() => () => { sessionRef.current?.close(); }, []);

  const addReply = (content: string) => {
    setMessages((m) => [...m, { role: 'assistant', content }]);
    setLoading(false);
  };

  /** Legacy Netlify function → canned answers. Only used if the agent is unreachable. */
  const sendViaFallback = async (content: string, history: Msg[]) => {
    try {
      const res = await fetch(CHAT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Only send role + content; trim history to last 12 turns to bound cost.
        body: JSON.stringify({ messages: history.slice(-12).map((m) => ({ role: m.role, content: m.content })) }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as { reply?: string; leadCaptured?: boolean };
      // Sophie's lead-handoff writes straight to the CRM server-side — this is
      // the only signal the browser gets that it happened, so fire the GA4/
      // Meta/Ads lead event here (mirrors what a form submit does on success).
      if (data.leadCaptured) trackLead('sophie-chat', 'high-intent', undefined, undefined, undefined, { skipQualification: true });
      addReply((data.reply || '').trim() || fallbackReply(content));
    } catch {
      // Dev (no function) or transient error → graceful canned answer.
      addReply(fallbackReply(content));
    }
  };

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || loading) return;
    const next: Msg[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setLoading(true);
    trackEngagement('chat_message', content.slice(0, 60));

    if (!liveRef.current) { await sendViaFallback(content, next); return; }

    try {
      if (!sessionRef.current) {
        sessionRef.current = await openSophieSession({
          onReply: addReply,
          onUnavailable: () => {
            // Session dropped mid-conversation: stop trying, don't lose the visitor.
            liveRef.current = false;
            sessionRef.current = null;
          },
        });
      }
      sessionRef.current.send(content);
      // The reply arrives asynchronously via onReply, which clears `loading`.
    } catch {
      liveRef.current = false;
      sessionRef.current = null;
      await sendViaFallback(content, next);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  // Linkify /cost-estimator, /book, /contact and tel: mentions inside replies.
  const renderContent = (text: string) => {
    const parts = text.split(new RegExp(`(\\/cost-estimator|\\/book|\\/contact|${publicContact.phoneDisplay.replace(/[()]/g, '\\$&')})`));
    return parts.map((p, i) => {
      if (p === '/cost-estimator' || p === '/book' || p === '/contact') {
        return (
          <button
            key={i}
            onClick={() => { setOpen(false); navigate(p); }}
            className="text-brand-green-dark underline underline-offset-2 hover:text-brand-green-dark"
          >
            {p === '/cost-estimator' ? 'cost calculator' : p === '/book' ? 'book a call' : 'contact us'}
          </button>
        );
      }
      if (p === publicContact.phoneDisplay) {
        return <a key={i} href={`tel:${publicContact.phoneTel}`} onClick={() => trackCall('chatwidget_phone')} className="text-brand-green-dark underline underline-offset-2">{p}</a>;
      }
      return <span key={i}>{p}</span>;
    });
  };

  return (
    <>
      {/* Floating button (hidden while panel open). Sits above the mobile action dock. */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.25 }}
            onClick={() => setOpen(true)}
            aria-label="Open chat assistant"
            className="fixed z-[60] right-4 bottom-[84px] xl:right-6 xl:bottom-6 w-14 h-14 rounded-full bg-gradient-to-br from-brand-green to-brand-green-dark text-brand-black flex items-center justify-center shadow-[0_10px_30px_-6px_rgba(95,174,126,0.55)] hover:shadow-[0_14px_38px_-6px_rgba(95,174,126,0.7)] hover:-translate-y-0.5 transition-all gm-live-dot"
          >
            <MessageCircle size={24} strokeWidth={1.75} />
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-brand-green-light border-2 border-brand-nearblack" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="fixed z-[60] right-3 left-3 bottom-[84px] sm:left-auto sm:right-6 xl:bottom-6 sm:w-[384px] h-[68vh] max-h-[600px] flex flex-col rounded-3xl overflow-hidden border border-brand-dim bg-brand-surface shadow-[0_30px_80px_-20px_rgba(33,30,21,0.4)]"
            role="dialog"
            aria-label="Golden Maple chat assistant"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-brand-dim/60 bg-gradient-to-r from-brand-green/15 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-green to-brand-green-dark flex items-center justify-center">
                  <Leaf size={17} className="text-brand-black" strokeWidth={1.75} />
                </div>
                <div>
                  <div className="font-display text-[16px] text-brand-bonewhite leading-none">Sophie</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-green-light" />
                    <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-brand-muted">Online · replies instantly</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close chat" className="text-brand-muted hover:text-brand-bonewhite transition-colors p-1">
                <X size={18} strokeWidth={1.75} />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 space-y-4" aria-live="polite">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[82%] px-4 py-2.5 rounded-2xl font-sans text-[13.5px] leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-brand-gold text-brand-black rounded-br-md'
                        : 'bg-brand-midsurface text-brand-bonewhite border border-brand-dim/60 rounded-bl-md'
                    }`}
                  >
                    {m.role === 'assistant' ? renderContent(m.content) : m.content}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-brand-midsurface border border-brand-dim/60 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
                    {[0, 1, 2].map((d) => (
                      <motion.span
                        key={d}
                        className="w-1.5 h-1.5 rounded-full bg-brand-green-light"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1, repeat: Infinity, delay: d * 0.18 }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested questions — only at the start */}
              {messages.length <= 1 && !loading && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => void send(s)}
                      className="px-3 py-2 rounded-full border border-brand-green/40 text-brand-green-dark font-sans text-[12px] hover:bg-brand-green/10 hover:border-brand-green transition-colors text-left"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Input */}
            <form onSubmit={onSubmit} className="px-3 py-3 border-t border-brand-dim/60 flex items-center gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about pricing, services, timing…"
                aria-label="Type your message"
                className="flex-1 bg-brand-nearblack border border-brand-dim rounded-full px-4 py-2.5 font-sans text-[13.5px] text-brand-ink placeholder-brand-ink/40 focus:border-brand-green outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                aria-label="Send message"
                className="w-10 h-10 shrink-0 rounded-full bg-brand-green text-brand-black flex items-center justify-center hover:bg-brand-green-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={16} strokeWidth={2} />
              </button>
            </form>
            <p className="text-center text-[10px] text-brand-muted/70 font-light pb-2 px-4">
              Estimates are rough — exact pricing comes from a site visit. Not a binding quote.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
