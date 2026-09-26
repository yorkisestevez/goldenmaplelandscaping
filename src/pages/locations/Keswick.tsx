import { Helmet } from 'react-helmet-async';
import { motion } from 'motion/react';
import { MapPin, CheckCircle, ArrowRight, Phone, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../../components/SEO';
import { publicContact } from '../../data/business';
import { trackEngagement, trackCall } from '../../utils/analytics';

const COMMUNITIES = [
  "Simcoe Landing — new master-planned community with modern outdoor living",
  "Roches Point — established shoreline neighbourhood on Cook's Bay",
  "Keswick Beach — lakefront properties with erosion and drainage needs",
  "The Queensway corridor — main-street homes and growing infills",
  "Woodbine Avenue — east-side neighbourhoods near the Maskinonge River",
  "Keswick Marsh edge — properties backing onto wetland with setback considerations",
];

const SERVICES = [
  {
    title: "Interlocking Stone Patios & Driveways",
    desc: "Interlocking installations built for Keswick's shoreline conditions — high water table, lake-effect freeze-thaw, and sandy lakeside soils. Proper base depth and drainage behind every square foot. Techo-Bloc, Permacon, and porcelain paver options.",
    link: "/services/interlocking-barrie",
  },
  {
    title: "Composite Decking",
    desc: "Low-maintenance composite decks made for lakeside life on Cook's Bay. TimberTech and Trex builds with custom railings, integrated In-Lite lighting, and designs that frame the water view.",
    link: "/services/composite-decking-barrie",
  },
  {
    title: "Retaining Walls",
    desc: "Functional and decorative retaining walls for Keswick's shoreline grades — armour stone for erosion control along the water, modular block for terraced backyards, all with drainage engineered for a high water table.",
    link: "/services/retaining-walls-barrie",
  },
  {
    title: "Landscape Design",
    desc: "Full outdoor living design from concept to construction. 3D renderings tailored to your Keswick property — accounting for shoreline setbacks, lot grading, and Lake Simcoe watershed requirements.",
    link: "/services/landscape-design-barrie",
  },
];

const PRICING = [
  { project: "Interlocking patio", range: "Project-specific scope" },
  { project: "Full backyard transformation", range: "Project-specific scope" },
  { project: "Composite deck", range: "Project-specific scope" },
  { project: "Retaining wall", range: "Project-specific scope" },
  { project: "Premium outdoor living space", range: "Project-specific scope" },
];

const FAQS = [
  {
    q: "My Keswick property is near the water — what extra rules apply?",
    a: "Properties near Lake Simcoe and its tributaries like the Maskinonge River fall under Lake Simcoe Region Conservation Authority (LSRCA) regulations, and shoreline work may need permits before construction. We design with those setbacks and approvals in mind from the first site visit — and we coordinate with the LSRCA when a project needs it.",
  },
  {
    q: "How do you handle Keswick's high water table?",
    a: "Much of Keswick sits low beside Cook's Bay, so groundwater can sit close to the surface — especially in spring. We build drainage into the project from the start: proper grading away from the house, subsurface drainage where needed, and base construction that won't pump or heave when the water table rises.",
  },
  {
    q: "Can you work on a sloped lot down to the lake?",
    a: "Yes. Terraced retaining walls, stepped patios, and stair systems are exactly how we make sloped shoreline lots usable. We'll confirm setback and permit requirements for the shoreline portion during design.",
  },
  {
    q: "Is there a travel charge for Keswick projects?",
    a: "No. Keswick is within our service area with no additional travel fees.",
  },
  {
    q: "How far in advance should I book?",
    a: "We recommend booking your design consultation 6-8 weeks before your desired start date. During peak season (May-August), lead times can stretch to 8-12 weeks.",
  },
  {
    q: "What warranty do you offer?",
    a: "Ask us for the current written workmanship terms for your specific project. Manufacturer coverage depends on the selected product and must be confirmed with its current documentation.",
  },
];

const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Golden Maple Landscaping",
  "description": "Premium landscaping and hardscape contractor serving Keswick, Ontario. Specializing in interlocking stone, composite decking, retaining walls, and landscape design.",
  "url": "https://goldenmaplelandscaping.ca/locations/keswick",
  "telephone": publicContact.phoneTel,
  "email": publicContact.email,
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Barrie",
    "addressRegion": "ON",
    "addressCountry": "CA",
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 44.2205,
    "longitude": -79.4782,
  },
  "areaServed": {
    "@type": "City",
    "name": "Keswick",
    "url": "https://en.wikipedia.org/wiki/Keswick,_Ontario",
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": FAQS.map((faq) => ({
    "@type": "Question",
    "name": faq.q,
    "acceptedAnswer": {
      "@type": "Answer",
      "text": faq.a,
    },
  })),
};

