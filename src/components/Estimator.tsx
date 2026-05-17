import { useState, useMemo, useEffect, type ChangeEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Grid, Hexagon, AlignJustify, ListTree, Layout,
  ChefHat, Flame, Sun, Leaf, Lightbulb, Map, Check, MapPin, Image as ImageIcon, Upload, X,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import EstimateBreakdown from './EstimateBreakdown';
import EstimateLeadCapture from './EstimateLeadCapture';
import EstimateBookingCTA from './EstimateBookingCTA';
import { PAVER_BRANDS, DECK_BRANDS, ADD_ONS, BIN_COST, estimateBins, defaultPaverForTier, sortPaversForDisplay, type PaverTier } from '../data/carrPrices';
import { ESTIMATOR_LOCATIONS, ZONE_SURCHARGE, type EstimatorLocationKey } from '../data/locations';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
  { id: 'access', label: 'Difficult access (no machine access, wheelbarrow only)' },
  { id: 'slope', label: 'Significant slope or grading needed' },
  { id: 'tearOut', label: 'Tear-out / demolition of existing surface' },
  { id: 'drainage', label: 'Drainage work needed' },
  { id: 'levels', label: 'Multiple levels or tiers' },
];

const TIERS: { id: PaverTier; label: string; sub: string; badge?: string }[] = [
  { id: 'budget',  label: 'Standard',  sub: 'Permacon Melville, Cassara, Vendome. Clean, value-built.' },
  { id: 'mid',     label: 'Elevated',  sub: 'Mondrian Plus, Wilfred, Rosebel. Most popular tier.', badge: 'Most Popular' },
  { id: 'premium', label: 'Premium',   sub: 'Mega Melville, Brooklyn, Metrik. Signature finish.' },
];

const TOTAL_STEPS = 7;

const fmt = (n: number) =>
  n >= 10000 ? `$${(n / 1000).toFixed(0)}k` : `$${n.toLocaleString()}`;

const VALID_PROJECT_TYPES = new Set(['patio', 'stone', 'wall', 'steps', 'deck', 'kitchen', 'firepit', 'pergola', 'turf', 'lighting', 'full']);

