import { useState, useRef, useEffect, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { X, Send, ArrowRight } from 'lucide-react';
import { trackEngagement, trackCall, trackLead } from '../utils/analytics';
import { openSophieSession, type SophieSession } from '../utils/sophieChat';
import { BUSINESS, publicClaimCopy, publicContact } from '../data/business';
import { ESTIMATOR_LOCATIONS, type EstimatorLocationKey } from '../data/locations';
import {
  QUICK_PROJECTS, QUICK_SIZES, type QuickProject, type QuickRangeInput, type QuickSize,
} from '../data/sophieQuoteOptions';
import {
  pickTeaser, shouldShowTeaser, isPriceQuestion, projectFromText, COST_CHIP, BOOK_CHIP,
  TEASER_DELAY_MS, TEASER_SCROLL_RATIO, TEASER_AUTOHIDE_MS, TEASER_STORAGE_KEY,
  type Teaser, type TeaserMemory,
} from '../data/sophieTeasers';
import type { QuickRange } from '../utils/sophieQuote';
import SophieMark from './SophieMark';
import { guardReply, MAX_SHOWN_RANGES, PRICE_REDACTION } from '../utils/sophieGuard';
import { underPath } from '../utils/trailingSlash';

type Role = 'user' | 'assistant';
type PricedRange = Extract<QuickRange, { kind: 'range' }>;
/** `offerRange`: the guard removed a price from this AI reply, so offer the estimator's real range instead. */
interface Msg { role: Role; content: string; range?: PricedRange; designerHref?: string; offerRange?: boolean }

/** The 3-tap range, one step at a time. */
type Flow =
  | { step: 'project' }
  | { step: 'size'; project: QuickProject }
  | { step: 'city'; project: QuickProject; size: QuickSize };

/** Legacy DeepSeek chat function — now only a fallback if the live agent is unreachable. */
const CHAT_ENDPOINT = '/.netlify/functions/chat';

const GREETING =
  "Hi, I'm Sophie. I can pull a planning range for your project from our cost estimator, or answer questions about our services, process and service areas.";

const SUGGESTIONS = [COST_CHIP, BOOK_CHIP, "What's your warranty?", 'Which areas do you serve?'];

const greetingFor = (pathname: string) => pickTeaser(pathname)?.line ?? GREETING;
const projectMeta = (id: QuickProject) => QUICK_PROJECTS.find((p) => p.id === id)!;
const money = (n: number) => `$${n.toLocaleString('en-CA')}`;

/** Local canned answers so the widget is fully testable in `vite dev` (no function/key).
 *  Production uses the real DeepSeek-backed function — this is only hit when the
 *  endpoint isn't reachable (dev) or errors. */
function fallbackReply(q: string): string {
  const t = q.toLowerCase();
  if (/cost|price|pricing|how much|\$|budget|quote|expensive/.test(t))
    return "The cost calculator can provide an itemized planning range from your project details. Final scope and pricing are confirmed for the specific property.";
  if (/warranty|guarantee|sink|settle/.test(t)) {
    const warranty = publicClaimCopy(BUSINESS.credentials.workmanshipWarranty, '');
    const coverage = publicClaimCopy(BUSINESS.credentials.wsib, '');
    const known = [warranty, coverage].filter(Boolean).join(' ');
    return known || 'Workmanship terms are written into the agreement for that project. Call and we will walk through what the agreement covers before you sign.';
  }
  if (/area|serve|location|barrie|innisfil|orillia|wasaga|midland|collingwood|springwater|bradford|newmarket|oro/.test(t))
    return 'Service availability depends on project scope and address. Contact us to confirm whether your area is currently covered.';
  if (/start|timeline|how soon|when|lead time|book|schedule/.test(t))
    return 'Project timing depends on scope, site conditions, and the current schedule. A project conversation is the best way to discuss timing.';
  return 'Happy to help! I can talk through our services, process, warranty, service areas, and rough pricing. The cost calculator can provide an itemized planning range. What are you planning?';
}

/** sessionStorage can throw (private mode, blocked storage); the teaser then simply shows once per page view. */
function readTeaserMemory(): TeaserMemory {
  try {
    const v = sessionStorage.getItem(TEASER_STORAGE_KEY);
    return v === 'seen' || v === 'dismissed' ? v : null;
  } catch { return null; }
}
function writeTeaserMemory(v: Exclude<TeaserMemory, null>) {
  try { sessionStorage.setItem(TEASER_STORAGE_KEY, v); } catch { /* storage blocked */ }
}

export default function ChatWidget() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [pastHero, setPastHero] = useState(pathname !== '/');
  const [messages, setMessages] = useState<Msg[]>([{ role: 'assistant', content: greetingFor(pathname) }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [teaser, setTeaser] = useState<Teaser | null>(null);
  const [unread, setUnread] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const userTurns = messages.filter((m) => m.role === 'user').length;
  const chatted = userTurns > 0;
  const launcherVisible = pastHero && !underPath(pathname, '/contact');

  // The latest planning range and the tap choices behind it.
  const lastRangeRef = useRef<{ range: PricedRange; choice: QuickRangeInput } | null>(null);
  /** Every range shown in this conversation (newest last, at most MAX_SHOWN_RANGES): Sophie may repeat any of them. */
  const shownRangesRef = useRef<{ range: PricedRange; choice: QuickRangeInput }[]>([]);
  // Range context waiting for the live agent session to open.
  const pendingContextRef = useRef<string | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading, flow]);

  useEffect(() => {
    if (open) {
      trackEngagement('chat_open');
      // Opening the chat is the nudge's job done; never pop it up afterwards.
      if (readTeaserMemory() === null) writeTeaserMemory('seen');
      setUnread(false);
      setTeaser(null);
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [open]);

  // Never auto-open. Stay off the homepage hero and off /contact/, where the form is the page.
  useEffect(() => {
    if (underPath(pathname, '/contact')) setOpen(false);
  }, [pathname]);

  // Until the visitor says something, Sophie's opener follows the page they're on.
  useEffect(() => {
    if (!chatted && !flow) setMessages([{ role: 'assistant', content: greetingFor(pathname) }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (pathname !== '/') {
      setPastHero(true);
      return;
    }
    const hero = document.querySelector('.home-hero');
    if (!hero) {
      setPastHero(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setPastHero(!entry.isIntersecting),
      { threshold: 0.2 },
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, [pathname]);

  // The one proactive nudge per session: after a dwell or a real scroll, never over the open panel.
  useEffect(() => {
    setTeaser(null);
    if (!launcherVisible || !shouldShowTeaser({ pathname, stored: readTeaserMemory(), chatted, open })) return;
    const candidate = pickTeaser(pathname)!;
    let timer = 0;
    const stop = () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
    };
    const fire = () => {
      stop();
      writeTeaserMemory('seen');
      setTeaser(candidate);
      setUnread(true);
      trackEngagement('chat_teaser_shown', candidate.key);
    };
    function onScroll() {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable > 0 && window.scrollY / scrollable >= TEASER_SCROLL_RATIO) fire();
    }
    timer = window.setTimeout(fire, TEASER_DELAY_MS);
    window.addEventListener('scroll', onScroll, { passive: true });
    return stop;
  }, [pathname, launcherVisible, chatted, open]);

  useEffect(() => {
    if (!teaser) return;
    const t = window.setTimeout(() => setTeaser(null), TEASER_AUTOHIDE_MS);
    return () => window.clearTimeout(t);
  }, [teaser]);

  const dismissTeaser = () => {
    writeTeaserMemory('dismissed');
    setTeaser(null);
    setUnread(false);
    trackEngagement('chat_teaser_dismiss', teaser?.key);
  };

  // The live agent session. Opened lazily on the first message so visitors who
  // never chat cost nothing, and reused for the rest of the conversation so
  // Sophie keeps her context (and her tools) across turns.
  const sessionRef = useRef<SophieSession | null>(null);
  const liveRef = useRef(true);

  useEffect(() => () => { sessionRef.current?.close(); }, []);

  const say = (msg: Msg) => setMessages((m) => [...m, msg]);

  /** Every AI reply passes the guard first: no price but the given range, no blocked business claim. */
  /** `fromModel`: AI text, so it is guarded. The widget's own canned lines are written by us and shown as is. */
  const addReply = (content: string, fromModel = true) => {
    if (!fromModel) {
      say({ role: 'assistant', content });
      setLoading(false);
      return;
    }
    const guarded = guardReply(content, shownRangesRef.current.map(({ range }) => ({ low: range.low, high: range.high })));
    // Counts and claim ids only: the invented price itself is not worth sending anywhere.
    if (guarded.changed) trackEngagement('chat_reply_guarded', `prices:${guarded.redactedPrices.length} ${guarded.blockedClaims.join(' ')}`.slice(0, 60));
    // The fallback function may already have redacted a price server-side; offer the real range either way.
    say({ role: 'assistant', content: guarded.text, offerRange: guarded.text.includes(PRICE_REDACTION) });
    setLoading(false);
  };

  /** /book with the service and (when there is one) the range already filled in — the card's own
   *  range when booked from a card, otherwise the latest one. */
  const goBook = (source: string, range: PricedRange | undefined = lastRangeRef.current?.range) => {
    const pageProject = pickTeaser(pathname)?.project;
    trackEngagement('chat_book_click', source);
    setTeaser(null);
    setOpen(false);
    // Already on /book: its scheduler reads prefill only on arrival, so just reveal it.
    if (underPath(pathname, '/book')) return;
    navigate('/book', {
      state: {
        serviceInterest: range?.serviceInterest ?? (pageProject ? projectMeta(pageProject).serviceInterest : undefined),
        bookingNotes: range?.bookingNotes ?? `Sent from Sophie chat on ${pathname}.`,
      },
    });
  };

  const goTo = (href: string, label: string) => {
    trackEngagement('chat_link_click', label);
    setOpen(false);
    navigate(href);
  };

  // ---- 3-tap planning range: deterministic, priced by the estimator engine ----

  const askSize = (project: QuickProject) => {
    say({ role: 'assistant', content: `Roughly how big is the ${projectMeta(project).noun}?` });
    setFlow({ step: 'size', project });
  };

  const startQuote = (project?: QuickProject) => {
    trackEngagement('chat_range_start', project ?? 'none');
    if (project) { askSize(project); return; }
    say({ role: 'assistant', content: 'Happy to. What are you planning?' });
    setFlow({ step: 'project' });
  };

  const finishQuote = async (choice: QuickRangeInput) => {
    setFlow(null);
    setLoading(true);
    try {
      // The engine loads only once someone asks for a price.
      const { quickRange } = await import('../utils/sophieQuote');
      const result = quickRange(choice);
      setLoading(false);
      if (result.kind === 'designer') {
        lastRangeRef.current = null;
        say({
          role: 'assistant',
          content: 'Decks get their price from our deck designer. It opens at your size, and you can draw your own shape.',
          designerHref: result.href,
        });
        trackEngagement('chat_range_shown', `deck_${choice.size}`);
        return;
      }
      say({ role: 'assistant', content: `Planning range for ${result.summary}: ${result.band}.`, range: result });
      lastRangeRef.current = { range: result, choice };
      shownRangesRef.current = [...shownRangesRef.current.filter((r) => r.range.summary !== result.summary), { range: result, choice }].slice(-MAX_SHOWN_RANGES);
      if (sessionRef.current) sessionRef.current.sendContext(result.contextText);
      else pendingContextRef.current = result.contextText;
      trackEngagement('chat_range_shown', `${choice.project}_${choice.size}_${choice.city}`);
    } catch {
      addReply("I couldn't load the estimator just now. You can open it directly here: /cost-estimator", false);
    }
  };

  const pickProject = (project: QuickProject) => {
    say({ role: 'user', content: projectMeta(project).label });
    askSize(project);
  };

  const pickSize = (project: QuickProject, size: QuickSize) => {
    const option = QUICK_SIZES[project].find((s) => s.id === size)!;
    say({ role: 'user', content: `${option.label} (${option.hint})` });
    // The deck designer prices by area alone, so a deck skips the town.
    if (project === 'deck') { void finishQuote({ project, size, city: 'barrie' }); return; }
    say({ role: 'assistant', content: 'And which town is the property in?' });
    setFlow({ step: 'city', project, size });
  };

  const pickCity = (project: QuickProject, size: QuickSize, city: EstimatorLocationKey) => {
    say({ role: 'user', content: ESTIMATOR_LOCATIONS.find((l) => l.key === city)!.name });
    void finishQuote({ project, size, city });
  };

  /** Legacy Netlify function → canned answers. Only used if the agent is unreachable. */
  const sendViaFallback = async (content: string, history: Msg[]) => {
    try {
      const res = await fetch(CHAT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Only send role + content; trim history to last 12 turns to bound cost. The range goes as the
        // visitor's tap choices only — the function re-prices them itself.
        body: JSON.stringify({
          messages: history.slice(-12).map((m) => ({ role: m.role, content: m.content })),
          pricingContext: lastRangeRef.current?.choice,
          pricingContexts: shownRangesRef.current.map((r) => r.choice),
        }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as { reply?: string; leadCaptured?: boolean; source?: string };
      // Sophie's lead-handoff writes straight to the CRM server-side — this is
      // the only signal the browser gets that it happened, so fire the GA4/
      // Meta/Ads lead event here (mirrors what a form submit does on success).
      if (data.leadCaptured) trackLead('sophie-chat', 'high-intent', undefined, undefined, undefined, { skipQualification: true });
      const reply = (data.reply || '').trim();
      // The function's canned replies are ours; only a model reply is guarded (again — the function guards it too).
      addReply(reply || fallbackReply(content), !!reply && data.source !== 'fallback');
    } catch {
      // Dev (no function) or transient error → graceful canned answer.
      addReply(fallbackReply(content), false);
    }
  };

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || loading) return;
    const next: Msg[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    trackEngagement('chat_message', content.slice(0, 60));

    // A price question before any range gets the estimator's number, not the model's guess.
    if (!lastRangeRef.current && isPriceQuestion(content)) {
      startQuote(projectFromText(content) ?? pickTeaser(pathname)?.project);
      return;
    }
    setFlow(null);
    setLoading(true);

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
      if (pendingContextRef.current) {
        sessionRef.current.sendContext(pendingContextRef.current);
        pendingContextRef.current = null;
      }
      sessionRef.current.send(content);
      // The reply arrives asynchronously via onReply, which clears `loading`.
    } catch {
      liveRef.current = false;
      sessionRef.current = null;
      await sendViaFallback(content, next);
    }
  };

  const onChip = (chip: string) => {
    if (chip === COST_CHIP) { say({ role: 'user', content: chip }); startQuote(pickTeaser(pathname)?.project); return; }
    if (chip === BOOK_CHIP) { goBook('chip'); return; }
    void send(chip);
  };

  const onTeaserChip = (chip: string) => {
    trackEngagement('chat_teaser_chip', chip);
    if (chip !== BOOK_CHIP) setOpen(true);
    onChip(chip);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  // Linkify /cost-estimator, /book, /contact and tel: mentions inside replies. Pages are matched by name: the build
  // slashes quoted paths ('/book' becomes '/book/', buildTools/trailingSlashLinks.ts), which the split pieces never equal.
  const renderContent = (text: string) => {
    const parts = text.split(new RegExp(`(\\/cost-estimator|\\/book|\\/contact|${publicContact.phoneDisplay.replace(/[()]/g, '\\$&')})`));
    return parts.map((p, i) => {
      const page = /^\/(cost-estimator|book|contact)$/.exec(p)?.[1];
      if (page === 'book') {
        return <button key={i} onClick={() => goBook('reply')} className="text-brand-green-dark underline underline-offset-2">book a site visit</button>;
      }
      if (page === 'cost-estimator' || page === 'contact') {
        return (
          <button key={i} onClick={() => goTo(`/${page}`, page)} className="text-brand-green-dark underline underline-offset-2">
            {page === 'cost-estimator' ? 'cost calculator' : 'contact us'}
          </button>
        );
      }
      if (p === publicContact.phoneDisplay) {
        return <a key={i} href={`tel:${publicContact.phoneTel}`} onClick={() => trackCall('chatwidget_phone')} className="text-brand-green-dark underline underline-offset-2">{p}</a>;
      }
      return <span key={i}>{p}</span>;
    });
  };

  const chipClass =
    'px-3 py-2 rounded-full border border-brand-green/40 text-brand-green-dark font-sans text-[12px] hover:bg-brand-green/10 hover:border-brand-green transition-colors text-left';

  const flowChips = (): Array<{ label: string; onClick: () => void }> => {
    if (!flow) return [];
    if (flow.step === 'project') return QUICK_PROJECTS.map((p) => ({ label: p.label, onClick: () => pickProject(p.id) }));
    if (flow.step === 'size') {
      return QUICK_SIZES[flow.project].map((s) => ({ label: `${s.label} · ${s.hint}`, onClick: () => pickSize(flow.project, s.id) }));
    }
    return ESTIMATOR_LOCATIONS.map((l) => ({ label: l.name, onClick: () => pickCity(flow.project, flow.size, l.key) }));
  };

  // Links to the page the visitor is already on would do nothing: both pages read their prefill on arrival.
  const onBookPage = underPath(pathname, '/book');
  const onEstimatorPage = underPath(pathname, '/cost-estimator');

  // Once the visitor keeps talking after seeing a range, keep the booking one tap away.
  const resultAt = messages.map((m) => !!(m.range || m.designerHref)).lastIndexOf(true);
  const showBookPill = !onBookPage && resultAt >= 0 && !!messages[resultAt].range
    && messages.slice(resultAt + 1).some((m) => m.role === 'user') && !loading;
  const suggestions = onBookPage ? SUGGESTIONS.filter((s) => s !== BOOK_CHIP) : SUGGESTIONS;

  return (
    <>
      {/* Sophie's single nudge for this session. Sits above the launcher; tapping it opens the chat. */}
      <AnimatePresence>
        {teaser && !open && launcherVisible && (
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed z-[60] left-4 right-4 max-w-[300px] bottom-[calc(10rem+env(safe-area-inset-bottom,0px))] xl:left-auto xl:right-6 xl:bottom-24 rounded-2xl border border-brand-dim bg-brand-surface shadow-[0_24px_60px_-18px_rgba(33,30,21,0.45)] p-4"
            role="status"
          >
            <button
              onClick={dismissTeaser}
              aria-label="Dismiss Sophie's message"
              className="absolute top-2 right-2 p-1 text-brand-muted hover:text-brand-bonewhite transition-colors"
            >
              <X size={14} strokeWidth={1.75} />
            </button>
            <button
              onClick={() => { trackEngagement('chat_teaser_click', teaser.key); setOpen(true); }}
              className="flex items-start gap-3 text-left pr-5"
            >
              <span className="mt-0.5 w-8 h-8 shrink-0 rounded-full bg-brand-black text-brand-gold-light flex items-center justify-center">
                <SophieMark size={18} />
              </span>
              <span>
                <span className="block font-sans text-[10px] uppercase tracking-[0.2em] text-brand-gold-dark mb-1">Sophie</span>
                <span className="block font-sans text-[13px] leading-snug text-brand-bonewhite">{teaser.line}</span>
              </span>
            </button>
            <div className="flex flex-wrap gap-2 mt-3 pl-11">
              {teaser.chips.map((chip, i) => (
                <button
                  key={chip}
                  onClick={() => onTeaserChip(chip)}
                  className={i === 0
                    ? 'px-3 py-1.5 rounded-full bg-brand-black text-brand-gold-light font-sans text-[12px] hover:bg-brand-ink transition-colors'
                    : 'px-3 py-1.5 rounded-full border border-brand-dim text-brand-bonewhite font-sans text-[12px] hover:border-brand-gold transition-colors'}
                >
                  {chip}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Left side on phones so it clears the estimate half of the sticky bar. Never opens by itself. */}
      <AnimatePresence>
        {!open && launcherVisible && (
          <motion.button
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
            animate={unread && !reduceMotion
              ? { opacity: 1, scale: [1, 1.1, 1, 1.06, 1], rotate: [0, -8, 6, -3, 0] }
              : { opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: unread ? 0.9 : 0.25 }}
            onClick={() => setOpen(true)}
            aria-label={unread ? 'Open chat with Sophie (1 new message)' : 'Open chat with Sophie'}
            className="group fixed z-[60] left-4 bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] xl:left-auto xl:right-6 xl:bottom-6 w-14 h-14 rounded-full bg-brand-black text-brand-gold-light ring-1 ring-inset ring-brand-gold/40 flex items-center justify-center shadow-[0_10px_30px_-6px_rgba(198,164,125,0.55)] hover:shadow-[0_14px_38px_-6px_rgba(198,164,125,0.75)] hover:-translate-y-0.5 transition-[box-shadow,translate] gm-live-dot"
          >
            <SophieMark size={30} />
            {unread ? (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-brand-gold text-brand-black font-sans text-[11px] font-semibold leading-5 text-center border-2 border-brand-nearblack">1</span>
            ) : (
              <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-brand-black" />
            )}
            <span className="hidden xl:block pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-full bg-brand-black px-3 py-1.5 font-sans text-[12px] text-brand-gold-light opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
              Chat with Sophie
            </span>
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
            className="fixed z-[60] right-3 left-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] sm:left-auto sm:right-6 xl:bottom-6 sm:w-[384px] h-[min(68vh,32rem)] max-h-[600px] flex flex-col rounded-3xl overflow-hidden border border-brand-dim bg-brand-surface shadow-[0_30px_80px_-20px_rgba(33,30,21,0.4)]"
            role="dialog"
            aria-label="Golden Maple chat assistant"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-brand-dim/60 bg-gradient-to-r from-brand-green/15 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-brand-black text-brand-gold-light ring-1 ring-inset ring-brand-gold/40 flex items-center justify-center">
                  <SophieMark size={20} />
                </div>
                <div>
                  <div className="font-display text-[16px] text-brand-bonewhite leading-none">Sophie</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-brand-muted">Online · planning ranges</span>
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
                  {m.range ? (
                    <div className="w-[88%] rounded-2xl rounded-bl-md border border-brand-gold/40 bg-brand-nearblack p-4">
                      <div className="font-sans text-[10px] uppercase tracking-[0.2em] text-brand-gold-dark">Planning range</div>
                      <div className="font-display text-[24px] leading-tight text-brand-bonewhite mt-1">
                        {money(m.range.low)}–{money(m.range.high)}
                        <span className="font-sans text-[12px] text-brand-muted"> + HST</span>
                      </div>
                      <div className="font-sans text-[12.5px] text-brand-bonewhite mt-1">{m.range.summary}</div>
                      <div className="font-sans text-[12px] text-brand-muted mt-0.5">
                        About {m.range.days.low}–{m.range.days.high} days on site
                      </div>
                      <p className="font-sans text-[11.5px] text-brand-muted leading-snug mt-2">
                        From our cost estimator. Your price is confirmed at a site visit.
                      </p>
                      <div className="flex flex-col gap-2 mt-3">
                        {onBookPage ? (
                          <p className="font-sans text-[12px] text-brand-bonewhite">Pick a time in the scheduler on this page to book the site visit.</p>
                        ) : (
                          <button
                            onClick={() => goBook('range_card', m.range)}
                            className="w-full rounded-full bg-brand-black text-brand-gold-light font-sans text-[13px] py-2.5 flex items-center justify-center gap-2 hover:bg-brand-ink transition-colors"
                          >
                            Book a site visit <ArrowRight size={14} strokeWidth={1.75} />
                          </button>
                        )}
                        {!onEstimatorPage && (
                          <button
                            onClick={() => goTo(m.range!.estimatorHref, 'range_finetune')}
                            className="w-full rounded-full border border-brand-dim text-brand-bonewhite font-sans text-[12.5px] py-2 hover:border-brand-gold transition-colors"
                          >
                            {m.range.estimatorPrefilled ? 'Fine-tune it in the estimator' : 'Open the estimator and set your size'}
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`max-w-[82%] px-4 py-2.5 rounded-2xl font-sans text-[13.5px] leading-relaxed ${
                        m.role === 'user'
                          ? 'bg-brand-gold text-brand-black rounded-br-md'
                          : 'bg-brand-midsurface text-brand-bonewhite border border-brand-dim/60 rounded-bl-md'
                      }`}
                    >
                      {m.role === 'assistant' ? renderContent(m.content) : m.content}
                      {m.offerRange && !flow && (
                        <button
                          onClick={() => onChip(COST_CHIP)}
                          className="mt-2 w-full rounded-full bg-brand-black text-brand-gold-light font-sans text-[13px] py-2 flex items-center justify-center gap-2"
                        >
                          Get my planning range <ArrowRight size={14} strokeWidth={1.75} />
                        </button>
                      )}
                      {m.designerHref && (
                        <button
                          onClick={() => goTo(m.designerHref!, 'range_deck_designer')}
                          className="mt-2 w-full rounded-full bg-brand-black text-brand-gold-light font-sans text-[13px] py-2 flex items-center justify-center gap-2"
                        >
                          Open the deck designer <ArrowRight size={14} strokeWidth={1.75} />
                        </button>
                      )}
                    </div>
                  )}
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

              {/* 3-tap range options, or the opening suggestions */}
              {flow && !loading && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {flowChips().map((c) => (
                    <button key={c.label} onClick={c.onClick} className={chipClass}>{c.label}</button>
                  ))}
                </div>
              )}
              {!flow && messages.length <= 1 && !loading && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {suggestions.map((s) => (
                    <button key={s} onClick={() => onChip(s)} className={chipClass}>{s}</button>
                  ))}
                </div>
              )}
            </div>

            {showBookPill && (
              <div className="px-3 pt-2">
                <button
                  onClick={() => goBook('pill')}
                  className="w-full rounded-full bg-brand-black text-brand-gold-light font-sans text-[12.5px] py-2 flex items-center justify-center gap-2 hover:bg-brand-ink transition-colors"
                >
                  Book a site visit for this range <ArrowRight size={13} strokeWidth={1.75} />
                </button>
              </div>
            )}

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
