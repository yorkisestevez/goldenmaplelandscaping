import { Helmet } from 'react-helmet-async';
import { motion } from 'motion/react';
import { MapPin, Shield, CheckCircle, ArrowRight, Phone, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../../components/SEO';
import { trackEngagement } from '../../utils/analytics';

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
  { project: "Interlocking patio (200-400 sq ft)", range: "$12,000 – $25,000" },
  { project: "Full backyard transformation", range: "$35,000 – $90,000" },
  { project: "Composite deck (200-350 sq ft)", range: "$15,000 – $35,000" },
  { project: "Retaining wall (30-60 linear ft)", range: "$8,000 – $20,000" },
  { project: "Premium outdoor living space", range: "$90,000 – $160,000+" },
];

const FAQS = [
  {
    q: "When is the best time to start a landscaping project in Barrie?",
    a: "Most projects start between April and June. We recommend booking your design consultation in February or March to secure your preferred start date. Our build season runs April through November.",
  },
  {
    q: "Do you handle permits for Barrie projects?",
    a: "Yes. We handle all permit applications with the City of Barrie and the Nottawasaga Valley Conservation Authority when required. Retaining walls over 1 metre typically require an engineered drawing and building permit.",
  },
  {
    q: "How long does a typical project take?",
    a: "A standard interlocking patio takes 3-5 days. A full backyard transformation with multiple elements typically takes 2-4 weeks. We provide a detailed timeline before starting.",
  },
  {
    q: "Do you offer financing?",
    a: "We offer flexible payment schedules. A deposit holds your spot, with progress payments aligned to project milestones. Ask about our financing partners for larger projects.",
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
  "description": "Premium landscaping and hardscape contractor serving Barrie, Ontario. Specializing in interlocking stone, composite decking, retaining walls, and landscape design.",
  "url": "https://goldenmaplelandscaping.ca/locations/barrie",
  "telephone": "+17055003581",
  "email": "yorkis@goldenmaplelandscaping.ca",
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
        description="Barrie's top-rated landscaping & hardscape contractor. Interlocking patios, composite decks, retaining walls & landscape design. 8 five-star Google reviews. Free estimates."
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
            <span className="flex items-center gap-2 font-sans text-xs tracking-widest uppercase text-brand-gold mb-6">
              <MapPin size={16} /> Serving All of Barrie, ON
            </span>
            <h1 className="font-display text-5xl md:text-7xl font-light mb-8 leading-tight">
              Premium Landscaping & Hardscape <br />
              <span className="text-brand-gold italic">Contractor in Barrie, Ontario.</span>
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
                Request Your Free Barrie Quote
              </Link>
              <a
                href="tel:7055003581"
                onClick={() => trackEngagement('call_click', 'barrie_hero')}
                className="flex items-center gap-3 font-sans text-base text-brand-gold hover:text-brand-bonewhite transition-colors"
              >
                <Phone size={18} /> Call 705-500-3581
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
              Why Barrie Homeowners Choose <span className="text-brand-gold italic">Golden Maple</span>
            </h2>
            <p className="font-sans text-base text-brand-muted font-light leading-relaxed mb-10 max-w-3xl">
              Barrie's climate demands hardscapes built to handle freeze-thaw cycles, heavy snow loads, and spring runoff. Every project we build accounts for local soil conditions, drainage patterns, and the realities of Simcoe County winters.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                "5.0-star rated across Google, HomeStars & Yelp",
                "Premium materials — Techo-Bloc, Permacon, TimberTech, In-Lite",
                "Full design service — 3D renders before we break ground",
                "Transparent pricing — detailed quotes, no hidden fees",
                "Built for Barrie weather — proper base depth, drainage & Romex",
                "In-house crew — we never subcontract your project",
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <CheckCircle size={18} className="text-brand-gold shrink-0 mt-0.5" />
                  <span className="font-sans text-sm text-brand-muted font-light">{item}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Services */}
          <div className="mb-24">
            <h2 className="font-display text-3xl md:text-5xl text-brand-bonewhite mb-12">
              Our Services in <span className="text-brand-gold italic">Barrie</span>
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
                    className="flex items-center gap-3 text-brand-gold font-sans text-[10px] uppercase tracking-[0.3em] group-hover:gap-5 transition-all"
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
              Barrie Neighbourhoods <span className="text-brand-gold italic">We Serve</span>
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {NEIGHBOURHOODS.map((n) => (
                <div key={n} className="flex items-center gap-3 bg-brand-surface p-4 border border-brand-dim/20 rounded-sm">
                  <MapPin size={16} className="text-brand-gold shrink-0" />
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
              What Does Landscaping Cost <span className="text-brand-gold italic">in Barrie?</span>
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-brand-dim/20">
                    <th className="font-sans text-[11px] uppercase tracking-[0.2em] text-brand-gold py-4 pr-8">Project Type</th>
                    <th className="font-sans text-[11px] uppercase tracking-[0.2em] text-brand-gold py-4">Typical Range</th>
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
              Want a faster answer? Use our <Link to="/cost-estimator?city=barrie" className="text-brand-gold hover:underline">Cost Estimator</Link> for an instant ballpark.
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
              Frequently Asked <span className="text-brand-gold italic">Questions</span>
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
              Get Your Free Barrie Landscaping Quote
            </h2>
            <p className="font-sans text-brand-muted font-light mb-10 max-w-2xl mx-auto">
              Ready to transform your outdoor space? Contact Golden Maple Landscaping for a free, no-obligation consultation and quote.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-8">
              <Link to="/contact" className="btn-primary py-4 px-10">Request a Quote</Link>
              <a href="tel:7055003581" className="flex items-center gap-3 font-sans text-sm text-brand-gold hover:text-brand-bonewhite transition-colors">
                <Phone size={16} /> 705-500-3581
              </a>
            </div>
            <a href="mailto:yorkis@goldenmaplelandscaping.ca" className="flex items-center justify-center gap-3 font-sans text-sm text-brand-muted hover:text-brand-gold transition-colors">
              <Mail size={16} /> yorkis@goldenmaplelandscaping.ca
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