export default function Estimator() {
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
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
    access: false, slope: false, tearOut: false, drainage: false, levels: false,
  });
  const [location, setLocation] = useState<EstimatorLocationKey>('barrie');
  const [tier, setTier] = useState<PaverTier>('mid');
  const [paverBrandId, setPaverBrandId] = useState<string>('permacon-mondrian-plus');
  const [deckBrandId, setDeckBrandId] = useState<string>('timbertech-prime');
  const [addOns, setAddOns] = useState<string[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  // Auto-pick a default brand when tier changes
  useEffect(() => {
    const defaultPaver = defaultPaverForTier(tier);
    if (defaultPaver) setPaverBrandId(defaultPaver.id);
  }, [tier]);

  // Hydrate from URL params on mount (HeroEstimator hand-off → jump to step 3 with selections in place)
  useEffect(() => {
    const t = searchParams.get('type');
    const sqftParam = searchParams.get('sqft');
    const cityParam = searchParams.get('city');
    let advanced = false;
    if (t && VALID_PROJECT_TYPES.has(t)) {
      setProjectType(t);
      if (t === 'full') {
        // Pre-fill with the 3 most common picks so size step still has meaning
        setSelectedElements(['patio', 'wall', 'lighting']);
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
    if (advanced) setStep(3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSizeChange = (id: string, value: number | string) => {
    setSizes(prev => ({ ...prev, [id]: value }));
  };
  const toggleCondition = (id: string) => {
    setConditions(prev => ({ ...prev, [id]: !prev[id] }));
  };
  const toggleElement = (id: string) => {
    setSelectedElements(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
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

  /** Core estimate calculation using brand pricing as the anchor. */
  const estimate = useMemo(() => {
    const els = projectType === 'full' ? selectedElements : (projectType ? [projectType] : []);
    if (els.length === 0) {
      return { totalLow: 0, totalHigh: 0, lines: null, addOnsTotal: { low: 0, high: 0 }, days: { low: 0, high: 0 } };
    }

    let coreLow = 0;
    let coreHigh = 0;
    let materialLow = 0;
    let materialHigh = 0;
    let labourLow = 0;
    let labourHigh = 0;
    let totalSqftCalc = 0;
    let daysLow = 0.5;
    let daysHigh = 1;

    for (const el of els) {
      const sz = sizes[el];

      if (el === 'patio' || el === 'stone' || el === 'turf') {
        const sqft = typeof sz === 'number' ? sz : 0;
        totalSqftCalc += sqft;
        let perSqft = selectedPaver.retailPerSqft;
        if (el === 'turf') perSqft = 22;
        if (el === 'stone') perSqft = Math.max(48, selectedPaver.retailPerSqft + 10);
        const lineLow = sqft * perSqft * 0.95;
        const lineHigh = sqft * perSqft * 1.20;
        materialLow += lineLow * 0.45;
        materialHigh += lineHigh * 0.45;
        labourLow += lineLow * 0.40;
        labourHigh += lineHigh * 0.40;
        coreLow += lineLow;
        coreHigh += lineHigh;
        daysLow += sqft / 350;
        daysHigh += sqft / 220;
      } else if (el === 'deck') {
        const sqft = typeof sz === 'number' ? sz : 0;
        totalSqftCalc += sqft;
        const perSqft = selectedDeck.retailPerSqft;
        const lineLow = sqft * perSqft * 0.95;
        const lineHigh = sqft * perSqft * 1.20;
        materialLow += lineLow * 0.55;
        materialHigh += lineHigh * 0.55;
        labourLow += lineLow * 0.35;
        labourHigh += lineHigh * 0.35;
        coreLow += lineLow;
        coreHigh += lineHigh;
        daysLow += sqft / 250;
        daysHigh += sqft / 150;
      } else if (el === 'wall') {
        const lf = typeof sz === 'number' ? sz : 50;
        const hMult = sizes.wallHeight === 'Under 2ft' ? 1
          : sizes.wallHeight === '2-4ft' ? 1.5
          : sizes.wallHeight === '4-6ft' ? 2.2 : 3.2;
        const perLf = tier === 'budget' ? 220 : tier === 'mid' ? 280 : 360;
        const lineLow = lf * perLf * hMult * 0.9;
        const lineHigh = lf * perLf * hMult * 1.15;
        materialLow += lineLow * 0.45;
        materialHigh += lineHigh * 0.45;
        labourLow += lineLow * 0.40;
        labourHigh += lineHigh * 0.40;
        coreLow += lineLow;
        coreHigh += lineHigh;
        daysLow += (lf * hMult) / 50;
        daysHigh += (lf * hMult) / 30;
      } else if (el === 'steps') {
        const count = typeof sz === 'number' ? sz : 5;
        const perStep = tier === 'budget' ? 850 : tier === 'mid' ? 1100 : 1500;
        const lineLow = count * perStep * 0.9;
        const lineHigh = count * perStep * 1.15;
        materialLow += lineLow * 0.5;
        materialHigh += lineHigh * 0.5;
        labourLow += lineLow * 0.4;
        labourHigh += lineHigh * 0.4;
        coreLow += lineLow;
        coreHigh += lineHigh;
        daysLow += count * 0.4;
        daysHigh += count * 0.6;
      } else if (el === 'kitchen') {
        const isFull = sizes.kitchen === 'Full Build';
        const lineLow = tier === 'budget' ? (isFull ? 18000 : 7000) : tier === 'mid' ? (isFull ? 28000 : 10000) : (isFull ? 42000 : 14000);
        const lineHigh = lineLow * 1.4;
        materialLow += lineLow * 0.60;
        materialHigh += lineHigh * 0.60;
        labourLow += lineLow * 0.30;
        labourHigh += lineHigh * 0.30;
        coreLow += lineLow;
        coreHigh += lineHigh;
        daysLow += isFull ? 6 : 3;
        daysHigh += isFull ? 10 : 5;
      } else if (el === 'firepit') {
        const lineLow = tier === 'budget' ? 1500 : tier === 'mid' ? 2500 : 3500;
        const lineHigh = lineLow * 1.5;
        materialLow += lineLow * 0.6;
        materialHigh += lineHigh * 0.6;
        labourLow += lineLow * 0.3;
        labourHigh += lineHigh * 0.3;
        coreLow += lineLow;
        coreHigh += lineHigh;
        daysLow += 1; daysHigh += 2;
      } else if (el === 'pergola') {
        const lineLow = tier === 'budget' ? 4500 : tier === 'mid' ? 7000 : 10000;
        const lineHigh = lineLow * 1.4;
        materialLow += lineLow * 0.55;
        materialHigh += lineHigh * 0.55;
        labourLow += lineLow * 0.35;
        labourHigh += lineHigh * 0.35;
        coreLow += lineLow;
        coreHigh += lineHigh;
        daysLow += 2; daysHigh += 4;
      } else if (el === 'lighting') {
        const lineLow = tier === 'budget' ? 3000 : tier === 'mid' ? 5000 : 7500;
        const lineHigh = lineLow * 1.4;
        materialLow += lineLow * 0.5;
        materialHigh += lineHigh * 0.5;
        labourLow += lineLow * 0.35;
        labourHigh += lineHigh * 0.35;
        coreLow += lineLow;
        coreHigh += lineHigh;
        daysLow += 1; daysHigh += 2;
      }
    }

    // Site condition multipliers / additions
    let conditionMult = 1;
    if (conditions.access) conditionMult += 0.18;
    if (conditions.levels) conditionMult += 0.12;
    let conditionFlatLow = 0;
    let conditionFlatHigh = 0;
    if (conditions.slope)    { conditionFlatLow += 1500; conditionFlatHigh += 4000; daysLow += 0.5; daysHigh += 1.5; }
    if (conditions.tearOut)  { conditionFlatLow += 1200; conditionFlatHigh += 3500; daysLow += 0.5; daysHigh += 1.5; }
    if (conditions.drainage) { conditionFlatLow += 1500; conditionFlatHigh += 3500; daysLow += 0.5; daysHigh += 1; }

    coreLow = coreLow * conditionMult + conditionFlatLow;
    coreHigh = coreHigh * conditionMult + conditionFlatHigh;
    materialLow *= conditionMult;
    materialHigh *= conditionMult;
    labourLow = labourLow * conditionMult + conditionFlatLow * 0.6;
    labourHigh = labourHigh * conditionMult + conditionFlatHigh * 0.6;

    // Excavation = roughly 18% of core for hardscape, lighter for non-hardscape
    const excavationShare = isHardscape || (projectType === 'full' && totalSqftCalc > 0) ? 0.18 : 0.10;
    const excavationLow = Math.max(2500, coreLow * excavationShare);
    const excavationHigh = Math.max(4000, coreHigh * excavationShare);

    // Disposal — only meaningful for hardscape work that excavates
    const bins = totalSqftCalc > 0 ? estimateBins(totalSqftCalc) : 0;
    const disposalLow = bins * BIN_COST;
    const disposalHigh = bins * BIN_COST * 1.15;

    // Restoration — site cleanup, sodding edges, perimeter dressing
    const restorationLow = Math.max(800, totalSqftCalc * 2.5);
    const restorationHigh = Math.max(1500, totalSqftCalc * 4);

    // Zone surcharge for delivery
    const loc = ESTIMATOR_LOCATIONS.find(l => l.key === location) || ESTIMATOR_LOCATIONS[0];
    const surcharge = ZONE_SURCHARGE[loc.zone];

    // Add-ons
    let addOnsLow = 0;
    let addOnsHigh = 0;
    for (const aid of addOns) {
      const a = ADD_ONS.find(x => x.id === aid);
      if (a) { addOnsLow += a.costLow; addOnsHigh += a.costHigh; }
    }
    if (addOns.length > 0) {
      daysLow += addOns.length * 0.5;
      daysHigh += addOns.length * 1;
    }

    // Total = core + zone surcharge + add-ons (excavation/labour/materials/disposal/restoration are slices of core; we'll show breakdown but total is the higher-level sum)
    const totalLow = Math.round((excavationLow + materialLow + labourLow + disposalLow + restorationLow + surcharge + addOnsLow) / 500) * 500;
    const totalHigh = Math.round((excavationHigh + materialHigh + labourHigh + disposalHigh + restorationHigh + surcharge + addOnsHigh) / 500) * 500;

    // Hard floors
    const floor = isDeck ? 25000 : isHardscape || projectType === 'full' ? 20000 : 8000;
    const finalLow = Math.max(floor, totalLow);
    const finalHigh = Math.max(floor + 5000, totalHigh);

    return {
      totalLow: finalLow,
      totalHigh: finalHigh,
      addOnsTotal: { low: addOnsLow, high: addOnsHigh },
      days: { low: Math.ceil(daysLow * 2) / 2, high: Math.ceil(daysHigh * 2) / 2 },
      lines: {
        excavation: {
          low: Math.round(excavationLow / 100) * 100,
          high: Math.round(excavationHigh / 100) * 100,
          detail: totalSqftCalc > 0 ? `12–16" base depth on ${totalSqftCalc} sqft` : 'Site prep + base prep',
        },
        materials: {
          low: Math.round((materialLow + surcharge) / 100) * 100,
          high: Math.round((materialHigh + surcharge) / 100) * 100,
          detail: isDeck
            ? `${selectedDeck.brand} ${selectedDeck.product}`
            : isHardscape || projectType === 'full'
            ? `${selectedPaver.brand} ${selectedPaver.product}${totalSqftCalc > 0 ? ` (${totalSqftCalc} sqft)` : ''}`
            : 'Materials & supplies',
        },
        labour: {
          low: Math.round(labourLow / 100) * 100,
          high: Math.round(labourHigh / 100) * 100,
          detail: `${Math.ceil(daysLow * 2) / 2}–${Math.ceil(daysHigh * 2) / 2} days on-site, ICPI-certified crew`,
        },
        disposal: {
          low: Math.round(disposalLow / 100) * 100,
          high: Math.round(disposalHigh / 100) * 100,
          detail: bins > 0 ? `${bins} × 14-yard bin (clean fill)` : 'Standard waste removal',
        },
        restoration: {
          low: Math.round(restorationLow / 100) * 100,
          high: Math.round(restorationHigh / 100) * 100,
          detail: 'Edge dressing, soil amendments, site clean',
        },
      },
    };
  }, [projectType, selectedElements, sizes, conditions, location, tier, paverBrandId, deckBrandId, addOns, isHardscape, isDeck, selectedPaver, selectedDeck]);

  /** Confidence ±% — drops as more steps are completed. */
  const confidence = useMemo(() => {
    let c = 25;
    if (step >= 4) c -= 5; // location
    if (step >= 5) c -= 3; // brand
    if (step >= 6) c -= 3; // add-ons
    if (photoFile) c -= 2;
    return Math.max(8, c);
  }, [step, photoFile]);

  const onPhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setPhotoFile(f);
  };

  // ---------- step renderers ----------
  const renderSlider = (id: string, label: string, min: number, max: number, format: (v: number) => string) => {
    const v = typeof sizes[id] === 'number' ? (sizes[id] as number) : min;
    return (
      <div className="mb-8">
        <div className="flex justify-between items-end mb-4">
          <span className="font-sans text-[13px] text-brand-bone">{label}</span>
          <span className="font-display text-2xl text-brand-gold">{format(v)}</span>
        </div>
        <input
          type="range" min={min} max={max} value={v}
          onChange={(e) => handleSizeChange(id, Number(e.target.value))}
          className="w-full h-[3px] bg-brand-dark rounded-full appearance-none outline-none accent-brand-gold"
          style={{ background: `linear-gradient(to right, #D4AF63 ${(v - min) / (max - min) * 100}%, #1A1814 ${(v - min) / (max - min) * 100}%)` }}
        />
      </div>
    );
  };
  const renderDropdown = (id: string, label: string, options: string[]) => (
    <div className="mb-8">
      <label className="block font-sans text-[13px] text-brand-bone mb-4">{label}</label>
      <div className="relative">
        <select
          value={sizes[id] as string}
          onChange={(e) => handleSizeChange(id, e.target.value)}
          className="w-full bg-brand-dark border border-brand-gold/20 text-brand-bone font-sans text-[15px] p-4 rounded-2xl appearance-none outline-none focus:border-brand-gold transition-colors"
        >
          {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1.5L6 6.5L11 1.5" stroke="#D4AF63" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  );
  const renderSizeInputs = (type: string) => {
    switch (type) {
      case 'patio':
      case 'stone':
      case 'deck':
      case 'turf':
        return renderSlider(type, 'Approximate Square Footage', 100, 2000, v => `${v} sq ft`);
      case 'wall':
        return (<>
          {renderSlider('wall', 'Wall Length', 10, 200, v => `${v} ln ft`)}
          {renderDropdown('wallHeight', 'Wall Height', ['Under 2ft', '2-4ft', '4-6ft', 'Over 6ft'])}
        </>);
      case 'steps':
        return renderSlider('steps', 'Number of Steps', 2, 20, v => `${v} steps`);
      case 'kitchen':
        return renderDropdown('kitchen', 'Kitchen Scope', ['Basic', 'Full Build']);
      case 'firepit':
      case 'pergola':
      case 'lighting':
        return renderDropdown(type, 'Project Size', ['Small', 'Medium', 'Large']);
      default:
        return null;
    }
  };

  const canAdvance = () => {
    if (step === 1) {
      if (!projectType) return false;
      if (projectType === 'full' && selectedElements.length === 0) return false;
    }
    return true;
  };

  const nextStep = () => { if (canAdvance() && step < TOTAL_STEPS) setStep(s => s + 1); };
  const prevStep = () => setStep(s => Math.max(1, s - 1));

  const selectedLocation = ESTIMATOR_LOCATIONS.find(l => l.key === location) || ESTIMATOR_LOCATIONS[0];
  const showBrandPicker = isHardscape || isDeck || projectType === 'full';

  // Filter brands by tier and use case (driveway vs patio)
  const eligiblePavers = sortPaversForDisplay(
    PAVER_BRANDS.filter(p => p.tier === tier && (p.useCase === 'patio' || p.useCase === 'patio-driveway' || p.useCase === 'driveway'))
  );
  const eligibleDecks = DECK_BRANDS.filter(d => tier === 'premium' ? true : d.id === 'timbertech-prime');

  return (
    <div className="w-full max-w-[920px] mx-auto px-4 py-16 md:py-24" id="estimator">
      <div className="text-center mb-14">
        <div className="font-sans text-[11px] tracking-[0.3em] uppercase text-brand-gold mb-5">
          Estimate Your Project
        </div>
        <h2 className="font-display text-5xl md:text-7xl leading-[1.05] mb-6 text-brand-bone tracking-tight">
          What will yours <span className="italic text-brand-gold">cost?</span>
        </h2>
        <p className="font-sans font-light text-[17px] text-brand-muted max-w-xl mx-auto leading-[1.6]">
          Real numbers, real materials, real Simcoe County pricing. No signup to see your range.
        </p>
      </div>

      <div className="relative bg-gradient-to-b from-white/[0.10] to-white/[0.03] backdrop-blur-2xl border border-white/25 rounded-3xl p-7 md:p-14 overflow-hidden shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)]">
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-white/5 rounded-t-3xl overflow-hidden">
          <motion.div className="h-full bg-gradient-to-r from-brand-gold/80 via-brand-gold to-brand-gold/80"
            initial={{ width: '14%' }}
            animate={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            transition={{ type: 'spring', stiffness: 90, damping: 20 }}
          />
        </div>
        <div className="flex justify-between items-center mb-12 mt-5">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map(i => (
            <motion.div
              key={i}
              animate={{ scale: step === i ? 1.4 : 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-colors duration-300",
                step === i ? "bg-brand-gold shadow-[0_0_12px_rgba(212,175,99,0.6)]" : step > i ? "bg-brand-gold/60" : "bg-white/30"
              )}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <h3 className="font-display text-3xl text-brand-bone mb-8">What are you looking to build?</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PROJECT_TYPES.map(pt => {
                  const Icon = pt.icon;
                  const isSelected = projectType === pt.id;
                  return (
                    <div
                      key={pt.id}
                      onClick={() => {
                        setProjectType(pt.id);
                        if (pt.id !== 'full') setSelectedElements([]);
                      }}
                      className={cn(
                        "group flex items-center gap-4 p-6 rounded-2xl border transition-all duration-200 cursor-pointer",
                        isSelected ? "bg-gradient-to-b from-brand-gold/30 to-brand-gold/10 border-brand-gold shadow-[0_0_0_1px_rgba(212,175,99,0.4)]" : "bg-white/[0.08] border-white/20 hover:border-white/35 hover:bg-white/[0.12] hover:-translate-y-[2px] hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]"
                      )}
                    >
                      <div className="text-brand-gold"><Icon size={24} strokeWidth={1.5} /></div>
                      <div>
                        <div className="font-sans text-[13px] uppercase text-brand-bone tracking-wide mb-1">{pt.label}</div>
                        <div className="font-sans text-[12px] font-normal text-brand-bonewhite/80">{pt.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <h3 className="font-display text-3xl text-brand-bone mb-8">Let's talk size and scope.</h3>
              {projectType === 'full' ? (
                <div className="space-y-8">
                  <p className="font-sans text-[13px] text-brand-muted mb-6">Select all the elements you want to include in your backyard transformation:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    {PROJECT_TYPES.filter(pt => pt.id !== 'full').map(pt => (
                      <div
                        key={pt.id}
                        onClick={() => toggleElement(pt.id)}
                        className={cn(
                          "flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200 cursor-pointer",
                          selectedElements.includes(pt.id) ? "bg-gradient-to-b from-brand-gold/30 to-brand-gold/10 border-brand-gold shadow-[0_0_0_1px_rgba(212,175,99,0.4)]" : "bg-white/[0.08] border-white/20 hover:border-white/35 hover:bg-white/[0.12]"
                        )}
                      >
                        <div className={cn(
                          "w-5 h-5 rounded-md border flex items-center justify-center transition-colors",
                          selectedElements.includes(pt.id) ? "bg-brand-gold border-brand-gold" : "border-brand-gold/60"
                        )}>
                          {selectedElements.includes(pt.id) && <Check size={14} className="text-brand-black" />}
                        </div>
                        <span className="font-sans text-[13px] text-brand-bone">{pt.label}</span>
                      </div>
                    ))}
                  </div>
                  {selectedElements.length > 0 && (
                    <div className="pt-8 border-t border-brand-gold/10 space-y-12">
                      <h4 className="font-display text-2xl text-brand-bone">Configure Sizes</h4>
                      {selectedElements.map(el => (
                        <div key={el} className="bg-white/[0.03] p-6 rounded-2xl border border-white/8">
                          <h5 className="font-sans text-[10px] uppercase tracking-[0.2em] text-brand-gold mb-6">
                            {PROJECT_TYPES.find(p => p.id === el)?.label}
                          </h5>
                          {renderSizeInputs(el)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="max-w-xl">{renderSizeInputs(projectType!)}</div>
              )}
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <h3 className="font-display text-3xl text-brand-bone mb-8">Any special site conditions?</h3>
              <p className="font-sans text-[13px] text-brand-muted mb-8">Select any that apply. These affect labour time, equipment, and final pricing.</p>
              <div className="space-y-4">
                {CONDITIONS.map(cond => (
                  <div
                    key={cond.id}
                    onClick={() => toggleCondition(cond.id)}
                    className={cn(
                      "flex items-center gap-4 p-5 rounded-2xl border transition-all duration-200 cursor-pointer",
                      conditions[cond.id] ? "bg-gradient-to-b from-brand-gold/30 to-brand-gold/10 border-brand-gold shadow-[0_0_0_1px_rgba(212,175,99,0.4)]" : "bg-white/[0.08] border-white/20 hover:border-white/35 hover:bg-white/[0.12]"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded-md border flex items-center justify-center transition-colors",
                      conditions[cond.id] ? "bg-brand-gold border-brand-gold" : "border-brand-gold/60"
                    )}>
                      {conditions[cond.id] && <Check size={14} className="text-brand-black" />}
                    </div>
                    <span className="font-sans text-[13px] text-brand-bone">{cond.label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <div className="flex items-center gap-3 mb-8">
                <MapPin size={22} className="text-brand-gold" strokeWidth={1.5} />
                <h3 className="font-display text-3xl text-brand-bone">Where's the project?</h3>
              </div>
              <p className="font-sans text-[13px] text-brand-muted mb-8">
                We localize your estimate by delivery zone and crew travel. {selectedLocation.projects2025 > 0 ? `We've completed ${selectedLocation.projects2025} projects in ${selectedLocation.name} in 2025.` : ''}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {ESTIMATOR_LOCATIONS.map(loc => (
                  <button
                    key={loc.key}
                    type="button"
                    onClick={() => setLocation(loc.key)}
                    className={cn(
                      "px-5 py-4 rounded-2xl border text-left transition-all duration-200",
                      location === loc.key ? "bg-gradient-to-b from-brand-gold/30 to-brand-gold/10 border-brand-gold shadow-[0_0_0_1px_rgba(212,175,99,0.4)]" : "bg-white/[0.08] border-white/20 hover:border-white/35 hover:bg-white/[0.12]"
                    )}
                  >
                    <div className="font-sans text-[13px] text-brand-bone">{loc.name}</div>
                    {loc.projects2025 > 0 ? (
                      <div className="font-sans text-[10px] text-brand-muted mt-1">{loc.projects2025} projects · 2025</div>
                    ) : (
                      <div className="font-sans text-[10px] text-brand-muted mt-1">Outside core area</div>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div key="step5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <h3 className="font-display text-3xl text-brand-bone mb-3">Material preference</h3>
              <p className="font-sans text-[13px] text-brand-muted mb-8">Pick a tier first, then a specific brand. Real Carr Landscape Depot pricing.</p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
                {TIERS.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTier(t.id)}
                    className={cn(
                      "relative p-4 rounded-2xl border text-left transition-all duration-200",
                      tier === t.id ? "bg-gradient-to-b from-brand-gold/30 to-brand-gold/10 border-brand-gold shadow-[0_0_0_1px_rgba(212,175,99,0.4)]" : "bg-white/[0.08] border-white/20 hover:border-white/35 hover:bg-white/[0.12]"
                    )}
                  >
                    {t.badge && (
                      <div className="absolute -top-2 left-3 bg-brand-gold text-brand-black font-sans text-[8px] uppercase tracking-widest px-2 py-0.5 rounded-2xl font-medium">
                        {t.badge}
                      </div>
                    )}
                    <div className="font-display text-lg text-brand-bone mb-1">{t.label}</div>
                    <div className="font-sans text-[11px] font-normal text-brand-bonewhite/80 leading-snug">{t.sub}</div>
                  </button>
                ))}
              </div>

              {showBrandPicker && (isHardscape || (projectType === 'full' && !selectedElements.every(e => e === 'deck'))) && eligiblePavers.length > 0 && (
                <div className="mb-8">
                  <div className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-gold mb-4">Hardscape Brand</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {eligiblePavers.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPaverBrandId(p.id)}
                        className={cn(
                          "relative p-4 rounded-2xl border text-left transition-all duration-200",
                          paverBrandId === p.id ? "bg-gradient-to-b from-brand-gold/30 to-brand-gold/10 border-brand-gold shadow-[0_0_0_1px_rgba(212,175,99,0.4)]" : "bg-white/[0.08] border-white/20 hover:border-white/35 hover:bg-white/[0.12]"
                        )}
                      >
                        {p.recommended && (
                          <div className="absolute -top-2.5 left-4 bg-brand-gold text-brand-black font-sans text-[9px] uppercase tracking-widest px-2.5 py-0.5 rounded-full font-medium shadow-[0_4px_12px_rgba(212,175,99,0.4)]">
                            Recommended
                          </div>
                        )}
                        <div className="flex items-baseline justify-between gap-2 mb-1 mt-1">
                          <span className="font-sans text-[10px] uppercase tracking-wider text-brand-gold">{p.brand}</span>
                          <span className="font-display text-[13px] text-brand-bone">${p.retailPerSqft}/sqft</span>
                        </div>
                        <div className="font-sans text-[13px] text-brand-bone mb-1">{p.product}</div>
                        <div className="font-sans text-[11px] font-normal text-brand-bonewhite/80">{p.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(isDeck || (projectType === 'full' && selectedElements.includes('deck'))) && eligibleDecks.length > 0 && (
                <div className="mb-2">
                  <div className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-gold mb-4">Decking Brand</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {eligibleDecks.map(d => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setDeckBrandId(d.id)}
                        className={cn(
                          "p-4 rounded-2xl border text-left transition-all duration-200",
                          deckBrandId === d.id ? "bg-gradient-to-b from-brand-gold/30 to-brand-gold/10 border-brand-gold shadow-[0_0_0_1px_rgba(212,175,99,0.4)]" : "bg-white/[0.08] border-white/20 hover:border-white/35 hover:bg-white/[0.12]"
                        )}
                      >
                        <div className="flex items-baseline justify-between gap-2 mb-1">
                          <span className="font-sans text-[10px] uppercase tracking-wider text-brand-gold">{d.brand}</span>
                          <span className="font-display text-[13px] text-brand-bone">${d.retailPerSqft}/sqft</span>
                        </div>
                        <div className="font-sans text-[13px] text-brand-bone mb-1">{d.product}</div>
                        <div className="font-sans text-[11px] font-normal text-brand-bonewhite/80">{d.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {step === 6 && (
            <motion.div key="step6" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <h3 className="font-display text-3xl text-brand-bone mb-3">Add-ons & extras</h3>
              <p className="font-sans text-[13px] text-brand-muted mb-8">Optional. Each item adds a real line to your estimate.</p>

              <div className="space-y-3 mb-10">
                {ADD_ONS.map(a => (
                  <div
                    key={a.id}
                    onClick={() => toggleAddOn(a.id)}
                    className={cn(
                      "flex items-start gap-4 p-5 rounded-2xl border transition-all duration-200 cursor-pointer",
                      addOns.includes(a.id) ? "bg-gradient-to-b from-brand-gold/30 to-brand-gold/10 border-brand-gold shadow-[0_0_0_1px_rgba(212,175,99,0.4)]" : "bg-white/[0.08] border-white/20 hover:border-white/35 hover:bg-white/[0.12]"
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
                        <span className="font-display text-[13px] text-brand-gold whitespace-nowrap">+{fmt(a.costLow)}–{fmt(a.costHigh)}</span>
                      </div>
                      <div className="font-sans text-[11px] font-normal text-brand-bonewhite/80 leading-relaxed">{a.description}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Photo upload */}
              <div className="border-t border-brand-gold/10 pt-8">
                <div className="flex items-center gap-2 mb-3">
                  <ImageIcon size={16} className="text-brand-gold" strokeWidth={1.5} />
                  <span className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-gold">Tighten Your Estimate</span>
                </div>
                <h4 className="font-display text-xl text-brand-bone mb-2">Upload yard photos (optional)</h4>
                <p className="font-sans text-[12px] font-normal text-brand-bonewhite/80 mb-5 leading-relaxed">
                  One photo of the project area helps us account for grade, access, and existing surfaces — drops your confidence range another 2%.
                </p>
                {photoFile ? (
                  <div className="bg-white/[0.05] border border-brand-gold/30 rounded-2xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <ImageIcon size={18} className="text-brand-gold shrink-0" strokeWidth={1.5} />
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
                  <label className="block bg-white/[0.03] border border-dashed border-white/15 rounded-2xl p-6 hover:bg-white/[0.05] text-center cursor-pointer hover:border-brand-gold/60 transition-colors">
                    <input type="file" accept="image/*" onChange={onPhotoChange} className="hidden" />
                    <Upload size={20} className="text-brand-gold mx-auto mb-2" strokeWidth={1.5} />
                    <div className="font-sans text-[13px] text-brand-bone">Drop a photo or click to upload</div>
                    <div className="font-sans text-[11px] font-normal text-brand-bonewhite/80 mt-1">JPG, PNG, HEIC · up to 10 MB</div>
                  </label>
                )}
              </div>
            </motion.div>
          )}

          {step === 7 && estimate.lines && (
            <motion.div key="step7" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
              <EstimateBreakdown
                excavation={estimate.lines.excavation}
                materials={estimate.lines.materials}
                labour={estimate.lines.labour}
                disposal={estimate.lines.disposal}
                restoration={estimate.lines.restoration}
                totalLow={estimate.totalLow}
                totalHigh={estimate.totalHigh}
                confidencePercent={confidence}
                brandName={isDeck ? `${selectedDeck.brand} ${selectedDeck.product}` : `${selectedPaver.brand} ${selectedPaver.product}`}
                sqft={totalSqft}
                city={selectedLocation.name}
              />

              {addOns.length > 0 && (
                <div className="mt-8 bg-gradient-to-b from-white/[0.05] to-white/[0.01] backdrop-blur-xl border border-white/10 rounded-3xl p-6">
                  <div className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-gold mb-4">Selected Add-ons</div>
                  <div className="divide-y divide-brand-gold/10">
                    {addOns.map(aid => {
                      const a = ADD_ONS.find(x => x.id === aid);
                      if (!a) return null;
                      return (
                        <div key={aid} className="py-3 flex items-baseline justify-between gap-3">
                          <span className="font-sans text-[13px] text-brand-bone">{a.label}</span>
                          <span className="font-display text-[14px] text-brand-gold whitespace-nowrap">+{fmt(a.costLow)} – {fmt(a.costHigh)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-10 grid lg:grid-cols-2 gap-6">
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
                }} />
                <div className="bg-gradient-to-b from-white/[0.05] to-white/[0.01] backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 flex flex-col justify-center">
                  <div className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-gold mb-3">Project Timeline</div>
                  <div className="font-display text-3xl text-brand-bone mb-2">
                    {estimate.days.low}–{estimate.days.high} days on-site
                  </div>
                  <div className="font-sans text-[12px] font-normal text-brand-bonewhite/80 leading-relaxed mb-6">
                    Project start typically 4–8 weeks from contract signing during peak season (May–Oct).
                  </div>
                  <div className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-gold mb-3">Confidence</div>
                  <div className="font-display text-3xl text-brand-bone mb-2">±{confidence}%</div>
                  <div className="font-sans text-[12px] font-normal text-brand-bonewhite/80 leading-relaxed">
                    Range tightens with site visit. We'll lock to ±5% after measurement.
                  </div>
                </div>
              </div>

              <div className="mt-12">
                <EstimateBookingCTA />
              </div>

              <div className="mt-12 text-center">
                <button onClick={() => setStep(1)} className="btn-ghost text-[9px] py-3 px-6">Start Over</button>
              </div>

              <p className="mt-8 font-sans text-xs font-normal text-brand-bonewhite/80 text-center max-w-3xl mx-auto leading-[1.6]">
                Estimates use 2026 Carr Landscape Depot pricing for Simcoe County. <span className="text-brand-gold font-normal">{isDeck ? "Decking projects require a $25,000 minimum." : "Hardscape projects require a $20,000 minimum."}</span> Final pricing depends on site measurement, material availability, and design complexity.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {step < TOTAL_STEPS && (
          <div className="mt-14 pt-8 border-t border-white/10 flex justify-between items-center gap-4">
            {step > 1 ? (
              <button onClick={prevStep} className="btn-ghost !rounded-full !border-white/15 hover:!border-white/30">← Back</button>
            ) : <div />}
            <button
              onClick={nextStep}
              className={cn(
                "btn-primary !rounded-full px-10 shadow-[0_8px_24px_-8px_rgba(212,175,99,0.4)] hover:shadow-[0_12px_32px_-8px_rgba(212,175,99,0.55)] transition-shadow",
                !canAdvance() ? "opacity-40 cursor-not-allowed" : ""
              )}
              disabled={!canAdvance()}
            >
              {step === 6 ? 'See Estimate →' : 'Continue →'}
            </button>
          </div>
        )}
      </div>

      {/* Mobile sticky bar showing running estimate */}
      {step >= 2 && step < TOTAL_STEPS && estimate.totalLow > 0 && (
        <MobileStickyBar
          low={estimate.totalLow}
          high={estimate.totalHigh}
          onContinue={() => setStep(7)}
        />
      )}
    </div>
  );
}

function MobileStickyBar({ low, high, onContinue }: { low: number; high: number; onContinue: () => void }) {
  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-brand-black border-t border-brand-gold/30 px-4 py-3 flex items-center justify-between gap-3 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]"
    >
      <div className="min-w-0">
        <div className="font-sans text-[9px] uppercase tracking-[0.25em] text-brand-gold">Running Estimate</div>
        <div className="font-display text-lg text-brand-bone truncate">
          ${(low / 1000).toFixed(0)}k – ${(high / 1000).toFixed(0)}k
        </div>
      </div>
      <button
        onClick={onContinue}
        className="bg-brand-gold text-brand-black font-sans text-[11px] uppercase tracking-wider px-4 py-3 rounded-2xl font-medium shrink-0"
      >
        See Full Breakdown →
      </button>
    </motion.div>
  );
}
