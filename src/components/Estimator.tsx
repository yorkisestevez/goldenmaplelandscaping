import { useState, useMemo, useEffect, useRef, type ChangeEvent, type ReactNode } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { trackEngagement } from '../utils/analytics';
import { motion, AnimatePresence } from 'motion/react';
import {
  Grid, Hexagon, AlignJustify, ListTree, Layout,
  ChefHat, Flame, Sun, Leaf, Lightbulb, Map, Check, ChevronDown, MapPin, Image as ImageIcon, Upload, X,
} from 'lucide-react';
import EstimateBreakdown from './EstimateBreakdown';
import EstimateLeadCapture from './EstimateLeadCapture';
import EstimatorUnlock from './EstimatorUnlock';
import { readVault, unlockVault, recordEstimate, type VaultEstimate } from '../utils/estimatorVault';
import EstimateBookingCTA from './EstimateBookingCTA';
import EstimateWorkbench from './EstimateWorkbench';
import BudgetTarget from './BudgetTarget';
import BudgetGapCoach from './BudgetGapCoach';
import { buildPermalink, decodeBuild } from '../utils/buildPermalink';
import { PROJECT_TYPE_IMAGES, DECK_BRAND_IMAGES, PAVER_SWATCHES } from '../data/estimatorImages';
import { PAVER_BRANDS, DECK_BRANDS, ADD_ONS, defaultPaverForTier, sortPaversForDisplay, type PaverTier } from '../data/carrPrices';
import { ESTIMATOR_LOCATIONS, type EstimatorLocationKey } from '../data/locations';
import { getEstimatorRangeCopy } from '../utils/pricingDoctrine';
import { computeEstimate, deltaFor, widenFactors, widenTotals, type EstimateInput, type EstimateLine, type PreciseResult } from '../utils/estimateEngine';
import PriceDelta from './ui/PriceDelta';
import AnimatedPrice, { AnimatedDollars, AnimatedMoney } from './ui/AnimatedPrice';
import SizeControl from './ui/SizeControl';
import { cn } from '../utils/cn';
import { BUSINESS, canPublish } from '../data/business';


const PROJECT_TYPES = [
  { id: 'patio', label: 'Patio / Interlock', desc: 'Pavers and hardscape', icon: Grid },
  { id: 'stone', label: 'Natural Stone / Flagstone', desc: 'Irregular or cut stone', icon: Hexagon },
  { id: 'wall', label: 'Retaining Wall', desc: 'Block or armour stone', icon: AlignJustify },
  { id: 'steps', label: 'Steps & Walkway', desc: 'Precast or natural stone', icon: ListTree },
  { id: 'deck', label: 'Composite Deck', desc: 'TimberTech AZEK', icon: Layout },
  { id: 'kitchen', label: 'Outdoor Kitchen', desc: 'Cooking and dining', icon: ChefHat },
  { id: 'firepit', label: 'Fire Pit', desc: 'Prefab or custom built', icon: Flame },
  { id: 'pergola', label: 'Pergola / Shade Structure', desc: 'Wood or aluminum', icon: Sun },
  { id: 'turf', label: 'Artificial Turf', desc: 'Low maintenance lawn', icon: Leaf },
  { id: 'lighting', label: 'Landscape Lighting', desc: 'In-Lite systems', icon: Lightbulb },
  { id: 'full', label: 'Full Backyard (multiple)', desc: 'Complete transformation', icon: Map },
];

const CONDITIONS = [
  { id: 'access', label: 'Difficult access (no machine access, wheelbarrow only)', hint: '+ ~18% labour', why: 'Base gravel moved by hand instead of machine adds crew days.' },
  { id: 'slope', label: 'Significant slope or grading needed', hint: '+$1.5k–$4k', why: 'Cut-and-fill plus extra base material to get a level, draining surface.' },
  { id: 'drainage', label: 'Drainage work needed', hint: '+$1.5k–$3.5k', why: 'Catch basins, weeping tile, or swales to move water away from the house.' },
  { id: 'levels', label: 'Multiple levels or tiers', hint: '+ ~12%', why: 'Each level adds forming, steps, and transitions between surfaces.' },
];

/** Per-project-type follow-up questions — the ones a real estimator asks on a site visit.
 *  Each answer visibly moves the range and tightens the confidence band. */
type DetailOption = { id: string; label: string; hint: string };
type DetailQuestion = { id: string; label: string; why: string; options: DetailOption[] };

const SURFACE_Q: DetailQuestion = {
  id: 'surface',
  label: "What's there right now?",
  why: "Tear-out and disposal are real line items — grass digs out fast, concrete doesn't.",
  options: [
    { id: 'grass', label: 'Grass / soil', hint: 'Included' },
    { id: 'concrete', label: 'Old concrete', hint: '+ tear-out' },
    { id: 'pavers', label: 'Old pavers / stone', hint: '+ lift & dispose' },
    { id: 'deck', label: 'Old deck / other', hint: '+ removal' },
  ],
};
const USE_Q: DetailQuestion = {
  id: 'use',
  label: 'How will you use the space?',
  why: 'A hot tub needs a reinforced base — better to price it now than change-order it later.',
  options: [
    { id: 'dining', label: 'Dining & BBQ', hint: 'Included' },
    { id: 'lounge', label: 'Lounge / fire area', hint: 'Included' },
    { id: 'hottub', label: 'Hot tub going on it', hint: '+ reinforced base' },
    { id: 'multi', label: 'Full outdoor living', hint: 'Wider scope' },
  ],
};
const SHAPE_Q: DetailQuestion = {
  id: 'shape',
  label: 'Layout & cutting',
  why: 'Curves and border bands mean more cuts and a higher waste factor than a straight rectangle.',
  options: [
    { id: 'simple', label: 'Simple square / rectangle', hint: 'Included' },
    { id: 'curves', label: 'Gentle curves', hint: '+6–8%' },
    { id: 'complex', label: 'Curves + borders / inlays', hint: '+12–16%' },
  ],
};
const WALL_Q: DetailQuestion = {
  id: 'wallPurpose',
  label: 'What is the wall holding back?',
  why: 'A wall supporting a driveway or structure is engineered differently than a garden-bed border.',
  options: [
    { id: 'garden', label: 'Garden bed', hint: 'Included' },
    { id: 'slope', label: 'Backyard slope', hint: '+10%' },
    { id: 'structure', label: 'Driveway / structure', hint: '+25% · engineered' },
  ],
};
const DECK_Q: DetailQuestion = {
  id: 'deckHeight',
  label: 'How high off the ground?',
  why: 'Height changes framing, footings, and railing requirements under the building code.',
  options: [
    { id: 'ground', label: 'Ground level', hint: 'Included' },
    { id: 'mid', label: '3–6 ft, with stairs', hint: '+ stairs & railings' },
    { id: 'walkout', label: 'Walkout / second storey', hint: '+18%' },
  ],
};
const FIRE_Q: DetailQuestion = {
  id: 'fuel',
  label: 'Wood or gas?',
  why: 'A gas line run is its own trade — worth pricing upfront.',
  options: [
    { id: 'wood', label: 'Wood burning', hint: 'Included' },
    { id: 'gas', label: 'Natural gas / propane', hint: '+ gas line' },
  ],
};

const DETAIL_QUESTIONS: Record<string, DetailQuestion[]> = {
  patio: [SURFACE_Q, USE_Q, SHAPE_Q],
  stone: [SURFACE_Q, USE_Q, SHAPE_Q],
  steps: [SURFACE_Q],
  turf: [SURFACE_Q],
  wall: [WALL_Q],
  deck: [DECK_Q],
  firepit: [FIRE_Q],
};

const TIERS: { id: PaverTier; label: string; sub: string; badge?: string }[] = [
  { id: 'budget',  label: 'Standard',  sub: 'Permacon Melville, Cassara, Vendome. Clean, value-built.' },
  { id: 'mid',     label: 'Elevated',  sub: 'Mondrian Plus, Wilfred, Rosebel. Most popular tier.', badge: 'Most Popular' },
  { id: 'premium', label: 'Premium',   sub: 'Mega Melville, Brooklyn, Metrik. Signature finish.' },
];

const TOTAL_STEPS = 7;

/** Per-step funnel labels — fixed, non-PII enum so GA4 reads abandonment as a funnel. */
const STEP_NAMES: Record<number, string> = {
  1: 'type', 2: 'size', 3: 'conditions', 4: 'location', 5: 'material', 6: 'addons', 7: 'result',
};

const fmt = (n: number) =>
  n >= 10000 ? `$${(n / 1000).toFixed(0)}k` : `$${n.toLocaleString()}`;

/** Large, service-specific concept photograph for every project choice. */
function TypeThumb({ typeId, eager = false }: { typeId: string; eager?: boolean }) {
  const img = PROJECT_TYPE_IMAGES[typeId];
  return (
    <img
      src={img.src}
      alt={img.alt}
      width={960}
      height={720}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className="w-full aspect-[4/3] object-cover shrink-0"
    />
  );
}

/** Tiny hand-drawn plan/profile diagrams for the questions where words fail —
 *  "gentle curves" vs "curves + borders / inlays" is meaningless until you see
 *  it, and wall height is easier to point at than to imagine. Inline SVG,
 *  brand-gold strokes, no image files, no AI. */
