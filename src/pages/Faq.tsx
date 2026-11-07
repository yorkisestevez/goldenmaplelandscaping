import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { BookingWindow, LastUpdatedLine, pageUpdateNode } from '../components/PageFreshness';
import { BUSINESS, publicAddressLine, publicContact } from '../data/business';
import { HOME_FAQS } from '../data/homeFaqs';
import { BOOKING_WINDOW, PAGE_UPDATES } from '../data/pageUpdates';
import { breadcrumb, faqPage, graph } from '../utils/schema';

const PATH = '/faq/';
const NAME = BUSINESS.publicName.value;
const FOUNDER = BUSINESS.founder.value;

/**
 * Identity answers, in plain sentences, from src/data/business.ts, the About page
 * and llms.txt only. No credential, rating, warranty or price claims here.
 */
const IDENTITY_FAQS = [
  {
    q: `Who is ${NAME}?`,
    a: `${NAME} is a residential landscape construction company in Barrie, Ontario, at ${publicAddressLine()}. It was founded by ${FOUNDER.name}, its ${FOUNDER.role}, and builds for homeowners in Barrie and nearby Simcoe County towns. You can reach it at ${publicContact.phoneDisplay} or ${publicContact.email}.`,
  },
  {
    q: `What does ${NAME} do?`,
    a: `${NAME} builds outdoor spaces for houses: interlocking patios, walkways and driveways, retaining walls, composite decks, landscape design, and full backyard projects that combine those pieces. It also does seasonal spring and fall clean-ups (debris, beds and interlock care, not lawn care) in Barrie, Innisfil, Oro-Medonte and Springwater.`,
  },
  {
    q: `Why choose ${NAME}?`,
    a: `The approach is to listen to how you want to live outside, quote it honestly, and build it properly the first time: engineering before shortcuts, craft before speed. Drainage, access, soil conditions and detailing are reviewed before the written scope is finalized, and written project terms and communication details are confirmed before work begins. The cost estimator gives you a planning range before anyone visits.`,
  },
  {
    q: `When is ${NAME} booking projects?`,
    a: BOOKING_WINDOW,
  },
];

const ALL_FAQS = [...IDENTITY_FAQS, ...HOME_FAQS];

const pageSchema = graph(
  faqPage(PATH, ALL_FAQS),
  breadcrumb([
    { name: 'Home', path: '/' },
    { name: 'FAQ', path: PATH },
  ]),
  pageUpdateNode(PATH, PATH, `${NAME} FAQ`),
);

function FaqList({ items }: { items: readonly { q: string; a: string }[] }) {
  return (
    <div className="space-y-6">
      {items.map((item) => (
        <div key={item.q} className="bg-brand-surface p-8 md:p-10 rounded-[2px] border border-brand-dim/40">
          <h3 className="font-display text-2xl md:text-3xl font-light text-brand-bonewhite mb-4 leading-tight">{item.q}</h3>
          <p className="font-sans text-base text-brand-muted leading-relaxed font-light">{item.a}</p>
        </div>
      ))}
    </div>
  );
}

export default function Faq() {
  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO
        title={`FAQ | Who Is ${NAME}?`}
        description={`Who ${NAME} is, what it builds in Barrie and Simcoe County, why homeowners choose it, and when it is booking projects.`}
        canonical={`${BUSINESS.canonicalUrl}${PATH}`}
        schema={pageSchema}
      />
      <section className="section-padding pt-48">
        <div className="container-custom max-w-4xl">
          <h1 className="font-display text-5xl md:text-7xl font-light text-brand-bonewhite leading-[1.05] mb-8">
            Questions about <span className="italic text-brand-gold-dark">{NAME}</span>
          </h1>
          <LastUpdatedLine updatedOn={PAGE_UPDATES[PATH].updatedOn} reviewed={false} className="mb-4" />
          <BookingWindow className="mb-16" />

          <h2 className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-8">About the company</h2>
          <FaqList items={IDENTITY_FAQS} />

          <h2 className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mt-20 mb-8">Before you ask for a quote</h2>
          <FaqList items={HOME_FAQS} />

          <div className="flex flex-col sm:flex-row gap-8 mt-20 items-start sm:items-center">
            <Link to="/cost-estimator" className="btn-primary">See My Cost Range</Link>
            <Link to="/book" className="font-sans text-[11px] uppercase tracking-[0.25em] text-brand-bonewhite hover:text-brand-gold-dark transition-colors">
              Book a project conversation →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
