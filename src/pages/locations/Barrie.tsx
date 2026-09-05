import { Helmet } from 'react-helmet-async';
import { motion } from 'motion/react';
import { MapPin, Shield, CheckCircle, ArrowRight, Phone, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../../components/SEO';
import { trackEngagement, trackCall } from '../../utils/analytics';
import { BUSINESS, publicClaimCopy, publicContact, publicPostalAddress } from '../../data/business';

const NEIGHBOURHOODS = [
  "South Barrie / Mapleview",
  "Holly",
  "Painswick / East Barrie",
  "North End / Allandale",
  "Essa Road Corridor",
  "Kempenfelt Bay area",
];

const SERVICES = [
  {
    title: "Interlocking Stone Patios & Driveways",
    desc: "From intimate backyard patios to full driveway rebuilds, we install interlocking stone with the base preparation and compaction standards that Barrie's frost line demands.",
    link: "/services/interlocking-barrie",
  },
  {
    title: "Composite Decking",
    desc: "Low-maintenance composite decks designed for Barrie backyards. TimberTech and Trex, including custom railings, integrated lighting, and multi-level designs.",
    link: "/services/composite-decking-barrie",
  },
  {
    title: "Retaining Walls",
    desc: "Structural and decorative retaining walls that solve grading challenges. Armour stone, natural stone, and modular block — all engineered for load and drainage.",
    link: "/services/retaining-walls-barrie",
  },
  {
    title: "Landscape Design",
    desc: "Complete outdoor living design from concept to construction. 3D renderings so you see exactly what your space will look like before a single stone is laid.",
    link: "/services/landscape-design-barrie",
  },
];

const PRICING = [
  { project: "Interlocking patio", range: "Project-specific scope" },
  { project: "Full backyard transformation", range: "Project-specific scope" },
  { project: "Composite deck", range: "Project-specific scope" },
  { project: "Retaining wall", range: "Project-specific scope" },
  { project: "Outdoor living space", range: "Project-specific scope" },
];

const FAQS = [
  {
    q: "When is the best time to start a landscaping project in Barrie?",
    a: "Seasonal timing and availability vary. Contact us to discuss the current scope and timing for your property.",
  },
  {
    q: "Do you handle permits for Barrie projects?",
    a: publicClaimCopy(BUSINESS.commercialPolicies.permits, "We confirm permit needs and responsibilities in the written project scope."),
  },
  {
    q: "How long does a typical project take?",
    a: "Project timing depends on scope, site conditions, materials, and scheduling. We can discuss a project-specific timeline before work begins.",
  },
  {
    q: "Do you offer financing?",
    a: "Contact us to confirm current payment and financing options for your project.",
  },
  {
    q: "What warranty do you offer?",
    a: publicClaimCopy(BUSINESS.credentials.workmanshipWarranty, "Written workmanship terms are available for your project."),
  },
];

const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Golden Maple Landscaping",
  "description": "Premium landscaping and hardscape contractor serving Barrie, Ontario. Specializing in interlocking stone, composite decking, retaining walls, and landscape design.",
  "url": "https://goldenmaplelandscaping.ca/locations/barrie",
  "telephone": publicContact.phoneTel,
  "email": publicContact.email,
  "address": publicPostalAddress(),
  "areaServed": {
    "@type": "City",
    "name": "Barrie",
    "url": "https://en.wikipedia.org/wiki/Barrie",
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

export default function BarrieLanding() {
  return (
    <div className="pt-32 pb-24 bg-brand-nearblack min-h-screen text-brand-bonewhite">
      <SEO
        title="Landscaping Contractor Barrie ON"
        description="Landscaping and hardscape services for Barrie properties, including interlocking patios, composite decks, retaining walls, and landscape design. Contact us to confirm current project scope."
        canonical="https://goldenmaplelandscaping.ca/locations/barrie"
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
              <MapPin size={16} /> Serving All of Barrie, ON
            </span>
            <h1 className="font-display text-5xl md:text-7xl font-light mb-8 leading-tight">
              Premium Landscaping & Hardscape <br />
              <span className="text-brand-gold-dark italic">Contractor in Barrie, Ontario.</span>
            </h1>
            <p className="font-sans text-lg text-brand-muted leading-relaxed font-light mb-12 max-w-3xl">
              Golden Maple Landscaping is Barrie's premier outdoor construction company, specializing in interlocking stone, composite decking, retaining walls, and full landscape design. We serve homeowners across Barrie — from the south end near Mapleview to Holly, Painswick, and the north shore of Kempenfelt Bay.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-5 mb-12">
              <Link
                to="/contact"
                onClick={() => trackEngagement('cta_click', 'barrie_hero_quote')}
                className="btn-primary py-4 px-10"
              >
                Request a Barrie Quote
              </Link>
              <a
                href={`tel:${publicContact.phoneTel}`}
                onClick={() => trackCall('barrie_hero_phone')}
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
              Why Barrie Homeowners Choose <span className="text-brand-gold-dark italic">Golden Maple</span>
            </h2>
            <p className="font-sans text-base text-brand-muted font-light leading-relaxed mb-10 max-w-3xl">
              Barrie's climate demands hardscapes built to handle freeze-thaw cycles, heavy snow loads, and spring runoff. Every project we build accounts for local soil conditions, drainage patterns, and the realities of Simcoe County winters.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                publicClaimCopy(BUSINESS.reviews.aggregate, "Verified reviews are available."),
                "Premium materials — Techo-Bloc, Permacon, TimberTech, In-Lite",
                "Full design service — 3D renders before we break ground",
                "Transparent pricing — detailed quotes, no hidden fees",
                "Built for Barrie weather — proper base depth, drainage & Romex",
                "In-house crew — we never subcontract your project",
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
              Our Services in <span className="text-brand-gold-dark italic">Barrie</span>
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

          {/* Neighbourhoods */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mb-24"
          >
            <h2 className="font-display text-3xl md:text-5xl text-brand-bonewhite mb-10">
              Barrie Neighbourhoods <span className="text-brand-gold-dark italic">We Serve</span>
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {NEIGHBOURHOODS.map((n) => (
                <div key={n} className="flex items-center gap-3 bg-brand-surface p-4 border border-brand-dim/20 rounded-sm">
                  <MapPin size={16} className="text-brand-gold-dark shrink-0" />
                  <span className="font-sans text-sm text-brand-muted font-light">{n}</span>
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
              What Does Landscaping Cost <span className="text-brand-gold-dark italic">in Barrie?</span>
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
              Want a faster answer? Use our <Link to="/cost-estimator?city=barrie" className="text-brand-gold-dark hover:underline">Cost Estimator</Link> for an instant ballpark.
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
              Discuss Your Barrie Landscaping Project
            </h2>
            <p className="font-sans text-brand-muted font-light mb-10 max-w-2xl mx-auto">
              Ready to discuss your outdoor space? Contact Golden Maple Landscaping to confirm the current consultation and quote scope.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-8">
              <Link to="/contact" className="btn-primary py-4 px-10">Request a Quote</Link>
              <a href={`tel:${publicContact.phoneTel}`} onClick={() => trackCall('barrie_phone')} className="flex items-center gap-3 font-sans text-sm text-brand-gold-dark hover:text-brand-bonewhite transition-colors">
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
