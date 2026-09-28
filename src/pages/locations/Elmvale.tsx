import { Helmet } from 'react-helmet-async';
import { motion } from 'motion/react';
import { MapPin, CheckCircle, ArrowRight, Phone, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../../components/SEO';
import { publicContact } from '../../data/business';
import { trackEngagement, trackCall } from '../../utils/analytics';

const COMMUNITIES = [
  "Queen Street / County Road 92 — the village main street and original core",
  "County Road 27 corridor — homes along Elmvale's main north-south route",
  "Yonge Street North — established village homes and newer infills",
  "Village settlement area — fully serviced lots targeted for careful growth",
  "Surrounding farm country — rural properties on the Elmvale clay plain",
  "Maple Syrup Festival route — country roads lined with sugar bush",
];

const SERVICES = [
  {
    title: "Interlocking Stone Patios & Driveways",
    desc: "Interlocking installations built for Elmvale's clay-plain soils — heavy clay that holds water and heaves with frost needs deeper, properly drained bases. Techo-Bloc, Permacon, and porcelain paver options.",
    link: "/services/interlocking-barrie",
  },
  {
    title: "Composite Decking",
    desc: "Low-maintenance composite decks for Elmvale's village homes and country properties. TimberTech and Trex builds with custom railings, integrated In-Lite lighting, and footings designed for clay soils.",
    link: "/services/composite-decking-barrie",
  },
  {
    title: "Retaining Walls",
    desc: "Functional and decorative retaining walls engineered for clay — where drainage behind the wall isn't optional, it's everything. Armour stone, natural stone, and modular block with proper weeping and granular backfill.",
    link: "/services/retaining-walls-barrie",
  },
  {
    title: "Landscape Design",
    desc: "Full outdoor living design from concept to construction. 3D renderings tailored to your Elmvale property — with grading and planting plans that respect how clay holds water and how the seasons move across it.",
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
    q: "Why is drainage such a big deal in Elmvale?",
    a: "Elmvale sits on a glacial clay plain — dense clay that drains very slowly. After heavy rain or spring melt, water sits on the surface instead of soaking in, which drowns lawns, undermines patios, and pushes against foundations. Every Elmvale project we build starts with grading and drainage designed for clay, not sand.",
  },
  {
    q: "Will my interlocking patio heave on Elmvale clay?",
    a: "Not if the base is built for it. Clay expands and contracts with moisture and frost, so we excavate deeper, use proper granular base with drainage, and compact in lifts. That's the difference between a patio that stays level for years and one that heaves in the first winter.",
  },
  {
    q: "Do I need a permit for landscaping in Elmvale?",
    a: "Permit requirements depend on the structure, height, grading, and property location. The Township of Springwater's building department can confirm what your project needs; taller structural retaining walls generally require professional engineering anywhere in Ontario. We'll flag likely reviews during design — confirm site-specific requirements before construction.",
  },
  {
    q: "Is there a travel charge for Elmvale projects?",
    a: "No. We're based in Barrie — Elmvale is within our core service area with no additional travel fees.",
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
  "description": "Premium landscaping and hardscape contractor serving Elmvale, Ontario. Specializing in interlocking stone, composite decking, retaining walls, and landscape design.",
  "url": "https://goldenmaplelandscaping.ca/locations/elmvale",
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
    "latitude": 44.5836,
    "longitude": -79.8658,
  },
  "areaServed": {
    "@type": "City",
    "name": "Elmvale",
    "url": "https://en.wikipedia.org/wiki/Elmvale",
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

export default function ElmvaleLanding() {
  return (
    <div className="pt-32 pb-24 bg-brand-nearblack min-h-screen text-brand-bonewhite">
      <SEO
        title="Landscaping & Hardscape Contractor Elmvale"
        description="Premium interlocking, decking & landscape design for Elmvale homeowners. Locally owned, Barrie-based. 5-star rated. Book your free Elmvale consultation today."
        canonical="https://goldenmaplelandscaping.ca/locations/elmvale"
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
              <MapPin size={16} /> Serving Elmvale & Springwater
            </span>
            <h1 className="font-display text-5xl md:text-7xl font-light mb-8 leading-tight">
              Premium Landscaping & Hardscape <br />
              <span className="text-brand-gold-dark italic">Contractor in Elmvale, Ontario.</span>
            </h1>
            <p className="font-sans text-lg text-brand-muted leading-relaxed font-light mb-6 max-w-3xl">
              Elmvale is maple-syrup country — a village built on a glacial clay plain where the ground holds water long after the rain stops. That clay shapes everything we build here: deeper bases under interlocking, drainage behind every retaining wall, and grading that moves water off the lot instead of letting it sit. Golden Maple Landscaping designs and builds Elmvale outdoor spaces that work with the clay, not against it.
            </p>
            <p className="font-sans text-base text-brand-muted leading-relaxed font-light mb-12 max-w-3xl">
              Based in Barrie, we're about 20 minutes from most Elmvale job sites — no travel surcharges, no subcontractors. Our in-house crew handles every project from excavation to final walkthrough.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-5 mb-12">
              <Link
                to="/book"
                onClick={() => trackEngagement('cta_click', 'elmvale_hero_quote')}
                className="btn-primary py-4 px-10"
              >
                Request Your Free Elmvale Quote
              </Link>
              <a
                href={`tel:${publicContact.phoneTel}`}
                onClick={() => trackCall('elmvale_hero_phone')}
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
              Why Elmvale Homeowners Choose <span className="text-brand-gold-dark italic">Golden Maple</span>
            </h2>
            <p className="font-sans text-base text-brand-muted font-light leading-relaxed mb-6 max-w-3xl">
              Clay-plain villages punish generic construction. We build Elmvale projects around the ground they're actually sitting on:
            </p>
            <ul className="space-y-3 mb-10 max-w-3xl">
              <li className="font-sans text-sm text-brand-muted font-light"><strong className="text-brand-bonewhite">Clay-built bases</strong> — deeper excavation, proper granular depth, and drainage sized for soils that don't drain on their own</li>
              <li className="font-sans text-sm text-brand-muted font-light"><strong className="text-brand-bonewhite">Standing-water solutions</strong> — grading, swales, and subsurface drainage that end the soggy-backyard cycle</li>
              <li className="font-sans text-sm text-brand-muted font-light"><strong className="text-brand-bonewhite">Village and country</strong> — from Queen Street infills to rural properties on the surrounding clay plain</li>
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
              Our Services in <span className="text-brand-gold-dark italic">Elmvale</span>
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
              Elmvale Areas <span className="text-brand-gold-dark italic">We Serve</span>
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
              What Does Landscaping Cost <span className="text-brand-gold-dark italic">in Elmvale?</span>
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
              Clay soils mean what's under the surface matters more than usual — which is why we quote from a site visit. Use our <Link to="/cost-estimator?city=elmvale" className="text-brand-gold-dark hover:underline">Cost Estimator</Link> for an instant ballpark, then book a free visit for a detailed written quote.
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
              Get Your Free Elmvale Landscaping Quote
            </h2>
            <p className="font-sans text-brand-muted font-light mb-10 max-w-2xl mx-auto">
              Ready to upgrade your outdoor space? Contact Golden Maple Landscaping for a free, no-obligation site visit and detailed quote.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-8">
              <Link to="/book" className="btn-primary py-4 px-10">Request a Quote</Link>
              <a href={`tel:${publicContact.phoneTel}`} onClick={() => trackCall('elmvale_phone')} className="flex items-center gap-3 font-sans text-sm text-brand-gold-dark hover:text-brand-bonewhite transition-colors">
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
