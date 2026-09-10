import { Helmet } from 'react-helmet-async';
import { motion } from 'motion/react';
import { MapPin, CheckCircle, ArrowRight, Phone, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../../components/SEO';
import { publicContact } from '../../data/business';
import { trackEngagement, trackCall } from '../../utils/analytics';

const COMMUNITIES = [
  "Alcona — Innisfil's urban core, new builds and established homes",
  "Cookstown — rural estate properties and large outdoor projects",
  "Stroud — waterfront and near-water residential",
  "Lefroy / Belle Ewart — Lake Simcoe shoreline properties",
  "Friday Harbour — resort-style outdoor living spaces",
  "Big Bay Point — premium waterfront hardscaping",
];

const SERVICES = [
  {
    title: "Interlocking Stone Patios & Driveways",
    desc: "Interlocking installations built for Innisfil's soil and climate conditions. From compact backyard patios in Alcona to full estate driveways on rural lots. Techo-Bloc, Permacon, and porcelain paver options.",
    link: "/services/interlocking-barrie",
  },
  {
    title: "Composite Decking",
    desc: "Low-maintenance composite decks ideal for Innisfil's lakeside properties. TimberTech and Trex builds with custom railings, integrated In-Lite lighting, and multi-level designs for sloped waterfront lots.",
    link: "/services/composite-decking-barrie",
  },
  {
    title: "Retaining Walls",
    desc: "Functional and decorative retaining walls for Innisfil's varied terrain. Armour stone walls for lakefront erosion control, modular block for grade changes, and natural stone features.",
    link: "/services/retaining-walls-barrie",
  },
  {
    title: "Landscape Design",
    desc: "Full outdoor living design from concept through construction. 3D renderings tailored to your Innisfil property — accounting for lot grading, sun exposure, and sight lines.",
    link: "/services/landscape-design-barrie",
  },
];

const PRICING = [
  { project: "Interlocking patio (200-400 sq ft)", range: "$12,000 – $25,000" },
  { project: "Full backyard transformation", range: "$35,000 – $90,000" },
  { project: "Composite deck (200-350 sq ft)", range: "$15,000 – $35,000" },
  { project: "Retaining wall (30-60 linear ft)", range: "$8,000 – $20,000" },
  { project: "Premium outdoor living space", range: "$90,000 – $160,000+" },
];

const FAQS = [
  {
    q: "Do I need a permit for landscaping in Innisfil?",
    a: "Permit requirements depend on the structure, height, grading, and property location. Innisfil advises contacting Building Services when a project may involve structural work; current Town engineering standards require retaining walls with an exposed face height of 1 metre or more to be designed and certified by a professional engineer. Shoreline properties may require additional approvals. Confirm site-specific requirements before construction.",
  },
  {
    q: "Is there a travel charge for Innisfil projects?",
    a: "No. We're based in Barrie — Innisfil is within our core service area with no additional travel fees.",
  },
  {
    q: "Can you work on waterfront properties?",
    a: "Yes. We have experience with lakefront lots including erosion control, permeable paver systems, and conservation authority requirements. We coordinate with the LSRCA when needed.",
  },
  {
    q: "How far in advance should I book?",
    a: "We recommend booking your design consultation 6-8 weeks before your desired start date. During peak season (May-August), lead times can stretch to 8-12 weeks.",
  },
  {
    q: "What warranty do you offer?",
    a: "All Golden Maple projects include a 5-year workmanship warranty. Material warranties vary by manufacturer — Techo-Bloc offers a transferable lifetime warranty on many products.",
  },
];

const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Golden Maple Landscaping",
  "description": "Premium landscaping and hardscape contractor serving Innisfil, Ontario. Specializing in interlocking stone, composite decking, retaining walls, and landscape design.",
  "url": "https://goldenmaplelandscaping.ca/locations/innisfil",
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
    "latitude": 44.3894,
    "longitude": -79.6903,
  },
  "areaServed": {
    "@type": "City",
    "name": "Innisfil",
    "url": "https://en.wikipedia.org/wiki/Innisfil",
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

export default function InnisfilLanding() {
  return (
    <div className="pt-32 pb-24 bg-brand-nearblack min-h-screen text-brand-bonewhite">
      <SEO
        title="Landscaping & Hardscape Contractor Innisfil"
        description="Premium interlocking, decking & landscape design for Innisfil homeowners. Locally owned, Barrie-based. 5-star rated. Book your free Innisfil consultation today."
        canonical="https://goldenmaplelandscaping.ca/locations/innisfil"
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
              <MapPin size={16} /> Serving Innisfil & Alcona
            </span>
            <h1 className="font-display text-5xl md:text-7xl font-light mb-8 leading-tight">
              Premium Landscaping & Hardscape <br />
              <span className="text-brand-gold-dark italic">Contractor in Innisfil, Ontario.</span>
            </h1>
            <p className="font-sans text-lg text-brand-muted leading-relaxed font-light mb-6 max-w-3xl">
              Golden Maple Landscaping serves Innisfil homeowners with the same precision craftsmanship we're known for across Simcoe County. Whether you're on the shores of Lake Simcoe, in one of Innisfil's growing subdivisions, or on a rural estate lot — we design and build outdoor spaces that match the property.
            </p>
            <p className="font-sans text-base text-brand-muted leading-relaxed font-light mb-12 max-w-3xl">
              Based in Barrie, we're 15 minutes from most Innisfil job sites. No travel surcharges, no subcontractors — our in-house crew handles every project from excavation to final walkthrough.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-5 mb-12">
              <Link
                to="/contact"
                onClick={() => trackEngagement('cta_click', 'innisfil_hero_quote')}
                className="btn-primary py-4 px-10"
              >
                Request Your Free Innisfil Quote
              </Link>
              <a
                href={`tel:${publicContact.phoneTel}`}
                onClick={() => trackCall('innisfil_hero_phone')}
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
              Why Innisfil Homeowners Choose <span className="text-brand-gold-dark italic">Golden Maple</span>
            </h2>
            <p className="font-sans text-base text-brand-muted font-light leading-relaxed mb-6 max-w-3xl">
              Innisfil's mix of waterfront properties, new construction, and rural acreages means every project is different. We adapt our approach to the site:
            </p>
            <ul className="space-y-3 mb-10 max-w-3xl">
              <li className="font-sans text-sm text-brand-muted font-light"><strong className="text-brand-bonewhite">Waterfront lots</strong> — drainage-first design, permeable pavers, conservation authority compliance</li>
              <li className="font-sans text-sm text-brand-muted font-light"><strong className="text-brand-bonewhite">New subdivisions (Friday Harbour, Alcona)</strong> — hardscaping that matches builder-grade homes with premium outdoor living</li>
              <li className="font-sans text-sm text-brand-muted font-light"><strong className="text-brand-bonewhite">Rural properties</strong> — large-scale patios, long driveways, estate-style retaining walls</li>
            </ul>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                "5.0-star rated across Google, HomeStars & Yelp",
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
              Our Services in <span className="text-brand-gold-dark italic">Innisfil</span>
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
              Innisfil Areas <span className="text-brand-gold-dark italic">We Serve</span>
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
              What Does Landscaping Cost <span className="text-brand-gold-dark italic">in Innisfil?</span>
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
              Waterfront properties may require additional engineering for drainage and conservation authority approvals. We'll flag likely permit or conservation reviews during design — confirm site-specific requirements before construction. Use our <Link to="/cost-estimator?city=innisfil" className="text-brand-gold-dark hover:underline">Cost Estimator</Link> for an instant ballpark.
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
              Get Your Free Innisfil Landscaping Quote
            </h2>
            <p className="font-sans text-brand-muted font-light mb-10 max-w-2xl mx-auto">
              Ready to upgrade your outdoor space? Contact Golden Maple Landscaping for a free, no-obligation site visit and detailed quote.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-8">
              <Link to="/contact" className="btn-primary py-4 px-10">Request a Quote</Link>
              <a href={`tel:${publicContact.phoneTel}`} onClick={() => trackCall('innisfil_phone')} className="flex items-center gap-3 font-sans text-sm text-brand-gold-dark hover:text-brand-bonewhite transition-colors">
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