export default function KeswickLanding() {
  return (
    <div className="pt-32 pb-24 bg-brand-nearblack min-h-screen text-brand-bonewhite">
      <SEO
        title="Landscaping & Hardscape Contractor Keswick"
        description="Premium interlocking, decking & landscape design for Keswick homeowners. Locally owned, Barrie-based. 5-star rated. Book your free Keswick consultation today."
        canonical="https://goldenmaplelandscaping.ca/locations/keswick"
        schema={localBusinessSchema}
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      </Helmet>

      <div className="container-custom">
        <div className="max-w-5xl mx-auto">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <span className="flex items-center gap-2 font-sans text-xs tracking-widest uppercase text-brand-gold-dark mb-6">
              <MapPin size={16} /> Serving Keswick & Georgina
            </span>
            <h1 className="font-display text-5xl md:text-7xl font-light mb-8 leading-tight">
              Premium Landscaping & Hardscape <br />
              <span className="text-brand-gold-dark italic">Contractor in Keswick, Ontario.</span>
            </h1>
            <p className="font-sans text-lg text-brand-muted leading-relaxed font-light mb-6 max-w-3xl">
              Keswick living means Lake Simcoe living — Cook's Bay sunsets, shoreline lots, and the Maskinonge River winding through town. It also means a high water table, shoreline regulations, and lake-effect winters that punish shortcuts. Golden Maple Landscaping builds Keswick outdoor spaces engineered for the water's edge: drainage-first construction, proper base depths, and designs that make the most of the view.
            </p>
            <p className="font-sans text-base text-brand-muted leading-relaxed font-light mb-12 max-w-3xl">
              Based in Barrie, Keswick is a regular service run for our crew — no travel surcharges, no subcontractors. Our in-house team handles every project from excavation to final walkthrough.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-5 mb-12">
              <Link
                to="/book"
                onClick={() => trackEngagement('cta_click', 'keswick_hero_quote')}
                className="btn-primary py-4 px-10"
              >
                Request Your Free Keswick Quote
              </Link>
              <a
                href={`tel:${publicContact.phoneTel}`}
                onClick={() => trackCall('keswick_hero_phone')}
                className="flex items-center gap-3 font-sans text-base text-brand-gold-dark hover:text-brand-bonewhite transition-colors"
              >
                <Phone size={18} /> Call {publicContact.phoneDisplay}
              </a>
            </div>
          </motion.div>

          {/* Why Choose Us */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="mb-24"
          >
            <h2 className="font-display text-3xl md:text-5xl text-brand-bonewhite mb-10">
              Why Keswick Homeowners Choose <span className="text-brand-gold-dark italic">Golden Maple</span>
            </h2>
            <p className="font-sans text-base text-brand-muted font-light leading-relaxed mb-6 max-w-3xl">
              Shoreline properties reward builders who respect the water — and punish those who don't. We build for Keswick's real conditions:
            </p>
            <ul className="space-y-3 mb-10 max-w-3xl">
              <li className="font-sans text-sm text-brand-muted font-light"><strong className="text-brand-bonewhite">Shoreline expertise</strong> — erosion control, terraced walls, and drainage designed for Cook's Bay lots</li>
              <li className="font-sans text-sm text-brand-muted font-light"><strong className="text-brand-bonewhite">LSRCA-aware process</strong> — we flag conservation authority and setback requirements before design, not mid-build</li>
              <li className="font-sans text-sm text-brand-muted font-light"><strong className="text-brand-bonewhite">New-community experience</strong> — finished backyards for Simcoe Landing and other new builds, from bare lot to outdoor living</li>
            </ul>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                "Project-specific scope and written terms",
                "Premium materials — Techo-Bloc, Permacon, TimberTech, In-Lite",
                "Full design service — 3D renders before we break ground",
                "Transparent pricing — detailed quotes, no hidden fees",
                "Built for Ontario winters — proper base depth, drainage & Romex",
                "No subcontractors — in-house crew on every project",
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <CheckCircle size={18} className="text-brand-gold-dark shrink-0 mt-0.5" />
                  <span className="font-sans text-sm text-brand-muted font-light">{item}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Services */}
          <div className="mb-24">
            <h2 className="font-display text-3xl md:text-5xl text-brand-bonewhite mb-12">
              Our Services in <span className="text-brand-gold-dark italic">Keswick</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {SERVICES.map((service, idx) => (
                <motion.div
                  key={service.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: idx * 0.1 }}
                  className="bg-brand-surface p-8 border border-brand-dim/20 rounded-sm group hover:border-brand-gold/30 transition-all"
                >
                  <h3 className="font-display text-2xl mb-4 text-brand-bonewhite">{service.title}</h3>
                  <p className="font-sans text-sm text-brand-muted font-light leading-relaxed mb-6">{service.desc}</p>
                  <Link
                    to={service.link}
                    className="flex items-center gap-3 text-brand-gold-dark font-sans text-[10px] uppercase tracking-[0.3em] group-hover:gap-5 transition-all"
                  >
                    <span>View Service</span>
                    <ArrowRight size={14} />
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Communities */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mb-24"
          >
            <h2 className="font-display text-3xl md:text-5xl text-brand-bonewhite mb-10">
              Keswick Areas <span className="text-brand-gold-dark italic">We Serve</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {COMMUNITIES.map((c) => (
                <div key={c} className="flex items-start gap-3 bg-brand-surface p-4 border border-brand-dim/20 rounded-sm">
                  <MapPin size={16} className="text-brand-gold-dark shrink-0 mt-0.5" />
                  <span className="font-sans text-sm text-brand-muted font-light">{c}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Pricing */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mb-24"
          >
            <h2 className="font-display text-3xl md:text-5xl text-brand-bonewhite mb-10">
              What Does Landscaping Cost <span className="text-brand-gold-dark italic">in Keswick?</span>
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-brand-dim/20">
                    <th className="font-sans text-[11px] uppercase tracking-[0.2em] text-brand-gold-dark py-4 pr-8">Project Type</th>
                    <th className="font-sans text-[11px] uppercase tracking-[0.2em] text-brand-gold-dark py-4">Typical Range</th>
                  </tr>
                </thead>
                <tbody>
                  {PRICING.map((row) => (
                    <tr key={row.project} className="border-b border-brand-dim/10">
                      <td className="font-sans text-sm text-brand-muted font-light py-4 pr-8">{row.project}</td>
                      <td className="font-sans text-sm text-brand-bonewhite font-light py-4">{row.range}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="font-sans text-sm text-brand-muted font-light mt-6">
              Shoreline lots often need extra engineering for drainage and erosion — which is why we quote from a site visit. Use our <Link to="/cost-estimator?city=keswick" className="text-brand-gold-dark hover:underline">Cost Estimator</Link> for an instant ballpark, then book a free visit for a detailed written quote.
            </p>
          </motion.div>

          {/* FAQ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mb-24"
          >
            <h2 className="font-display text-3xl md:text-5xl text-brand-bonewhite mb-12">
              Frequently Asked <span className="text-brand-gold-dark italic">Questions</span>
            </h2>
            <div className="space-y-8">
              {FAQS.map((faq) => (
                <div key={faq.q} className="border-b border-brand-dim/10 pb-8">
                  <h3 className="font-display text-xl text-brand-bonewhite mb-4">{faq.q}</h3>
                  <p className="font-sans text-sm text-brand-muted font-light leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* CTA */}
          <div className="text-center bg-brand-surface p-12 md:p-16 border border-brand-dim/20 rounded-sm">
            <h2 className="font-display text-3xl md:text-4xl text-brand-bonewhite mb-6">
              Get Your Free Keswick Landscaping Quote
            </h2>
            <p className="font-sans text-brand-muted font-light mb-10 max-w-2xl mx-auto">
              Ready to upgrade your outdoor space? Contact Golden Maple Landscaping for a free, no-obligation site visit and detailed quote.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-8">
              <Link to="/book" className="btn-primary py-4 px-10">Request a Quote</Link>
              <a href={`tel:${publicContact.phoneTel}`} onClick={() => trackCall('keswick_phone')} className="flex items-center gap-3 font-sans text-sm text-brand-gold-dark hover:text-brand-bonewhite transition-colors">
                <Phone size={16} /> {publicContact.phoneDisplay}
              </a>
            </div>
            <a href={`mailto:${publicContact.email}`} className="flex items-center justify-center gap-3 font-sans text-sm text-brand-muted hover:text-brand-gold-dark transition-colors">
              <Mail size={16} /> {publicContact.email}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
