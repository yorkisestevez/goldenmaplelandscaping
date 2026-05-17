import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Grid, Layout, AlignJustify, ListTree, ChefHat, Map, ArrowRight, MapPin, Ruler } from 'lucide-react';
import { trackEngagement } from '../utils/analytics';
import { ESTIMATOR_LOCATIONS } from '../data/locations';

const PROJECT_OPTIONS = [
  { id: 'patio',   label: 'Patio',         icon: Grid },
  { id: 'deck',    label: 'Deck',          icon: Layout },
  { id: 'wall',    label: 'Wall',          icon: AlignJustify },
  { id: 'steps',   label: 'Steps',         icon: ListTree },
  { id: 'kitchen', label: 'Kitchen',       icon: ChefHat },
  { id: 'full',    label: 'Full Backyard', icon: Map },
] as const;

const SIZE_BUCKETS = [
  { id: 'small',  label: 'Small',  hint: 'Under 400 sqft',  sqft: 300 },
  { id: 'medium', label: 'Medium', hint: '400–800 sqft',    sqft: 600 },
  { id: 'large',  label: 'Large',  hint: '800+ sqft',       sqft: 1000 },
] as const;

export default function HeroEstimator() {
  const navigate = useNavigate();
  const [projectType, setProjectType] = useState<string | null>(null);
  const [sizeBucket, setSizeBucket] = useState<string | null>(null);
  const [city, setCity] = useState<string>('barrie');

  const ready = projectType && sizeBucket;
  const sqft = SIZE_BUCKETS.find(s => s.id === sizeBucket)?.sqft ?? 600;

  const onContinue = () => {
    if (!ready) return;
    trackEngagement('cta_click', `hero_estimator_${projectType}_${sizeBucket}_${city}`);
    const params = new URLSearchParams({
      type: projectType!,
      sqft: String(sqft),
      city,
    });
    navigate(`/cost-estimator?${params.toString()}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="bg-gradient-to-b from-white/[0.14] to-white/[0.04] backdrop-blur-2xl border border-white/30 rounded-3xl p-7 md:p-9 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)]"
    >
      <div className="font-sans text-[10px] uppercase tracking-[0.3em] text-brand-gold mb-3">
        Free Cost Estimator · 60 Seconds
      </div>
      <h2 className="font-display text-3xl md:text-[34px] font-light text-brand-bonewhite leading-tight mb-2">
        See your <span className="italic text-brand-gold">project range</span>
      </h2>
      <p className="font-sans text-[13px] text-brand-bonewhite/85 font-normal mb-7 leading-relaxed">
        Three quick taps. Real Simcoe County pricing using actual Permacon paver and TimberTech decking costs. No signup to view.
      </p>

      {/* Step 1 — Project type */}
      <div className="mb-5">
        <div className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-gold mb-3">
          1 · What are you building?
        </div>
        <div className="grid grid-cols-3 gap-2">
          {PROJECT_OPTIONS.map(opt => {
            const Icon = opt.icon;
            const selected = projectType === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setProjectType(opt.id)}
                className={`p-3 rounded-2xl border transition-all duration-150 flex flex-col items-center gap-1.5 ${
                  selected
                    ? 'bg-gradient-to-b from-brand-gold/35 to-brand-gold/10 border-brand-gold text-brand-bonewhite shadow-[0_0_0_1px_rgba(212,175,99,0.45)]'
                    : 'bg-white/[0.08] border-white/25 text-brand-bonewhite/80 hover:border-white/45 hover:bg-white/[0.14] hover:text-brand-bonewhite'
                }`}
              >
                <Icon size={18} strokeWidth={1.5} className={selected ? 'text-brand-gold' : ''} />
                <span className="font-sans text-[11px] tracking-wide">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2 — Size */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Ruler size={11} className="text-brand-gold" strokeWidth={2} />
          <span className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-gold">
            2 · How big?
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {SIZE_BUCKETS.map(s => {
            const selected = sizeBucket === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSizeBucket(s.id)}
                className={`p-3 rounded-2xl border transition-all duration-150 ${
                  selected
                    ? 'bg-gradient-to-b from-brand-gold/35 to-brand-gold/10 border-brand-gold shadow-[0_0_0_1px_rgba(212,175,99,0.45)]'
                    : 'bg-white/[0.08] border-white/25 hover:border-white/45 hover:bg-white/[0.14]'
                }`}
              >
                <div className={`font-sans text-[12px] uppercase tracking-wider ${selected ? 'text-brand-bonewhite' : 'text-brand-bonewhite/85'}`}>
                  {s.label}
                </div>
                <div className={`font-sans text-[10px] mt-0.5 ${selected ? 'text-brand-gold' : 'text-brand-bonewhite/65'}`}>
                  {s.hint}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 3 — City */}
      <div className="mb-7">
        <div className="flex items-center gap-2 mb-3">
          <MapPin size={11} className="text-brand-gold" strokeWidth={2} />
          <span className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-gold">
            3 · Where?
          </span>
        </div>
        <div className="relative">
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full bg-brand-surface/50 border border-brand-dim/30 hover:border-brand-gold/50 focus:border-brand-gold text-brand-bonewhite font-sans text-[13px] py-3 px-4 pr-10 rounded-2xl appearance-none outline-none transition-colors cursor-pointer"
          >
            {ESTIMATOR_LOCATIONS.map(loc => (
              <option key={loc.key} value={loc.key}>{loc.name}</option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg width="10" height="6" viewBox="0 0 12 8" fill="none">
              <path d="M1 1.5L6 6.5L11 1.5" stroke="#D4AF63" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onContinue}
        disabled={!ready}
        className="btn-primary !rounded-full w-full py-4 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3 group shadow-[0_8px_24px_-8px_rgba(212,175,99,0.4)] hover:shadow-[0_12px_32px_-8px_rgba(212,175,99,0.55)] transition-shadow"
      >
        {ready ? 'See My Estimate Range' : 'Pick a project & size to continue'}
        {ready && <ArrowRight size={16} strokeWidth={1.5} className="transition-transform group-hover:translate-x-1" />}
      </button>

      <p className="font-sans text-[11px] text-brand-bonewhite/75 mt-4 text-center font-normal">
        Itemized breakdown · Material brand picker · Real numbers in 60 seconds
      </p>
    </motion.div>
  );
}
