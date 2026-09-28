import { Helmet } from 'react-helmet-async';
import { motion } from 'motion/react';
import { MapPin, CheckCircle, ArrowRight, Phone, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../../components/SEO';
import { publicContact } from '../../data/business';
import { trackEngagement, trackCall } from '../../utils/analytics';

const COMMUNITIES = [
  "Belterra Estates — new-build yards needing complete grading and design",
  "Briar Hill West — subdivision lots starting from builder-basic landscaping",
  "Honey Hill — new construction homes on flat sand-plain lots",
  "Rizzardo developments — new subdivisions across Alliston's west end",
  "Victoria Street / King Street corridor — established homes and infills",
  "Boyne River area — properties near the river with drainage considerations",
];

const SERVICES = [
  {
    title: "Interlocking Stone Patios & Driveways",
    desc: "Interlocking installations built for Alliston's sandy Tecumseth sand-plain soils — proper base depth and compaction so patios and driveways hold through Simcoe County freeze-thaw. Techo-Bloc, Permacon, and porcelain paver options.",
    link: "/services/interlocking-barrie",
  },
  {
    title: "Composite Decking",
    desc: "Low-maintenance composite decks for Alliston's new-build backyards and established homes alike. TimberTech and Trex builds with custom railings, integrated In-Lite lighting, and designs that work with flat subdivision lots.",
    link: "/services/composite-decking-barrie",
  },
  {
    title: "Retaining Walls",
    desc: "Functional and decorative retaining walls for Alliston's gentle grades — garden bed walls, raised patios, and armour stone features. Built with proper drainage behind every wall.",
    link: "/services/retaining-walls-barrie",
  },
  {
    title: "Landscape Design",
    desc: "Full outdoor living design from bare lot to finished backyard. 3D renderings tailored to your Alliston property — accounting for lot grading, sun exposure, and how your family actually uses the space.",
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
    q: "We have a new build in Alliston — can you start from a bare lot?",
    a: "Yes. Many Alliston projects begin as rough-graded builder lots in subdivisions like Belterra Estates, Briar Hill West, or Honey Hill. We handle final grading, drainage, sod, planting, and full hardscape design so the yard is finished properly from day one.",
  },
  {
    q: "How does Alliston's sandy soil affect my project?",
    a: "Alliston sits on the Tecumseth sand plains — deep, fast-draining sand left behind by glacial Lake Algonquin. That means good natural drainage but also soil that erodes easily when left bare. We compact and edge interlocking properly for sandy subgrades, and we get planting beds and sod established quickly so your lot doesn't wash out in the first heavy rain.",
  },
  {
    q: "Do I need a permit for landscaping in Alliston?",
    a: "Permit requirements depend on the structure, height, grading, and property location. The Town of New Tecumseth's Building Services can confirm what your project needs; taller structural retaining walls generally require professional engineering anywhere in Ontario. We'll flag likely permit or engineering reviews during design — confirm site-specific requirements before construction.",
  },
  {
    q: "Is there a travel charge for Alliston projects?",
    a: "No. We're based in Barrie — Alliston is within our core service area with no additional travel fees.",
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
  "description": "Premium landscaping and hardscape contractor serving Alliston, Ontario. Specializing in interlocking stone, composite decking, retaining walls, and landscape design.",
  "url": "https://goldenmaplelandscaping.ca/locations/alliston",
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
    "latitude": 44.1519,
    "longitude": -79.8653,
  },
  "areaServed": {
    "@type": "City",
    "name": "Alliston",
    "url": "https://en.wikipedia.org/wiki/Alliston,_Ontario",
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

export default function AllistonLanding() {
  return (
    <div className="pt-32 pb-24 bg-brand-nearblack min-h-screen text-brand-bonewhite">
      <SEO
        title="Landscaping & Hardscape Contractor Alliston"
        description="Premium interlocking, decking & landscape design for Alliston homeowners. Locally owned, Barrie-based. 5-star rated. Book your free Alliston consultation today."
        canonical="https://goldenmaplelandscaping.ca/locations/alliston"
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
              <MapPin size={16} /> Serving Alliston & New Tecumseth
            </span>
            <h1 className="font-display text-5xl md:text-7xl font-light mb-8 leading-tight">
              Premium Landscaping & Hardscape <br />
              <span className="text-brand-gold-dark italic">Contractor in Alliston, Ontario.</span>
            </h1>
            <p className="font-sans text-lg text-brand-muted leading-relaxed font-light mb-6 max-w-3xl">
              Alliston is one of Simcoe County's fastest-growing towns — new subdivisions keep adding homes, and most new builds arrive with a rough-graded lot and builder-basic landscaping. Golden Maple Landscaping turns those blank-slate Alliston backyards into finished outdoor spaces: properly graded, well-drained, and designed to enjoy from the first summer.
            </p>
            <p className="font-sans text-base text-brand-muted leading-relaxed font-light mb-12 max-w-3xl">
              Based in Barrie, Alliston sits right in our regular service corridor — no travel surcharges, no subcontractors. Our in-house crew handles every project from excavation to final walkthrough.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-5 mb-12">
              <Link
                to="/book"
                onClick={() => trackEngagement('cta_click', 'alliston_hero_quote')}
                className="btn-primary py-4 px-10"
              >
                Request Your Free Alliston Quote
              </Link>
              <a
                href={`tel:${publicContact.phoneTel}`}
                onClick={() => trackCall('alliston_hero_phone')}
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
              Why Alliston Homeowners Choose <span className="text-brand-gold-dark italic">Golden Maple</span>
            </h2>
            <p className="font-sans text-base text-brand-muted font-light leading-relaxed mb-6 max-w-3xl">
              Alliston's mix of brand-new subdivisions and established neighbourhoods means every project starts from a different place. We adapt our approach to the site:
            </p>
            <ul className="space-y-3 mb-10 max-w-3xl">
              <li className="font-sans text-sm text-brand-muted font-light"><strong className="text-brand-bonewhite">New-build lots</strong> — final grading, drainage, and complete backyard design on bare subdivision lots</li>
              <li className="font-sans text-sm text-brand-muted font-light"><strong className="text-brand-bonewhite">Sandy Tecumseth soils</strong> — base prep and compaction methods matched to the sand plains, so interlocking stays put through freeze-thaw</li>
              <li className="font-sans text-sm text-brand-muted font-light"><strong className="text-brand-bonewhite">Established homes</strong> — patios, decks, and planting upgrades along Victoria Street, King Street, and older neighbourhoods</li>
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
              Our Services in <span className="text-brand-gold-dark italic">Alliston</span>
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
              Alliston Areas <span className="text-brand-gold-dark italic">We Serve</span>
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
              What Does Landscaping Cost <span className="text-brand-gold-dark italic">in Alliston?</span>
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
              Every Alliston lot is different — soil, grading, and access all shape the final number. Use our <Link to="/cost-estimator?city=alliston" className="text-brand-gold-dark hover:underline">Cost Estimator</Link> for an instant ballpark, then book a site visit for a detailed written quote.
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
              Get Your Free Alliston Landscaping Quote
            </h2>
            <p className="font-sans text-brand-muted font-light mb-10 max-w-2xl mx-auto">
              Ready to upgrade your outdoor space? Contact Golden Maple Landscaping for a no-obligation site visit and detailed quote.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-8">
              <Link to="/book" className="btn-primary py-4 px-10">Request a Quote</Link>
              <a href={`tel:${publicContact.phoneTel}`} onClick={() => trackCall('alliston_phone')} className="flex items-center gap-3 font-sans text-sm text-brand-gold-dark hover:text-brand-bonewhite transition-colors">
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