const DETAIL_DIAGRAMS: Record<string, ReactNode> = {
  // Patio layout — plan view
  'shape_simple': (
    <svg viewBox="0 0 56 40" className="w-14 h-10" aria-hidden="true">
      <rect x="8" y="7" width="40" height="26" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  'shape_curves': (
    <svg viewBox="0 0 56 40" className="w-14 h-10" aria-hidden="true">
      <path d="M9 8 H41 Q49 8 47 17 Q45 26 48 33 H15 Q7 33 9 24 Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  ),
  'shape_complex': (
    <svg viewBox="0 0 56 40" className="w-14 h-10" aria-hidden="true">
      <path d="M9 8 H41 Q49 8 47 17 Q45 26 48 33 H15 Q7 33 9 24 Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M14 12.5 H38 Q43.5 12.5 42.5 18 Q41.5 24 43 28.5 H18 Q13 28.5 13.8 22.5 Z" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.55" strokeLinejoin="round" />
    </svg>
  ),
  // Wall height — profile view: ground line + block courses
  'wallHeight_Under 2ft': (
    <svg viewBox="0 0 56 40" className="w-14 h-10" aria-hidden="true">
      <line x1="4" y1="34" x2="52" y2="34" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <rect x="16" y="27" width="24" height="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  'wallHeight_2-4ft': (
    <svg viewBox="0 0 56 40" className="w-14 h-10" aria-hidden="true">
      <line x1="4" y1="34" x2="52" y2="34" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <rect x="16" y="20" width="24" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="16" y1="27" x2="40" y2="27" stroke="currentColor" strokeWidth="1" opacity="0.55" />
    </svg>
  ),
  'wallHeight_4-6ft': (
    <svg viewBox="0 0 56 40" className="w-14 h-10" aria-hidden="true">
      <line x1="4" y1="34" x2="52" y2="34" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <rect x="16" y="13" width="24" height="21" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="16" y1="20" x2="40" y2="20" stroke="currentColor" strokeWidth="1" opacity="0.55" />
      <line x1="16" y1="27" x2="40" y2="27" stroke="currentColor" strokeWidth="1" opacity="0.55" />
    </svg>
  ),
  'wallHeight_Over 6ft': (
    <svg viewBox="0 0 56 40" className="w-14 h-10" aria-hidden="true">
      <line x1="4" y1="34" x2="52" y2="34" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <rect x="16" y="6" width="24" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="16" y1="13" x2="40" y2="13" stroke="currentColor" strokeWidth="1" opacity="0.55" />
      <line x1="16" y1="20" x2="40" y2="20" stroke="currentColor" strokeWidth="1" opacity="0.55" />
      <line x1="16" y1="27" x2="40" y2="27" stroke="currentColor" strokeWidth="1" opacity="0.55" />
    </svg>
  ),
};

const VALID_PROJECT_TYPES = new Set(['patio', 'stone', 'wall', 'steps', 'deck', 'kitchen', 'firepit', 'pergola', 'turf', 'lighting', 'full']);

export default function Estimator() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  /** Furthest step reached this session — what makes the dots navigable.
   *  Tracks the high-water mark, so jumping back never re-locks the steps
   *  someone has already earned access to. */
  const [furthestStep, setFurthestStep] = useState(1);
  /** Scroll target for the result-step sticky bar's "Save build" button. */
  const saveCardRef = useRef<HTMLDivElement>(null);
  /** The wizard card — every step change scrolls back to its top. Without
   *  this the viewport stays wherever the Continue button was, and the result
   *  step's payoff (the number) appears off-screen at the exact moment it
   *  should land. */
  const cardRef = useRef<HTMLDivElement>(null);
  /** Full-backyard step 2 is a wall of nested config on phones — accordion it.
   *  Desktop ignores this (everything open). Newly added elements auto-open. */
  const [openElement, setOpenElement] = useState<string | null>(null);
  const [projectType, setProjectType] = useState<string | null>(null);
  const [selectedElements, setSelectedElements] = useState<string[]>([]);
  const [sizes, setSizes] = useState<Record<string, number | string>>({
    patio: 500,
    stone: 500,
    wall: 50,
    wallHeight: '2-4ft',
    steps: 5,
    deck: 300,
    kitchen: 'Basic',
    firepit: 'Medium',
    pergola: 'Medium',
    turf: 500,
    lighting: 'Medium',
  });
  const [conditions, setConditions] = useState<Record<string, boolean>>({
    access: false, slope: false, drainage: false, levels: false,
  });
  const [details, setDetails] = useState<Record<string, string>>({});
  const [location, setLocation] = useState<EstimatorLocationKey>('barrie');
  const [tier, setTier] = useState<PaverTier>('mid');
  const [paverBrandId, setPaverBrandId] = useState<string>('permacon-mondrian-plus');
  const [deckBrandId, setDeckBrandId] = useState<string>('timbertech-prime');
  const [addOns, setAddOns] = useState<string[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  /** Optional. null = never answered, which is a legitimate answer — the coach
   *  simply doesn't appear. Never used to gate or qualify. */
  const [targetBudget, setTargetBudget] = useState<number | null>(null);
  // The range AND the itemized breakdown are both free — see EstimateBreakdown
  // for why. This flips once the customer saves their build (name + email), and
  // only controls the saved-state UI, never access to their own numbers.
  const [buildSaved, setBuildSaved] = useState(false);

  // ---- Repeat-pricing gate + device vault (engine v3) ----
  // First estimate free end-to-end; the SECOND run asks for an email once
  // (EstimatorUnlock), after which the device stays unlocked and every
  // completed build lands in the vault drawer. Vault reads live in effects/
  // handlers only — localStorage must never run during the prerender.
  const [gateActive, setGateActive] = useState(false);
  const [vaultEstimates, setVaultEstimates] = useState<VaultEstimate[]>([]);
  const [vaultOpen, setVaultOpen] = useState(false);
  /** True when this session restored someone's ?build= link — viewing a shared
   *  build neither counts as an attempt nor records into the vault. */
  const restoredRef = useRef(false);
  const refreshVault = () => setVaultEstimates(readVault().estimates);

  // Per-step funnel tracking — fire each step once per session so GA4 shows drop-off.
  const firedSteps = useRef<Set<number>>(new Set());
  const fireStep = (n: number, suffix = '') => {
    setFurthestStep(prev => Math.max(prev, n));
    if (firedSteps.current.has(n)) return;
    firedSteps.current.add(n);
    trackEngagement('estimator_step', `${n}_${STEP_NAMES[n] ?? 'unknown'}${suffix}`);
  };

  // Auto-pick a default brand when tier changes
  useEffect(() => {
    const defaultPaver = defaultPaverForTier(tier);
    if (defaultPaver) setPaverBrandId(defaultPaver.id);
  }, [tier]);

  // Hydrate from URL params on mount (HeroEstimator hand-off → jump to step 3 with selections in place)
  useEffect(() => {
    // A saved build wins over the shorthand params — it's a complete state and
    // restores the customer exactly where they left off, at the result.
    const buildParam = searchParams.get('build');
    if (buildParam) {
      const saved = decodeBuild(buildParam);
      if (saved) {
        setProjectType(saved.projectType);
        setSelectedElements(saved.selectedElements);
        setSizes(saved.sizes);
        setDetails(saved.details);
        setConditions(saved.conditions);
        setLocation(saved.location);
        setTier(saved.tier);
        setPaverBrandId(saved.paverBrandId);
        setDeckBrandId(saved.deckBrandId);
        setAddOns(saved.addOns);
        setTargetBudget(saved.targetBudget);
        setStep(TOTAL_STEPS);
        restoredRef.current = true;
        refreshVault();
        fireStep(TOTAL_STEPS, '_restored');
        return;
      }
      // A corrupt or outdated link starts a clean estimate rather than a
      // half-applied one — a wrong restore is worse than no restore.
    }

    // Returning visitor with a completed estimate and no unlock yet → the
    // repeat gate fronts the wizard (prefill links included — a repeat is a
    // repeat however they arrive).
    const vault = readVault();
    setVaultEstimates(vault.estimates);
    if (vault.estimates.length >= 1 && vault.unlockedAt === null) {
      setGateActive(true);
      trackEngagement('estimator_unlock_shown', 'return_visit');
    }

    const t = searchParams.get('type');
    const sqftParam = searchParams.get('sqft');
    const cityParam = searchParams.get('city');
    let advanced = false;
    if (t && VALID_PROJECT_TYPES.has(t)) {
      setProjectType(t);
      if (t === 'full') {
        // Pre-fill with the 3 most common picks so size step still has meaning
        setSelectedElements(['patio', 'wall', 'lighting']);
        setOpenElement('patio'); // mobile accordion starts somewhere useful
      }
      advanced = true;
    }
    if (sqftParam) {
      const n = parseInt(sqftParam, 10);
      if (!isNaN(n) && n >= 100 && n <= 2000 && t) {
        setSizes(prev => ({
          ...prev,
          [t === 'full' ? 'patio' : t]: n,
        }));
      }
    }
    if (cityParam && ESTIMATOR_LOCATIONS.some(l => l.key === cityParam)) {
      setLocation(cityParam as EstimatorLocationKey);
    }
    if (advanced) {
      // Land on step 2, not 3 — the project-specific questions live there now,
      // and they're the whole point of the deeper estimator.
      setStep(2);
      fireStep(2, '_prefill');
    } else {
      fireStep(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Present each step from its top — including the result reveal.
  const prevStepRef = useRef(step);
  useEffect(() => {
    if (prevStepRef.current === step) return;
    prevStepRef.current = step;
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [step]);

  const handleSizeChange = (id: string, value: number | string) => {
    setSizes(prev => ({ ...prev, [id]: value }));
  };
  const toggleCondition = (id: string) => {
    setConditions(prev => ({ ...prev, [id]: !prev[id] }));
  };
  const setDetail = (el: string, qid: string, optId: string) => {
    setDetails(prev => ({ ...prev, [`${el}.${qid}`]: optId }));
    trackEngagement('estimator_detail', `${qid}_${optId}`);
  };
  const toggleElement = (id: string) => {
    setSelectedElements(prev => {
      const adding = !prev.includes(id);
      // Auto-open the element you just added — its config is the next thing
      // you need, and on mobile it would otherwise be behind a closed card.
      if (adding) setOpenElement(id);
      else if (openElement === id) setOpenElement(null);
      return adding ? [...prev, id] : prev.filter(e => e !== id);
    });
  };
  const toggleAddOn = (id: string) => {
    setAddOns(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const isHardscape = projectType === 'patio' || projectType === 'stone' || projectType === 'wall' || projectType === 'steps';
  const isDeck = projectType === 'deck' || (projectType === 'full' && selectedElements.includes('deck'));
  const totalSqft = useMemo(() => {
    const els = projectType === 'full' ? selectedElements : (projectType ? [projectType] : []);
    return els.reduce((sum, el) => {
      const v = sizes[el];
      return sum + (typeof v === 'number' ? v : 0);
    }, 0);
  }, [projectType, selectedElements, sizes]);

  const selectedPaver = PAVER_BRANDS.find(p => p.id === paverBrandId) || PAVER_BRANDS[2];
  const selectedDeck = DECK_BRANDS.find(d => d.id === deckBrandId) || DECK_BRANDS[0];

  /** The single object the pricing engine reads. Everything that can move the
   *  number lives in here — which is also what makes honest speculative pricing
   *  possible: `deltaFor(build, { tier: 'premium' })` is a real re-run of the
   *  same engine, so a "+$3,900" hint can never promise a number the estimate
   *  won't then produce. */
  const build: EstimateInput = useMemo(() => ({
    projectType, selectedElements, sizes, details, conditions,
    location, tier, paverBrandId, deckBrandId, addOns,
  }), [projectType, selectedElements, sizes, details, conditions, location, tier, paverBrandId, deckBrandId, addOns]);

  const estimate = useMemo(() => computeEstimate(build), [build]);

  /** What would ONE change do to this build, in real dollars? Pure arithmetic,
   *  so it's fine to call once per visible option on every render. Every price
   *  hint in the UI goes through here rather than through a hand-written
   *  percentage, which is what stops a hint from ever drifting away from what
   *  the estimate will actually charge. */
  const preview = useMemo(
    () => (patch: Partial<EstimateInput>) => deltaFor(build, patch).mid,
    [build],
  );

  const trackAdjust = (lever: string, direction: string) =>
    trackEngagement('estimator_adjust', `${lever}_${direction}`);

  /** Shareable link that restores this exact build. Computed only at the result
   *  step — it's what the save gate trades for. */
  const permalink = useMemo(
    () => (step === TOTAL_STEPS ? buildPermalink(build, targetBudget) : undefined),
    [build, targetBudget, step],
  );

  /** Apply a gap-coach lever to the live build. Only ever touches scope or
   *  material — the coach never produces a patch that edits site conditions. */
  const applyLever = (leverId: string, patch: Partial<EstimateInput>) => {
    if (patch.sizes) setSizes(patch.sizes);
    if (patch.tier) setTier(patch.tier);
    if (patch.paverBrandId) setPaverBrandId(patch.paverBrandId);
    if (patch.addOns) setAddOns(patch.addOns);
    trackEngagement('estimator_gap_lever_applied', leverId);
  };

  /** Confidence ±% — tightens as the visitor works through the wizard. Detail
   *  questions earn the most credit; reaching steps 4/5/6 also earns credit for
   *  reviewing conditions/location/material even on their defaults, so the
   *  on-screen copy says "completing each step", not "every answer" — page-
   *  turning alone genuinely does move this number. Do not let UI copy claim
   *  answers alone earn it; that would misdescribe this formula. */
  const answeredDetails = useMemo(() => {
    const els = projectType === 'full' ? selectedElements : (projectType ? [projectType] : []);
    const keys = els.flatMap(el => (DETAIL_QUESTIONS[el] ?? []).map(q => `${el}.${q.id}`));
    return keys.filter(k => details[k]).length;
  }, [projectType, selectedElements, details]);

  const confidence = useMemo(() => {
    let c = 30;
    c -= Math.min(10, answeredDetails * 2.5); // project-specific answers
    if (step >= 4) c -= 3;  // site conditions reviewed
    if (step >= 5) c -= 4;  // location set
    if (step >= 6) c -= 3;  // material tier + brand chosen
    if (photoFile) c -= 3;
    return Math.max(8, Math.round(c));
  }, [answeredDetails, step, photoFile]);

  /** Everything the user SEES — the engine estimate widened by the uncertainty
   *  they haven't resolved yet. Starts deliberately wide and visibly narrows as
   *  questions get answered; the narrowing is the reward for answering.
   *
   *  The headline AND the itemized lines are widened by the same two factors,
   *  so the breakdown always reconciles with the number above it. This is also
   *  the single source of the displayed range — the result step used to render
   *  the RAW engine total while every earlier step rendered this widened one,
   *  so the number visibly jumped at the exact moment the user was supposed to
   *  feel they'd built it. `confidence` is identical on steps 6 and 7, so
   *  arriving at the result now changes nothing. */
  const widen = useMemo(() => widenFactors(confidence), [confidence]);

  const display = useMemo(() => {
    if (estimate.totalLow <= 0) return { low: 0, high: 0, lines: null };
    const scaleLine = (l: EstimateLine): EstimateLine => ({
      ...l,
      low: Math.round(widen.low(l.low) / 100) * 100,
      high: Math.round(widen.high(l.high) / 100) * 100,
    });
    return {
      ...widenTotals(estimate, confidence),
      lines: estimate.lines && {
        excavation: scaleLine(estimate.lines.excavation),
        materials: scaleLine(estimate.lines.materials),
        labour: scaleLine(estimate.lines.labour),
        disposal: scaleLine(estimate.lines.disposal),
        restoration: scaleLine(estimate.lines.restoration),
      },
    };
  }, [estimate, widen, confidence]);

  /** The range a hypothetical change WOULD display — same widening as the
   *  headline, so a scenario card can never advertise a range that clicking it
   *  wouldn't actually produce. */
  const totalFor = useMemo(
    () => (patch: Partial<EstimateInput>) =>
      widenTotals(computeEstimate({ ...build, ...patch }), confidence),
    [build, confidence],
  );

  // Transient "+$2,400" chip when an answer moves the estimate — makes every input visibly count.
  const mid = (estimate.totalLow + estimate.totalHigh) / 2;
  const prevMidRef = useRef(0);
  const deltaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [delta, setDelta] = useState<number | null>(null);
  useEffect(() => {
    const prev = prevMidRef.current;
    prevMidRef.current = mid;
    // Fires on the result step too — the workbench is where the biggest
    // adjustments happen, and the mobile sticky bar shows the chip there.
    if (prev <= 0 || mid <= 0 || step < 2) return;
    const diff = mid - prev;
    if (Math.abs(diff) < 250) return;
    setDelta(diff);
    if (deltaTimer.current) clearTimeout(deltaTimer.current);
    deltaTimer.current = setTimeout(() => setDelta(null), 2600);
  }, [mid, step]);

  const onPhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setPhotoFile(f);
  };

  /** "Price Another Project" — the moment the repeat gate applies. Unlocked
   *  (or first-run) visitors just get a clean wizard. */
  const startOver = () => {
    firedSteps.current.clear();
    setFurthestStep(1);
    restoredRef.current = false;
    const vault = readVault();
    if (vault.estimates.length >= 1 && vault.unlockedAt === null) {
      setGateActive(true);
      trackEngagement('estimator_unlock_shown', 'start_over');
    }
    fireStep(1);
    setStep(1);
  };

  const handleUnlocked = (email: string) => {
    unlockVault(email);
    refreshVault();
    setGateActive(false);
    trackEngagement('estimator_unlock_completed', projectType ?? 'unknown');
  };

  // ---------- step renderers ----------
  /** Plain-language anchors for people who don't think in square feet.
   *  A number you can picture is a number you can own. */
  const SQFT_PRESETS = [
    { label: 'Small', value: 250, hint: '~ a single-car garage' },
    { label: 'Medium', value: 500, hint: '~ a two-car garage' },
    { label: 'Large', value: 900, hint: '~ a three-car garage' },
  ];

  /** Card options replace the native <select>s. Every other choice in the
   *  estimator is a card; three dropdowns hiding among them made the cheapest
   *  interactions feel like the least considered ones. */
  const renderOptionCards = (id: string, label: string, options: string[], help?: string) => {
    const current = sizes[id] as string;
    return (
      <div className="mb-8">
        <div className="font-sans text-[13px] text-brand-bone mb-1.5">{label}</div>
        {help ? (
          <div className="font-sans text-[11px] font-normal text-brand-bonewhite/70 mb-4 leading-relaxed">{help}</div>
        ) : <div className="mb-4" />}
        {/* Class names must be literal — Tailwind can't see runtime template
            strings, so `grid-cols-${n}` compiles to nothing. */}
        <div className={cn(
          'grid gap-2.5',
          options.length >= 4 ? 'grid-cols-2 md:grid-cols-4'
            : options.length === 3 ? 'grid-cols-3'
            : 'grid-cols-2',
        )}>
          {options.map(opt => {
            const isSelected = current === opt;
            const optDelta = preview({ sizes: { ...sizes, [id]: opt } });
            const diagram = DETAIL_DIAGRAMS[`${id}_${opt}`];
            return (
              <button
                type="button"
                key={opt}
                onClick={() => handleSizeChange(id, opt)}
                aria-pressed={isSelected}
                className={cn(
                  'p-3.5 rounded-2xl border text-left transition-all duration-200',
                  isSelected
                    ? 'bg-gradient-to-b from-brand-gold/30 to-brand-gold/10 border-brand-gold shadow-[0_0_0_1px_rgba(212,175,99,0.4)]'
                    : 'bg-brand-cream-light border-brand-dim hover:border-brand-gold/60 hover:bg-brand-midsurface',
                )}
              >
                {diagram ? (
                  <div className={cn('mb-1.5', isSelected ? 'text-brand-gold-dark' : 'text-brand-gold-dark/60')}>{diagram}</div>
                ) : null}
                <div className="font-sans text-[12px] text-brand-bone leading-snug mb-1">{opt}</div>
                <PriceDelta
                  mid={isSelected ? 0 : optDelta}
                  neutralLabel={isSelected ? 'Selected' : 'Same price'}
                  dimmed={!isSelected}
                  className="text-[10px]"
                />
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderSizeControl = (
    id: string, label: string, min: number, max: number, unit: string,
    step: number, presets?: { label: string; value: number; hint?: string }[],
  ) => (
    <SizeControl
      label={label}
      value={typeof sizes[id] === 'number' ? (sizes[id] as number) : min}
      min={min}
      max={max}
      step={step}
      unit={unit}
      presets={presets}
      onChange={v => handleSizeChange(id, v)}
      onCommit={() => trackAdjust('size', id)}
    />
  );

  const renderSizeInputs = (type: string) => {
    switch (type) {
      case 'patio':
      case 'stone':
      case 'deck':
      case 'turf':
        return renderSizeControl(type, 'Approximate square footage', 100, 2000, 'sq ft', 10, SQFT_PRESETS);
      case 'wall':
        return (<>
          {renderSizeControl('wall', 'Wall length', 10, 200, 'ln ft', 5)}
          {renderOptionCards('wallHeight', 'Wall height', ['Under 2ft', '2-4ft', '4-6ft', 'Over 6ft'],
            'Height drives block type, reinforcement, and whether engineering is required.')}
        </>);
      case 'steps':
        return renderSizeControl('steps', 'Number of steps', 2, 20, 'steps', 1);
      case 'kitchen':
        return renderOptionCards('kitchen', 'Kitchen scope', ['Basic', 'Full Build'],
          'Basic is counter, cabinet and a built-in grill. Full Build adds services, appliances and finishes.');
      case 'firepit':
      case 'pergola':
      case 'lighting':
        return renderOptionCards(type, 'Project size', ['Small', 'Medium', 'Large']);
      default:
        return null;
    }
  };

  /** The site-visit questions, one card row per question, each with a "why we ask" line
   *  and a visible price effect per option. */
  const renderDetailQuestions = (el: string) => {
    const qs = DETAIL_QUESTIONS[el];
    if (!qs || qs.length === 0) return null;
    return (
      <div className="space-y-9 mt-10 pt-8 border-t border-brand-gold/10">
        {qs.map(q => {
          const key = `${el}.${q.id}`;
          return (
            <div key={key}>
              <div className="font-sans text-[13px] text-brand-bone mb-1.5">{q.label}</div>
              <div className="font-sans text-[11px] font-normal text-brand-bonewhite/70 mb-4 leading-relaxed">
                Why we ask: {q.why}
              </div>
              <div className={cn(
                "grid grid-cols-2 gap-2.5",
                q.options.length >= 4 ? "md:grid-cols-4" : q.options.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2"
              )}>
                {q.options.map(o => {
                  const isSelected = details[key] === o.id;
                  // Price this option against the CURRENT build, not against a
                  // generic average — "+$3,200" on their 500 sqft patio, not "+12–16%".
                  const optionDelta = preview({ details: { ...details, [key]: o.id } });
                  const diagram = DETAIL_DIAGRAMS[`${q.id}_${o.id}`];
                  return (
                    <button
                      type="button"
                      key={o.id}
                      onClick={() => setDetail(el, q.id, o.id)}
                      className={cn(
                        "p-3.5 rounded-2xl border text-left transition-all duration-200",
                        isSelected ? "bg-gradient-to-b from-brand-gold/30 to-brand-gold/10 border-brand-gold shadow-[0_0_0_1px_rgba(212,175,99,0.4)]" : "bg-brand-cream-light border-brand-dim hover:border-brand-gold/60 hover:bg-brand-midsurface"
                      )}
                    >
                      {diagram ? (
                        <div className={cn('mb-1.5', isSelected ? 'text-brand-gold-dark' : 'text-brand-gold-dark/60')}>{diagram}</div>
                      ) : null}
                      <div className="font-sans text-[12px] text-brand-bone leading-snug mb-1">{o.label}</div>
                      <PriceDelta
                        mid={isSelected ? 0 : optionDelta}
                        neutralLabel={isSelected ? 'Selected' : o.hint}
                        dimmed={!isSelected}
                        className="text-[10px]"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const canAdvance = () => {
    if (step === 1) {
      if (!projectType) return false;
    }
    // Full-backyard elements are chosen ON step 2 — gate leaving step 2, not entering it,
    // or picking "Full Backyard" at step 1 would be a dead end with no way to reach the checklist.
    if (step === 2 && projectType === 'full' && selectedElements.length === 0) return false;
    return true;
  };

  const nextStep = () => {
    if (step === 1 && projectType === 'deck') { navigate('/deck-designer'); return; }
    if (canAdvance() && step < TOTAL_STEPS) {
      const next = step + 1;
      fireStep(next);
      setStep(next);
    }
  };
  const prevStep = () => setStep(s => Math.max(1, s - 1));

  const selectedLocation = ESTIMATOR_LOCATIONS.find(l => l.key === location) || ESTIMATOR_LOCATIONS[0];

  // Every completed run lands in the device vault (restored ?build= views
  // excluded — viewing someone's shared link isn't your estimate). Recorded on
  // arrival at the result only; lever tweaks afterwards belong to the same
  // visit and dedupe by permalink anyway.
  useEffect(() => {
    if (step !== TOTAL_STEPS || restoredRef.current) return;
    if (!permalink || !estimate.precise || estimate.totalLow <= 0) return;
    recordEstimate({
      permalink,
      projectType: projectType ?? '',
      city: selectedLocation.name,
      sqft: totalSqft,
      subtotalCents: estimate.precise.subtotalCents,
    });
    refreshVault();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);
  const showBrandPicker = isHardscape || isDeck || projectType === 'full';

  // Filter brands by tier and use case (driveway vs patio)
  const eligiblePavers = sortPaversForDisplay(
    PAVER_BRANDS.filter(p => p.tier === tier && (p.useCase === 'patio' || p.useCase === 'patio-driveway' || p.useCase === 'driveway'))
  );
  const eligibleDecks = DECK_BRANDS.filter(d => tier === 'premium' ? true : d.id === 'timbertech-prime');

  const showPaverPicker = showBrandPicker
    && (isHardscape || (projectType === 'full' && !selectedElements.every(e => e === 'deck')))
    && eligiblePavers.length > 0;
  const showDeckPicker = (isDeck || (projectType === 'full' && selectedElements.includes('deck')))
    && eligibleDecks.length > 0;

  /** Brand cards. Rendered on step 5 and again inside the result workbench, so
   *  the material choice stays changeable after the number exists — `compact`
   *  drops the explanatory copy that only earns its space the first time. */
  const renderBrandPickers = (compact = false) => {
    if (!showPaverPicker && !showDeckPicker) return null;
    return (
      <>
        {showPaverPicker && (
          <div className={compact ? 'mb-4' : 'mb-8'}>
            <div className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-gold-dark mb-2">Hardscape Brand</div>
            {!compact && (
              <p className="font-sans text-[11px] font-normal text-brand-bonewhite/70 mb-4">Prices shown are paver material only from the loaded supplier price table. The planning estimate includes installation allowances; confirm current supplier prices and project-specific excavation, materials, labour and disposal before contracting.</p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {eligiblePavers.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPaverBrandId(p.id)}
                  className={cn(
                    "relative p-4 rounded-2xl border text-left transition-all duration-200",
                    paverBrandId === p.id ? "bg-gradient-to-b from-brand-gold/30 to-brand-gold/10 border-brand-gold shadow-[0_0_0_1px_rgba(212,175,99,0.4)]" : "bg-brand-cream-light border-brand-dim hover:border-brand-gold/60 hover:bg-brand-midsurface"
                  )}
                >
                  {p.recommended && (
                    <div className="absolute -top-2.5 left-4 bg-brand-gold text-brand-black font-sans text-[9px] uppercase tracking-widest px-2.5 py-0.5 rounded-full font-medium shadow-[0_4px_12px_rgba(212,175,99,0.4)]">
                      Recommended
                    </div>
                  )}
                  {/* Product swatch — renders the moment Permacon dealer-portal
                      images land in estimatorImages.ts. Data-only wire-up. */}
                  {PAVER_SWATCHES[p.id] ? (
                    <img
                      src={PAVER_SWATCHES[p.id].src}
                      alt={PAVER_SWATCHES[p.id].alt}
                      width={960} height={720}
                      loading="lazy" decoding="async"
                      className="w-full h-40 rounded-xl object-cover border border-brand-dim mb-3 mt-1"
                    />
                  ) : null}
                  <div className="flex items-baseline justify-between gap-2 mb-1 mt-1">
                    <span className="font-sans text-[10px] uppercase tracking-wider text-brand-gold-dark">{p.brand}</span>
                    <span className="font-display text-[13px] text-brand-bone">from ${p.materialRetailPerSqft.toFixed(2)}/sqft</span>
                  </div>
                  <div className="font-sans text-[13px] text-brand-bone mb-1">{p.product}</div>
                  {!compact && (
                    <div className="font-sans text-[11px] font-normal text-brand-bonewhite/80">{p.description}</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {showDeckPicker && (
          <div className="mb-2">
            <div className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-gold-dark mb-4">Decking Brand</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {eligibleDecks.map(d => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDeckBrandId(d.id)}
                  className={cn(
                    "p-4 rounded-2xl border text-left transition-all duration-200",
                    deckBrandId === d.id ? "bg-gradient-to-b from-brand-gold/30 to-brand-gold/10 border-brand-gold shadow-[0_0_0_1px_rgba(212,175,99,0.4)]" : "bg-brand-cream-light border-brand-dim hover:border-brand-gold/60 hover:bg-brand-midsurface"
                  )}
                >
                  {/* TimberTech product shot — dealer asset, choosing a finish
                      by name alone is guesswork. */}
                  {DECK_BRAND_IMAGES[d.id] ? (
                    <img
                      src={DECK_BRAND_IMAGES[d.id].src}
                      alt={DECK_BRAND_IMAGES[d.id].alt}
                      width={320} height={240}
                      loading="lazy" decoding="async"
                      className={cn('w-full rounded-xl object-cover border border-brand-dim mb-3', compact ? 'h-36' : 'h-48')}
                    />
                  ) : null}
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <span className="font-sans text-[10px] uppercase tracking-wider text-brand-gold-dark">{d.brand}</span>
                    <span className="font-display text-[13px] text-brand-bone">${d.installedPerSqft}/sqft installed</span>
                  </div>
                  <div className="font-sans text-[13px] text-brand-bone mb-1">{d.product}</div>
                  {!compact && (
                    <div className="font-sans text-[11px] font-normal text-brand-bonewhite/80">{d.description}</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </>
    );
  };

  /** The live receipt rail only makes sense once there's a number to show and
   *  before the full breakdown takes over. */
  const showRail = step >= 2 && step < TOTAL_STEPS && estimate.precise !== null && display.low > 0 && !gateActive;

  const vaultMoney = (cents: number) => `$${Math.round(cents / 100).toLocaleString('en-CA')}`;

  return (
    <div className={cn('w-full mx-auto px-4 py-16 md:py-24', showRail ? 'max-w-[1280px]' : 'max-w-[920px]')} id="estimator">
      <div className="text-center mb-14">
        <div className="font-sans text-[11px] tracking-[0.3em] uppercase text-brand-gold-dark mb-5">
          Estimate Your Project
        </div>
        <h2 className="font-display text-5xl md:text-7xl leading-[1.05] mb-6 text-brand-bone tracking-tight">
          What will yours <span className="italic text-brand-gold-dark">cost?</span>
        </h2>
        <p className="font-sans font-light text-[17px] text-brand-muted max-w-xl mx-auto leading-[1.6]">
          Real numbers, real materials, real Simcoe County pricing. No signup to see your price.
        </p>
      </div>

      {/* Saved-builds drawer — this device's completed estimates, reopenable. */}
      {vaultEstimates.length > 0 && !gateActive && (
        <div className="mb-6">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setVaultOpen(o => !o)}
              className="inline-flex items-center gap-2 font-sans text-[11px] uppercase tracking-[0.2em] text-brand-gold-dark hover:text-brand-bone transition-colors px-4 py-2 rounded-full border border-brand-dim bg-brand-cream-light"
            >
              My estimates ({vaultEstimates.length})
              <ChevronDown size={13} className={cn('transition-transform', vaultOpen && 'rotate-180')} />
            </button>
          </div>
          {vaultOpen && (
            <div className="mt-3 bg-brand-cream-light border border-brand-dim rounded-2xl divide-y divide-brand-dim/50 overflow-hidden">
              {vaultEstimates.map(v => (
                <a
                  key={v.id}
                  href={v.permalink}
                  onClick={() => trackEngagement('estimator_vault_restore', v.projectType)}
                  className="flex items-baseline justify-between gap-4 px-5 py-3.5 hover:bg-brand-midsurface transition-colors"
                >
                  <span className="font-sans text-[13px] text-brand-bone min-w-0 truncate">
                    {PROJECT_TYPES.find(p => p.id === v.projectType)?.label ?? v.projectType}
                    <span className="text-brand-muted"> · {v.city}{v.sqft > 0 ? ` · ${v.sqft} sqft` : ''}</span>
                  </span>
                  <span className="font-sans text-[11px] text-brand-muted shrink-0">
                    {new Date(v.savedAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                  </span>
                  <span className="font-display text-[14px] text-brand-gold-dark tabular-nums shrink-0">
                    {vaultMoney(v.subtotalCents)}
                  </span>
                </a>
              ))}
              <p className="px-5 py-3 font-sans text-[10px] font-light text-brand-muted">
                Saved on this device. Opening one reopens that exact build — prices refresh to current rates.
              </p>
            </div>
          )}
        </div>
      )}

      <div className={cn(showRail && 'lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8 lg:items-start')}>
      {showRail && (
        <ReceiptRail
          precise={estimate.precise!}
          displayLow={display.low}
          displayHigh={display.high}
          confidence={confidence}
          delta={delta}
          targetBudget={targetBudget}
          canSkip={step >= 5}
          onSkip={() => { fireStep(7); setStep(7); }}
        />
      )}
      <div ref={cardRef} className="relative bg-brand-cream-light border border-brand-dim rounded-3xl p-7 md:p-14 overflow-hidden shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)] lg:order-first scroll-mt-20">
        {gateActive ? (
          <EstimatorUnlock lastEstimate={vaultEstimates[0] ?? null} onUnlocked={handleUnlocked} />
        ) : (
        <>
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-brand-dim/40 rounded-t-3xl overflow-hidden">
          <motion.div className="h-full bg-gradient-to-r from-brand-gold/80 via-brand-gold to-brand-gold/80"
            initial={{ width: '14%' }}
            animate={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            transition={{ type: 'spring', stiffness: 90, damping: 20 }}
          />
        </div>
        {/* Step dots are navigation, not decoration. Any step you've already
            reached is one tap away — being able to move around freely is what
            being in charge of a form physically feels like. Steps ahead stay
            inert so the dots never promise a jump they won't make. */}
        <nav aria-label="Estimator steps" className="flex justify-between items-center mb-12 mt-5">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map(i => {
            const visited = i <= furthestStep;
            const isCurrent = step === i;
            return (
              <button
                key={i}
                type="button"
                disabled={!visited}
                onClick={() => { if (visited && !isCurrent) { fireStep(i); setStep(i); } }}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`Step ${i}: ${STEP_NAMES[i]}${visited ? '' : ' (not yet reached)'}`}
                title={visited ? `Step ${i} · ${STEP_NAMES[i]}` : undefined}
                className={cn(
                  // Generous hit target around a small dot — the dot is 6px,
                  // the tap area is 36px.
                  'group relative w-9 h-9 -mx-1.5 flex items-center justify-center rounded-full transition-colors',
                  visited ? 'cursor-pointer hover:bg-brand-gold/10' : 'cursor-default',
                )}
              >
                <motion.span
                  animate={{ scale: isCurrent ? 1.4 : 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className={cn(
                    'w-1.5 h-1.5 rounded-full transition-colors duration-300',
                    isCurrent ? 'bg-brand-gold shadow-[0_0_12px_rgba(212,175,99,0.6)]'
                      : visited ? 'bg-brand-gold/60 group-hover:bg-brand-gold'
                      : 'bg-brand-dim',
                  )}
                />
              </button>
            );
          })}
        </nav>

        {/* Tablet running estimate — the lg+ receipt rail takes over from here.
            The breakdown shortcut only appears once the pricing-relevant questions are behind them. */}
        {step >= 2 && step < TOTAL_STEPS && display.low > 0 && (
          <div className="hidden md:flex lg:hidden items-center justify-between gap-6 mb-12 px-6 py-4 rounded-2xl bg-gradient-to-r from-brand-gold/10 to-transparent border border-brand-gold/20">
            <div className="flex items-baseline gap-5">
              <div>
                <div className="font-sans text-[9px] uppercase tracking-[0.3em] text-brand-gold-dark mb-1.5">Your range so far</div>
                <div className="font-display text-3xl text-brand-bone leading-none flex items-baseline gap-3">
                  <AnimatedPrice low={display.low} high={display.high} separatorClassName="!mx-1.5" />
                  <AnimatePresence>
                    {delta !== null && (
                      <motion.span
                        key="delta"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className={cn("font-sans text-[13px] font-medium", delta > 0 ? "text-brand-gold-dark" : "text-brand-success")}
                      >
                        {delta > 0 ? '+' : '−'}${Math.abs(Math.round(delta / 100) * 100).toLocaleString()}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              <div className="hidden lg:block pl-5 border-l border-brand-gold/15">
                <div className="font-sans text-[9px] uppercase tracking-[0.3em] text-brand-gold-dark mb-1.5">Confidence</div>
                <div className="font-display text-3xl text-brand-bone leading-none">±{confidence}%</div>
              </div>
              {/* Their number, tracked alongside ours from the moment they set it. */}
              {targetBudget !== null && (
                <div className="hidden lg:block pl-5 border-l border-brand-gold/15">
                  <div className="font-sans text-[9px] uppercase tracking-[0.3em] text-brand-gold-dark mb-1.5">Your target</div>
                  <div className="font-display text-3xl text-brand-bone leading-none tabular-nums">
                    ${(targetBudget / 1000).toFixed(0)}k
                  </div>
                </div>
              )}
            </div>
            {step >= 5 ? (
              <div className="flex items-center gap-4">
                <span className="hidden lg:block font-sans text-[11px] font-normal text-brand-muted max-w-[180px] leading-snug">
                  Answer a few more, or see your breakdown now — either way you'll be able to fine-tune it there.
                </span>
                <button
                  type="button"
                  onClick={() => { fireStep(7); setStep(7); }}
                  className="btn-primary !rounded-full whitespace-nowrap !py-3 !px-6"
                >
                  Skip to full breakdown →
                </button>
              </div>
            ) : (
              <span className="font-sans text-[11px] font-normal text-brand-muted max-w-[200px] leading-snug text-right">
                Completing each step narrows this range — we price your project, not just your square footage.
              </span>
            )}
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <h3 className="font-display text-3xl text-brand-bone mb-3">What are you looking to build?</h3>
              <p className="text-sm text-brand-muted mb-8">Choose your project below. Images illustrate each project type.</p>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5">
                {PROJECT_TYPES.map((pt, idx) => {
                  const isSelected = projectType === pt.id;
                  return (
                    <button
                      key={pt.id}
                      type="button"
                      aria-label={pt.label}
                      aria-pressed={isSelected}
                      onClick={() => { setProjectType(pt.id); if (pt.id !== 'full') setSelectedElements([]); }}
                      className={cn(
                        'group relative flex flex-col min-w-0 overflow-hidden rounded-2xl border text-left transition-all duration-200 cursor-pointer',
                        isSelected ? 'bg-brand-gold/10 border-brand-gold-dark ring-1 ring-brand-gold-dark' : 'bg-brand-surface border-brand-dim hover:border-brand-gold-dark hover:shadow-md'
                      )}
                    >
                      <TypeThumb typeId={pt.id} eager={idx < 3} />
                      {isSelected && <span className="absolute top-3 right-3 w-7 h-7 rounded-full bg-brand-ink text-brand-porcelain flex items-center justify-center shadow-sm"><Check size={16} aria-hidden="true" /></span>}
                      <span className="block p-3 md:p-4">
                        <span className="block font-sans text-[12px] md:text-[14px] text-brand-ink font-medium mb-1.5 leading-snug">{pt.label}</span>
                        <span className="block font-sans text-[11px] md:text-[12px] text-brand-muted leading-relaxed">{pt.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <h3 className="font-display text-3xl text-brand-bone mb-6">Let's talk size and scope.</h3>

              {/* Asked here, not on step 1 — after they've told us what they
                  want to build, "what would you like to spend?" reads as help
                  rather than qualification. */}
              <div className="mb-9">
                <BudgetTarget
                  value={targetBudget}
                  onChange={(v) => {
                    setTargetBudget(v);
                    // Bucketed, never the raw figure — this is a funnel signal,
                    // not a field for someone to browse in analytics.
                    trackEngagement('estimator_budget_set', v >= 75000 ? '75k_plus' : v >= 50000 ? '50k_75k' : v >= 30000 ? '30k_50k' : v >= 15000 ? '15k_30k' : 'under_15k');
                  }}
                  onSkip={() => {
                    if (targetBudget === null) trackEngagement('estimator_budget_skip', 'not_sure');
                    setTargetBudget(null);
                  }}
                />
              </div>

              {projectType === 'full' ? (
                <div className="space-y-8">
                  <p className="font-sans text-[13px] text-brand-muted mb-6">Select all the elements you want to include in your backyard transformation:</p>
                  <div className="grid grid-cols-2 gap-3 md:gap-4 mb-8">
                    {PROJECT_TYPES.filter(pt => pt.id !== 'full').map(pt => (
                      <button
                        type="button"
                        key={pt.id}
                        aria-label={pt.label}
                        aria-pressed={selectedElements.includes(pt.id)}
                        onClick={() => toggleElement(pt.id)}
                        className={cn(
                          'relative flex flex-col min-w-0 overflow-hidden rounded-2xl border text-left transition-colors cursor-pointer',
                          selectedElements.includes(pt.id) ? 'bg-brand-gold/10 border-brand-gold-dark ring-1 ring-brand-gold-dark' : 'bg-brand-surface border-brand-dim hover:border-brand-gold-dark'
                        )}
                      >
                        <TypeThumb typeId={pt.id} />
                        <span className="flex items-center gap-2 p-3 md:p-4">
                          <span className={cn('w-5 h-5 rounded-md border flex items-center justify-center shrink-0', selectedElements.includes(pt.id) ? 'bg-brand-ink border-brand-ink' : 'border-brand-muted')}>
                            {selectedElements.includes(pt.id) && <Check size={14} className="text-brand-porcelain" aria-hidden="true" />}
                          </span>
                          <span className="text-[12px] md:text-[13px] text-brand-ink font-medium leading-snug">{pt.label}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                  {selectedElements.length > 0 && (
                    <div className="pt-8 border-t border-brand-gold/10 space-y-12">
                      <h4 className="font-display text-2xl text-brand-bone">Configure Sizes</h4>
                      {selectedElements.map(el => {
                        // Mobile accordion; desktop always open. A lone
                        // element stays open — collapsing it would just be a
                        // pointless extra tap.
                        const isOpen = openElement === el || selectedElements.length === 1;
                        return (
                        <div key={el} className="bg-brand-cream-light p-6 rounded-2xl border border-brand-dim/50">
                          <button
                            type="button"
                            onClick={() => setOpenElement(prev => (prev === el ? null : el))}
                            aria-expanded={isOpen}
                            className="w-full flex items-center justify-between gap-3 text-left md:pointer-events-none"
                          >
                            <h5 className="font-sans text-[10px] uppercase tracking-[0.2em] text-brand-gold-dark">
                              {PROJECT_TYPES.find(p => p.id === el)?.label}
                            </h5>
                            <ChevronDown
                              size={16}
                              className={cn('md:hidden text-brand-gold-dark/70 shrink-0 transition-transform duration-200', isOpen && 'rotate-180')}
                              strokeWidth={1.75}
                            />
                          </button>
                          <div className={cn(isOpen ? 'block' : 'hidden', 'md:block', 'mt-6')}>
                            {renderSizeInputs(el)}
                            {renderDetailQuestions(el)}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="max-w-xl">{renderSizeInputs(projectType!)}</div>
                  {renderDetailQuestions(projectType!)}
                </div>
              )}
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <h3 className="font-display text-3xl text-brand-bone mb-8">Any special site conditions?</h3>
              <p className="font-sans text-[13px] text-brand-muted mb-8">Select any that apply. These affect labour time, equipment, and final pricing.</p>
              <div className="space-y-4">
                {CONDITIONS.map(cond => {
                  // Toggling a condition is a statement about their yard, so the
                  // number shown is what saying "yes" costs (or, once on, what
                  // it's currently adding).
                  const condDelta = preview({
                    conditions: { ...conditions, [cond.id]: !conditions[cond.id] },
                  });
                  return (
                  <div
                    key={cond.id}
                    onClick={() => toggleCondition(cond.id)}
                    className={cn(
                      "flex items-start gap-4 p-5 rounded-2xl border transition-all duration-200 cursor-pointer",
                      conditions[cond.id] ? "bg-gradient-to-b from-brand-gold/30 to-brand-gold/10 border-brand-gold shadow-[0_0_0_1px_rgba(212,175,99,0.4)]" : "bg-brand-cream-light border-brand-dim hover:border-brand-gold/60 hover:bg-brand-midsurface"
                    )}
                  >
                    <div className={cn(
                      "mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0",
                      conditions[cond.id] ? "bg-brand-gold border-brand-gold" : "border-brand-gold/60"
                    )}>
                      {conditions[cond.id] && <Check size={14} className="text-brand-black" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <span className="font-sans text-[13px] text-brand-bone">{cond.label}</span>
                        {/* Off: what saying yes would cost. On: what it's
                            contributing right now — negating the "remove it"
                            delta, so a checked condition never misreads as a saving. */}
                        <PriceDelta
                          mid={conditions[cond.id] ? -condDelta : condDelta}
                          neutralLabel={cond.hint}
                          className="text-[13px]"
                        />
                      </div>
                      <div className="font-sans text-[11px] font-normal text-brand-bonewhite/70 mt-1">{cond.why}</div>
                    </div>
                  </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <div className="flex items-center gap-3 mb-8">
                <MapPin size={22} className="text-brand-gold-dark" strokeWidth={1.5} />
                <h3 className="font-display text-3xl text-brand-bone">Where's the project?</h3>
              </div>
              <p className="font-sans text-[13px] text-brand-muted mb-8">
                We localize your estimate by delivery zone and crew travel. Confirm service availability for your address. {canPublish(BUSINESS.reviews.projectCounts) && selectedLocation.projects2025 > 0 ? `We've completed ${selectedLocation.projects2025} projects in ${selectedLocation.name} in 2025.` : ''}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {ESTIMATOR_LOCATIONS.map(loc => (
                  <button
                    key={loc.key}
                    type="button"
                    onClick={() => setLocation(loc.key)}
                    className={cn(
                      "px-5 py-4 rounded-2xl border text-left transition-all duration-200",
                      location === loc.key ? "bg-gradient-to-b from-brand-gold/30 to-brand-gold/10 border-brand-gold shadow-[0_0_0_1px_rgba(212,175,99,0.4)]" : "bg-brand-cream-light border-brand-dim hover:border-brand-gold/60 hover:bg-brand-midsurface"
                    )}
                  >
                    <div className="font-sans text-[13px] text-brand-bone">{loc.name}</div>
                    {canPublish(BUSINESS.reviews.projectCounts) && loc.projects2025 > 0 ? (
                      <div className="font-sans text-[10px] text-brand-muted mt-1">{loc.projects2025} projects · 2025</div>
                    ) : (
                      <div className="font-sans text-[10px] text-brand-muted mt-1">Confirm availability</div>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div key="step5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <h3 className="font-display text-3xl text-brand-bone mb-3">Material preference</h3>
              <p className="font-sans text-[13px] text-brand-muted mb-8">Pick a tier first, then a specific brand. Material availability and final selections are confirmed for your project.</p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-10">
                {TIERS.map(t => {
                  // Changing tier also auto-swaps the brand (see the effect
                  // above), so the preview has to patch BOTH or the quoted
                  // saving won't match what actually happens on click.
                  const tierDelta = preview({
                    tier: t.id,
                    paverBrandId: defaultPaverForTier(t.id).id,
                  });
                  return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTier(t.id)}
                    className={cn(
                      "relative p-4 rounded-2xl border text-left transition-all duration-200",
                      tier === t.id ? "bg-gradient-to-b from-brand-gold/30 to-brand-gold/10 border-brand-gold shadow-[0_0_0_1px_rgba(212,175,99,0.4)]" : "bg-brand-cream-light border-brand-dim hover:border-brand-gold/60 hover:bg-brand-midsurface"
                    )}
                  >
                    {t.badge && (
                      <div className="absolute -top-2 left-3 bg-brand-gold text-brand-black font-sans text-[8px] uppercase tracking-widest px-2 py-0.5 rounded-2xl font-medium">
                        {t.badge}
                      </div>
                    )}
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <span className="font-display text-lg text-brand-bone">{t.label}</span>
                      <PriceDelta
                        mid={tier === t.id ? 0 : tierDelta}
                        neutralLabel={tier === t.id ? 'Current' : 'Same price'}
                        dimmed={tier !== t.id}
                        className="text-[12px]"
                      />
                    </div>
                    <div className="font-sans text-[11px] font-normal text-brand-bonewhite/80 leading-snug">{t.sub}</div>
                  </button>
                  );
                })}
              </div>

              {renderBrandPickers()}
            </motion.div>
          )}

          {step === 6 && (
            <motion.div key="step6" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <h3 className="font-display text-3xl text-brand-bone mb-3">Add-ons & extras</h3>
              <p className="font-sans text-[13px] text-brand-muted mb-8">Optional. Each item adds a real line to your estimate.</p>

              <div className="space-y-3 mb-10">
                {ADD_ONS.map(a => {
                  const isOn = addOns.includes(a.id);
                  // The engine adds crew-days per add-on as well as the flat
                  // cost, so the real effect can exceed the sticker range.
                  // Show what actually happens to the total.
                  const addOnDelta = preview({
                    addOns: isOn ? addOns.filter(x => x !== a.id) : [...addOns, a.id],
                  });
                  return (
                  <div
                    key={a.id}
                    onClick={() => toggleAddOn(a.id)}
                    className={cn(
                      "flex items-start gap-4 p-5 rounded-2xl border transition-all duration-200 cursor-pointer",
                      addOns.includes(a.id) ? "bg-gradient-to-b from-brand-gold/30 to-brand-gold/10 border-brand-gold shadow-[0_0_0_1px_rgba(212,175,99,0.4)]" : "bg-brand-cream-light border-brand-dim hover:border-brand-gold/60 hover:bg-brand-midsurface"
                    )}
                  >
                    <div className={cn(
                      "mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0",
                      addOns.includes(a.id) ? "bg-brand-gold border-brand-gold" : "border-brand-gold/60"
                    )}>
                      {addOns.includes(a.id) && <Check size={14} className="text-brand-black" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-baseline justify-between gap-3 mb-1">
                        <span className="font-sans text-[13px] text-brand-bone">{a.label}</span>
                        {/* On: what it's adding. Off: what adding it would cost. */}
                        <PriceDelta
                          mid={isOn ? -addOnDelta : addOnDelta}
                          neutralLabel={`+${fmt(a.costLow)}–${fmt(a.costHigh)}`}
                          className="text-[13px]"
                        />
                      </div>
                      <div className="font-sans text-[11px] font-normal text-brand-bonewhite/80 leading-relaxed">{a.description}</div>
                    </div>
                  </div>
                  );
                })}
              </div>

              {/* Photo upload */}
              <div className="border-t border-brand-gold/10 pt-8">
                <div className="flex items-center gap-2 mb-3">
                  <ImageIcon size={16} className="text-brand-gold-dark" strokeWidth={1.5} />
                  <span className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-gold-dark">Tighten Your Estimate</span>
                </div>
                <h4 className="font-display text-xl text-brand-bone mb-2">Upload yard photos (optional)</h4>
                <p className="font-sans text-[12px] font-normal text-brand-bonewhite/80 mb-5 leading-relaxed">
                  Looking at a photo of the area yourself helps you answer the questions above accurately — we'll ask you to send it before we quote.
                </p>
                {photoFile ? (
                  <div className="bg-brand-cream border border-brand-gold/30 rounded-2xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <ImageIcon size={18} className="text-brand-gold-dark shrink-0" strokeWidth={1.5} />
                      <div className="min-w-0">
                        <div className="font-sans text-[13px] text-brand-bone truncate">{photoFile.name}</div>
                        <div className="font-sans text-[11px] font-normal text-brand-bonewhite/80">{(photoFile.size / 1024 / 1024).toFixed(1)} MB</div>
                      </div>
                    </div>
                    <button type="button" onClick={() => setPhotoFile(null)} className="p-2 text-brand-muted hover:text-brand-bone transition-colors">
                      <X size={16} strokeWidth={1.5} />
                    </button>
                  </div>
                ) : (
                  <label className="block bg-brand-cream-light border border-dashed border-brand-dim rounded-2xl p-6 hover:bg-brand-midsurface text-center cursor-pointer hover:border-brand-gold/60 transition-colors">
                    <input type="file" accept="image/*" onChange={onPhotoChange} className="hidden" />
                    <Upload size={20} className="text-brand-gold-dark mx-auto mb-2" strokeWidth={1.5} />
                    <div className="font-sans text-[13px] text-brand-bone">Drop a photo or click to upload</div>
                    <div className="font-sans text-[11px] font-normal text-brand-bonewhite/80 mt-1">JPG, PNG, HEIC · up to 10 MB</div>
                  </label>
                )}
              </div>
            </motion.div>
          )}

          {step === 7 && display.lines && (
            <motion.div key="step7" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
              <EstimateBreakdown
                excavation={display.lines.excavation}
                materials={display.lines.materials}
                labour={display.lines.labour}
                disposal={display.lines.disposal}
                restoration={display.lines.restoration}
                totalLow={display.low}
                totalHigh={display.high}
                confidencePercent={confidence}
                precise={estimate.precise}
                brandName={isDeck ? `${selectedDeck.brand} ${selectedDeck.product}` : `${selectedPaver.brand} ${selectedPaver.product}`}
                sqft={totalSqft}
                city={selectedLocation.name}
                /* The result is a workbench, not a receipt. Everything that
                   moved the number stays reachable — directly under the
                   headline, so the number never reads as final. */
                belowHero={
                  <>
                  {targetBudget !== null && (
                    <div className="mb-6">
                      <BudgetGapCoach
                        build={build}
                        target={targetBudget}
                        displayLow={display.low}
                        displayHigh={display.high}
                        rangeFor={totalFor}
                        onApply={applyLever}
                      />
                    </div>
                  )}
                  <EstimateWorkbench
                  build={build}
                  preview={preview}
                  totalFor={totalFor}
                  sizeControl={
                    projectType === 'full' ? (
                      <div className="space-y-6">
                        {selectedElements.map(el => (
                          <div key={el}>
                            <div className="font-sans text-[11px] uppercase tracking-[0.2em] text-brand-bonewhite/60 mb-3">
                              {PROJECT_TYPES.find(p => p.id === el)?.label ?? el}
                            </div>
                            {renderSizeInputs(el)}
                          </div>
                        ))}
                      </div>
                    ) : (
                      renderSizeInputs(projectType!)
                    )
                  }
                  brandPicker={renderBrandPickers(true)}
                  onTier={setTier}
                  onToggleAddOn={toggleAddOn}
                  onToggleCondition={toggleCondition}
                  onAdjust={trackAdjust}
                  />
                  </>
                }
              />

              {details['wall.wallPurpose'] === 'structure' && (
                <div className="mt-6 px-6 py-4 rounded-2xl bg-brand-gold/8 border border-brand-gold/25">
                  <p className="font-sans text-[12px] font-normal text-brand-bonewhite/85 leading-relaxed">
                    <span className="text-brand-gold-dark">Heads up:</span> walls supporting a driveway or structure
                    may have engineering or permit requirements. Confirm the requirements for the specific site and written scope.
                  </p>
                </div>
              )}

              {addOns.length > 0 && (
                <div className="mt-8 bg-brand-cream-light border border-brand-dim/60 rounded-3xl p-6">
                  <div className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-gold-dark mb-4">Selected Add-ons</div>
                  <div className="divide-y divide-brand-gold/10">
                    {addOns.map(aid => {
                      const a = ADD_ONS.find(x => x.id === aid);
                      if (!a) return null;
                      return (
                        <div key={aid} className="py-3 flex items-baseline justify-between gap-3">
                          <span className="font-sans text-[13px] text-brand-bone">{a.label}</span>
                          <span className="font-display text-[14px] text-brand-gold-dark whitespace-nowrap">+{fmt(a.costLow)} – {fmt(a.costHigh)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div ref={saveCardRef} className="mt-10 grid lg:grid-cols-2 gap-6 scroll-mt-24">
                <EstimateLeadCapture estimate={{
                  projectType: projectType || '',
                  selectedElements,
                  totalLow: estimate.totalLow,
                  totalHigh: estimate.totalHigh,
                  brandName: isDeck ? `${selectedDeck.brand} ${selectedDeck.product}` : `${selectedPaver.brand} ${selectedPaver.product}`,
                  city: selectedLocation.name,
                  sqft: totalSqft,
                  addOns,
                  hasPhotos: !!photoFile,
                  conditions: Object.entries(conditions).filter(([, v]) => v).map(([k]) => k),
                  details,
                  displayedLow: display.low,
                  displayedHigh: display.high,
                  targetBudget,
                  scopeSizes: Object.entries(sizes)
                    .filter(([, v]) => typeof v === 'string')
                    .map(([k, v]) => `${k}=${v}`).join(', '),
                  preciseSubtotalCents: estimate.precise?.subtotalCents ?? null,
                  preciseHstCents: estimate.precise?.hstCents ?? null,
                  preciseGrandTotalCents: estimate.precise?.grandTotalCents ?? null,
                }}
                permalink={permalink}
                onUnlock={(email) => {
                  setBuildSaved(true);
                  // Saving a build IS handing over an email — unlock the vault
                  // too, so the repeat gate never asks for it a second time.
                  unlockVault(email);
                  refreshVault();
                  trackEngagement('estimator_build_saved', projectType ?? 'unknown');
                }} />
                <div className="bg-brand-cream-light border border-brand-dim/60 rounded-3xl p-6 md:p-8 flex flex-col justify-center">
                  <div className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-gold-dark mb-3">Project Timeline</div>
                  <div className="font-display text-3xl text-brand-bone mb-2">
                    {estimate.days.low}–{estimate.days.high} days on-site
                  </div>
                  <div className="font-sans text-[12px] font-normal text-brand-bonewhite/80 leading-relaxed mb-6">
                    Timing depends on scope, site conditions, material availability, and the current schedule.
                  </div>
                  <div className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-gold-dark mb-3">Confidence</div>
                  <div className="font-display text-3xl text-brand-bone mb-2">±{confidence}%</div>
                  <div className="font-sans text-[12px] font-normal text-brand-bonewhite/80 leading-relaxed">
                    Site review and written scope help refine the planning range; final pricing is confirmed for the specific property.
                  </div>
                </div>
              </div>

              <div className="mt-12">
                <EstimateBookingCTA />
              </div>

              <div className="mt-12 text-center">
                <button onClick={startOver} className="btn-ghost text-[9px] py-3 px-6">Price Another Project</button>
              </div>

              <p className="mt-8 font-sans text-xs font-normal text-brand-bonewhite/80 text-center max-w-3xl mx-auto leading-[1.6]">
                {getEstimatorRangeCopy(projectType, selectedElements)} <span className="text-brand-gold-dark font-normal">No job minimum — every project gets priced on its real scope, whatever the size.</span> Final pricing depends on site measurement, material availability, access, drainage, and design complexity.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {step < TOTAL_STEPS && (
          <div className="mt-14 pt-8 border-t border-brand-dim/60 flex flex-col-reverse gap-4 sm:flex-row sm:justify-between sm:items-center">
            {step > 1 ? (
              <button onClick={prevStep} className="btn-ghost !rounded-full !border-brand-dim hover:!border-brand-dim w-full sm:w-auto text-center">← Back</button>
            ) : <div className="hidden sm:block" />}
            <button
              onClick={nextStep}
              className={cn(
                "btn-primary !rounded-full px-10 w-full sm:w-auto text-center justify-center shadow-[0_8px_24px_-8px_rgba(212,175,99,0.4)] hover:shadow-[0_12px_32px_-8px_rgba(212,175,99,0.55)] transition-shadow",
                !canAdvance() ? "opacity-40 cursor-not-allowed" : ""
              )}
              disabled={!canAdvance()}
            >
              {step === 6 ? 'See Estimate →' : 'Continue →'}
            </button>
          </div>
        )}
        </>
        )}
      </div>
      </div>

      {/* Mobile sticky bar — step 1 shows the selection, steps 2-6 the narrowing running estimate */}
      {!gateActive && step < TOTAL_STEPS && ((step === 1 && projectType) || (step >= 2 && display.low > 0)) && (
        <MobileStickyBar
          low={step === 1 ? 0 : display.low}
          high={step === 1 ? 0 : display.high}
          delta={step === 1 ? null : delta}
          confidence={confidence}
          preciseCents={step === 1 ? null : estimate.precise?.subtotalCents ?? null}
          selectedLabel={step === 1 ? (PROJECT_TYPES.find(p => p.id === projectType)?.label ?? '') : ''}
          label={step >= 5 ? 'See Full Breakdown →' : 'Continue →'}
          onContinue={step >= 5 ? () => { fireStep(7); setStep(7); } : nextStep}
        />
      )}

      {/* Result-step sticky bar — on mobile the workbench is a long scroll and
          the hero number leaves the viewport, which breaks the "number follows
          your changes" loop exactly where it matters. Keep the live price
          pinned; the button jumps to the save card. Gone once saved. */}
      {!gateActive && step === TOTAL_STEPS && !buildSaved && display.low > 0 && (
        <MobileStickyBar
          low={display.low}
          high={display.high}
          delta={delta}
          confidence={confidence}
          preciseCents={estimate.precise?.subtotalCents ?? null}
          title="Your estimate"
          label="Save build →"
          onContinue={() => saveCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        />
      )}

      {/* Desktop counterpart of the result-step sticky bar. The result page is a
          ~6,000px scroll and the live rail stops at step 6, so on md+ the total
          and the save action both leave the viewport exactly where the build is
          finished. Same guard as the mobile bar above, same "gone once saved". */}
      {!gateActive && step === TOTAL_STEPS && !buildSaved && display.low > 0 && (
        <DesktopResultCta
          confidence={confidence}
          preciseCents={estimate.precise?.subtotalCents ?? null}
          low={display.low}
          high={display.high}
          onSave={() => saveCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        />
      )}
    </div>
  );
}

/** Desktop live receipt — the categories fill in and re-price as answers land,
 *  which is what makes the wizard read as an app assembling a real quote
 *  rather than a form waiting to be finished. lg+ only; the mobile sticky bar
 *  and tablet running bar carry the same number below that. */
function ReceiptRail({ precise, displayLow, displayHigh, confidence, delta, targetBudget, canSkip, onSkip }: {
  precise: PreciseResult;
  displayLow: number;
  displayHigh: number;
  confidence: number;
  delta: number | null;
  targetBudget: number | null;
  canSkip: boolean;
  onSkip: () => void;
}) {
  const money = (cents: number) =>
    `$${(cents / 100).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const rows: { label: string; cents: number }[] = [
    { label: 'Excavation & prep', cents: precise.perCategoryCents.excavation },
    { label: 'Materials & delivery', cents: precise.perCategoryCents.materials },
    { label: 'Labour & installation', cents: precise.perCategoryCents.labour },
    { label: 'Disposal', cents: precise.perCategoryCents.disposal },
    { label: 'Restoration & cleanup', cents: precise.perCategoryCents.restoration },
  ];
  return (
    <aside className="hidden lg:block sticky top-24 self-start" aria-label="Live estimate">
      <div className="bg-brand-cream-light border border-brand-dim rounded-3xl p-6 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.35)]">
        <div className="font-sans text-[9px] uppercase tracking-[0.3em] text-brand-gold-dark mb-3">
          Your estimate · live
        </div>
        <div className="flex items-baseline gap-2.5 mb-1">
          <AnimatedMoney cents={precise.subtotalCents} className="font-display text-[32px] leading-none text-brand-bone tracking-tight" />
          <AnimatePresence>
            {delta !== null && (
              <motion.span
                key="delta"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className={cn('font-sans text-[12px] font-medium', delta > 0 ? 'text-brand-gold-dark' : 'text-brand-success')}
              >
                {delta > 0 ? '+' : '−'}${Math.abs(Math.round(delta / 100) * 100).toLocaleString()}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <div className="font-sans text-[11px] text-brand-muted mb-4">
          + HST · likely range {fmt(displayLow)}–{fmt(displayHigh)} · ±{confidence}%
        </div>
        <div className="divide-y divide-brand-dim/50 border-t border-brand-dim/50">
          {rows.map(r => (
            <div key={r.label} className="py-2.5 flex justify-between items-baseline gap-3">
              <span className="font-sans text-[12px] text-brand-muted">{r.label}</span>
              <span className="font-display text-[13px] text-brand-bone tabular-nums whitespace-nowrap">{money(r.cents)}</span>
            </div>
          ))}
          {precise.addOnsCents > 0 && (
            <div className="py-2.5 flex justify-between items-baseline gap-3">
              <span className="font-sans text-[12px] text-brand-muted">Add-ons</span>
              <span className="font-display text-[13px] text-brand-bone tabular-nums whitespace-nowrap">{money(precise.addOnsCents)}</span>
            </div>
          )}
          {targetBudget !== null && (
            <div className="py-2.5 flex justify-between items-baseline gap-3">
              <span className="font-sans text-[12px] text-brand-gold-dark">Your target</span>
              <span className="font-display text-[13px] text-brand-gold-dark tabular-nums whitespace-nowrap">
                ${targetBudget.toLocaleString()}
              </span>
            </div>
          )}
        </div>
        {canSkip && (
          // btn-primary, not btn-secondary — the secondary button is bright
          // gold text for dark surfaces and reads ~1.9:1 on this light card.
          <button type="button" onClick={onSkip} className="btn-primary !rounded-full w-full justify-center text-center mt-5 !py-3">
            See full breakdown →
          </button>
        )}
        <p className="font-sans text-[10px] font-light text-brand-muted mt-4 leading-relaxed">
          Priced from Carr trade-book pricing — each answer re-prices the build.
        </p>
      </div>
    </aside>
  );
}

/** md+ result-step pill. Dark surface, so gold-as-text is the bright `brand-gold`
 *  (the gold-dark rule applies to light surfaces). Bottom-right so it clears the
 *  invoice column; `hidden md:flex` keeps it off mobile, where MobileStickyBar
 *  already owns the bottom of the viewport. */
function DesktopResultCta({ low, high, confidence, preciseCents, onSave }: {
  low: number; high: number; confidence: number; preciseCents: number | null; onSave: () => void;
}) {
  return (
    <motion.div
      data-testid="desktop-result-cta"
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="hidden md:flex fixed bottom-6 right-6 z-40 items-center gap-5 bg-brand-black border border-brand-gold/30 rounded-full pl-6 pr-3 py-3 shadow-[0_10px_40px_rgba(0,0,0,0.45)]"
    >
      <div className="min-w-0">
        <div className="font-sans text-[9px] uppercase tracking-[0.25em] text-brand-gold">
          Your estimate · ±{confidence}%{preciseCents ? ' · +HST' : ''}
        </div>
        <div className="font-display text-lg text-brand-porcelain truncate">
          {preciseCents ? (
            <AnimatedDollars cents={preciseCents} />
          ) : (
            <AnimatedPrice low={low} high={high} separatorClassName="!mx-1.5" />
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onSave}
        className="bg-brand-gold text-brand-black font-sans text-[11px] uppercase tracking-wider px-5 py-3 rounded-full font-medium shrink-0"
      >
        Save build →
      </button>
    </motion.div>
  );
}

function MobileStickyBar({ low, high, delta, confidence, label, onContinue, selectedLabel = '', title, preciseCents }: {
  low: number; high: number; delta: number | null; confidence: number; label: string; onContinue: () => void; selectedLabel?: string;
  /** Overrides the "Running Estimate" heading — the result step says "Your estimate". */
  title?: string;
  /** When the takeoff engine has a point estimate, the bar leads with it. */
  preciseCents?: number | null;
}) {
  if (low === 0) {
    return (
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-brand-black border-t border-brand-gold/30 px-4 py-3 flex items-center justify-between gap-3 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]"
      >
        <div className="min-w-0">
          <div className="font-sans text-[9px] uppercase tracking-[0.25em] text-brand-gold">Selected</div>
          <div className="font-display text-lg text-brand-porcelain truncate">{selectedLabel}</div>
        </div>
        <button
          onClick={onContinue}
          className="bg-brand-gold text-brand-black font-sans text-[11px] uppercase tracking-wider px-4 py-3 rounded-2xl font-medium shrink-0"
        >
          {label}
        </button>
      </motion.div>
    );
  }
  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-brand-black border-t border-brand-gold/30 px-4 py-3 flex items-center justify-between gap-3 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]"
    >
      <div className="min-w-0">
        <div className="font-sans text-[9px] uppercase tracking-[0.25em] text-brand-gold">{title ?? 'Running Estimate'} · ±{confidence}%{preciseCents ? ' · +HST' : ''}</div>
        <div className="font-display text-lg text-brand-porcelain truncate flex items-baseline gap-2">
          {preciseCents ? (
            <AnimatedDollars cents={preciseCents} />
          ) : (
            <AnimatedPrice low={low} high={high} separatorClassName="!mx-1.5" />
          )}
          <AnimatePresence>
            {delta !== null && (
              <motion.span
                key="delta"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className={cn("font-sans text-[11px] font-medium", delta > 0 ? "text-brand-gold" : "text-brand-porcelain-soft")}
              >
                {delta > 0 ? '+' : '−'}${Math.abs(Math.round(delta / 100) * 100).toLocaleString()}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
      <button
        onClick={onContinue}
        className="bg-brand-gold text-brand-black font-sans text-[11px] uppercase tracking-wider px-4 py-3 rounded-2xl font-medium shrink-0"
      >
        {label}
      </button>
    </motion.div>
  );
}
