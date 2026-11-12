import { useEffect, useMemo, useRef, useState, type ComponentType, type MouseEvent } from 'react';
import { Shield, CheckCircle, Compass, Clock } from 'lucide-react';
import SEO from '../components/SEO';
import HeroDepth from '../components/HeroDepth';
import Reveal from '../components/Reveal';
import { HOME_FAQS } from '../data/homeFaqs';
import type { BlockId } from '../components/home/composition';
import { recordHomeAction, recordHomeView, releaseHomeArm, useHomeArm } from '../components/home/homeArm';
import { BLOCKS } from '../components/home/registry';
import { HomeIntentProvider } from '../components/home/HomeIntentContext';
import IntentDebug from '../components/home/IntentDebug';
import { preferredCity, releaseHomeSegment, useHomeSegment } from '../components/home/intentStore';

/** Pages that count as a first step toward an enquiry when opened from the homepage. */
const ACTION_PATH = /^\/(contact|cost-estimator|deck-designer|book)(\/|$)/;

/** A phone link, or a link to one of those pages on this site, however the href is written (relative or a full URL). */
function isActionHref(href: string): boolean {
  if (href.startsWith('tel:')) return true;
  try {
    const url = new URL(href, window.location.href);
    return url.origin === window.location.origin && ACTION_PATH.test(url.pathname);
  } catch {
    return false;
  }
}

/* This block stays in this file on purpose. Its copy quotes two dollar figures
   that the owner approved in the price ledger (scripts/check-price-ledger.ts)
   against src/pages/Home.tsx; moving the text would need a fresh owner approval. */
const ContractorPainPoints = () => {
  const points = [
    {
      pain: "Your Patio is Sinking After One Winter",
      cause: "They dug 6 inches, threw down some gravel, and called it a base. Now your stones are uneven and you're back to square one.",
      solution: "We review drainage, soil, access, and the project-specific excavation/base plan before finalizing a written scope.",
      icon: Compass
    },
    {
      pain: "They Took Your Deposit and Disappeared",
      cause: "They were responsive before you paid. Now it's been three weeks with no updates, no timeline, and no one answering the phone.",
      solution: "Yorkis Estevez is the founder and lead builder. You talk to the person responsible for the job, and the written scope is what the crew builds.",
      icon: Clock
    },
    {
      pain: "The 'Final' Price Kept Climbing",
      cause: "What started as a $15K quote turned into $22K after 'unforeseen' extras. Sound familiar?",
      solution: "The written quote is the price for the written scope. If the work changes, we write the change and you approve it before the price moves.",
      icon: Shield
    },
    {
      pain: "Your Property Looked Like a Construction Zone",
      cause: "Materials dumped on the lawn, equipment blocking the driveway, debris everywhere for weeks.",
      solution: "The written scope says how the work area is protected and how the property is left when the job is done.",
      icon: CheckCircle
    }
  ];

  return (
    <section className="section-padding bg-brand-nearblack">
      <div className="container-custom">
        <Reveal className="max-w-4xl mx-auto text-center mb-12 md:mb-24">
          <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-6 block">
            Sound Familiar?
          </span>
          <h2 className="font-display text-4xl md:text-7xl font-light text-brand-bonewhite leading-tight mb-10">
            You've been burned <br />
            <span className="text-brand-gold-dark italic">by a contractor before.</span>
          </h2>
          <p className="font-sans text-lg text-brand-muted leading-relaxed font-light">
            Compare more than the headline price. Ask each contractor to explain site preparation, drainage, written scope, payment stages and how changes will be approved.
          </p>
        </Reveal>

        <div className="no-scrollbar -mx-8 flex snap-x snap-mandatory gap-5 overflow-x-auto px-8 pb-2 md:mx-0 md:grid md:grid-cols-2 md:gap-12 md:overflow-visible md:px-0 md:pb-0">
          {points.map((point, idx) => (
            <div key={idx} className="w-[86vw] shrink-0 snap-start bg-brand-surface p-7 md:w-auto md:shrink md:p-12 rounded-2xl border border-brand-dim/10">
              <div className="flex items-start gap-5 md:gap-8">
                <div className="w-14 h-14 bg-brand-midsurface flex items-center justify-center rounded-2xl shrink-0 shadow-sm border border-brand-dim/10">
                  <point.icon className="text-brand-gold-dark" size={24} strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="font-display text-2xl font-light text-brand-bonewhite mb-6">{point.pain}</h3>
                  <div className="space-y-6">
                    <div className="flex gap-4">
                      <span className="font-sans text-[10px] font-normal uppercase tracking-widest text-brand-error shrink-0 mt-1">Typical:</span>
                      <p className="font-sans text-sm text-brand-muted italic font-light">{point.cause}</p>
                    </div>
                    <div className="flex gap-4">
                      <span className="font-sans text-[10px] font-normal uppercase tracking-widest text-brand-gold-dark shrink-0 mt-1">Our Way:</span>
                      <p className="font-sans text-sm text-brand-bonewhite font-normal">{point.solution}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const HOME_BLOCKS: Record<BlockId, ComponentType> = { ...BLOCKS, 'pain-points': ContractorPainPoints };

export default function Home() {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: HOME_FAQS.map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: { '@type': 'Answer', text: faq.a },
    })),
  };
  const segment = useHomeSegment();
  // Read after mount: storage does not exist while prerendering, and the first client render must match it.
  const [city, setCity] = useState<string | null>(null);
  useEffect(() => {
    setCity(preferredCity());
    // The store's own value, not this render's: the first render after hydration still holds the prerendered default.
    recordHomeView();
    return () => {
      releaseHomeArm();
      releaseHomeSegment();
    };
  }, []);
  const intent = useMemo(() => ({ segment, city }), [segment, city]);
  const { blocks } = useHomeArm();

  // One "act" per view: the first click on a link or button that leads toward an enquiry.
  const acted = useRef(false);
  const onClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (acted.current) return;
    const target = (event.target as HTMLElement).closest('a[href], [data-home-action]');
    if (!target) return;
    if (!target.hasAttribute('data-home-action') && !isActionHref(target.getAttribute('href') ?? '')) return;
    acted.current = true;
    recordHomeAction();
  };

  return (
    <HomeIntentProvider value={intent}>
      <SEO
        title="Barrie Landscaping | Patios, Walls & Decks"
        description="Patios, retaining walls and composite decks in Barrie and Simcoe County. Landscape maintenance for homes and commercial properties starts in 2027."
        canonical="https://goldenmaplelandscaping.ca/"
        schema={faqSchema}
      />
      <div onClickCapture={onClickCapture}>
      <HeroDepth segment={segment} />
      {blocks.map((id) => {
        const Block = HOME_BLOCKS[id];
        return (
          <div key={id} data-home-block={id}>
            <Block />
          </div>
        );
      })}
      </div>
      <IntentDebug segment={segment} />
    </HomeIntentProvider>
  );
}
