import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { trackEngagement } from '../../../utils/analytics';
import { ESTIMATOR_LOCATIONS } from '../../../data/locations';
import { estimatorDeckHref } from '../../../features/deckcraft/estimatorHandoff';

/** Ids match the estimator's `?type=` values. */
const PROJECT_TYPES = [
  { id: 'patio', label: 'Patio' },
  { id: 'deck', label: 'Deck' },
  { id: 'wall', label: 'Retaining wall' },
  { id: 'steps', label: 'Steps' },
  { id: 'kitchen', label: 'Outdoor kitchen' },
  { id: 'full', label: 'Full backyard' },
] as const;

const SIZES = [
  { id: 'small', label: 'Under 400 sq ft', sqft: 300 },
  { id: 'medium', label: '400 to 800 sq ft', sqft: 600 },
  { id: 'large', label: '800+ sq ft', sqft: 1000 },
] as const;

type ProjectTypeId = (typeof PROJECT_TYPES)[number]['id'];
type SizeId = (typeof SIZES)[number]['id'];

/* The labels are screen-reader only, but the contrast audit still measures them, so they carry the light text colour. */
const LABEL_CLASS = 'sr-only text-brand-porcelain';

const SELECT_CLASS =
  'w-full appearance-none rounded-2xl border border-transparent bg-brand-surface py-3.5 pl-4 pr-10 font-sans text-sm text-brand-ink outline-none focus-visible:ring-2 focus-visible:ring-brand-gold';

/**
 * Three choices that open the cost estimator already filled in. The estimator
 * does the pricing; this block only hands over type, size and town.
 */
export default function InstantEstimate() {
  const navigate = useNavigate();
  const [projectType, setProjectType] = useState<ProjectTypeId>('patio');
  const [size, setSize] = useState<SizeId>('medium');
  const [city, setCity] = useState<string>(ESTIMATOR_LOCATIONS[0].key);

  const open = () => {
    const sqft = SIZES.find((s) => s.id === size)?.sqft ?? SIZES[1].sqft;
    trackEngagement('cta_click', `home_estimate_${projectType}_${size}_${city}`);
    // Decks are priced only by the deck designer, which opens inside the estimator.
    if (projectType === 'deck') {
      navigate(estimatorDeckHref(sqft));
      return;
    }
    navigate(`/cost-estimator?${new URLSearchParams({ type: projectType, sqft: String(sqft), city }).toString()}`);
  };

  return (
    <section className="bg-brand-nearblack pb-14 md:pb-24">
      <div className="container-custom">
        <div className="grid gap-4 rounded-[28px] bg-brand-burgundy p-7 md:p-9 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto] lg:items-center lg:gap-5">
          <h2 className="!mb-0 font-display text-3xl font-normal text-brand-porcelain">What will yours cost?</h2>
          <label className="relative block">
            <span className={LABEL_CLASS}>Project type</span>
            <select value={projectType} onChange={(e) => setProjectType(e.target.value as ProjectTypeId)} className={SELECT_CLASS}>
              {PROJECT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-brand-muted" />
          </label>
          <label className="relative block">
            <span className={LABEL_CLASS}>Size</span>
            <select value={size} onChange={(e) => setSize(e.target.value as SizeId)} className={SELECT_CLASS}>
              {SIZES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-brand-muted" />
          </label>
          <label className="relative block">
            <span className={LABEL_CLASS}>Town</span>
            <select value={city} onChange={(e) => setCity(e.target.value)} className={SELECT_CLASS}>
              {ESTIMATOR_LOCATIONS.map((loc) => <option key={loc.key} value={loc.key}>{loc.name}</option>)}
            </select>
            <ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-brand-muted" />
          </label>
          <button
            type="button"
            onClick={open}
            className="inline-flex items-center justify-center gap-3 rounded-full bg-brand-gold px-7 py-4 font-sans text-sm font-semibold text-brand-black transition-colors hover:bg-brand-gold-light"
          >
            See my range <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
