import { Helmet } from 'react-helmet-async';
import { motion } from 'motion/react';
import { MapPin, CheckCircle, ArrowRight, Phone, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../../components/SEO';
import { trackEngagement, trackCall } from '../../utils/analytics';

const COMMUNITIES = [
  "Horseshoe Valley — resort and residential, ski country outdoor living",
  "Shanty Bay — Lake Simcoe waterfront estates",
  "Craighurst — rural properties and hobby farms",
  "Edgar / Rugby — estate lots with room for premium outdoor spaces",
  "Hawkestone — lakeside homes and established residential",
  "Moonstone — rural and recreational properties",
];

const SERVICES = [
  {
    title: "Interlocking Stone Patios & Driveways",
    desc: "Large-format interlocking installations suited to Oro-Medonte's estate-scale properties. Extended driveways, expansive patios, pool surrounds, and outdoor entertaining areas. Techo-Bloc, Permacon, and porcelain paver options.",
    link: "/services/interlocking-barrie",
  },
  {
    title: "Composite Decking",
    desc: "Multi-level composite decks designed for Oro-Medonte's sloped lots and lakefront views. TimberTech and Trex with custom railings, cable systems for unobstructed sight lines, and integrated In-Lite lighting.",
    link: "/services/composite-decking-barrie",
  },
  {
    title: "Retaining Walls",
    desc: "Engineered retaining walls that solve Oro-Medonte's elevation challenges. Armour stone for natural aesthetics, modular block for structural applications, and tiered wall systems for steep grades.",
    link: "/services/retaining-walls-barrie",
  },
  {
    title: "Landscape Design",
    desc: "Complete outdoor living design for properties that demand more than a standard patio. We account for topography, drainage patterns, existing vegetation, and how the space connects to the home's architecture.",
    link: "/services/landscape-design-barrie",
  },
];

const PRICING = [
  { project: "Estate patio (400-800 sq ft)", range: "$25,000 – $55,000" },
  { project: "Full outdoor living space", range: "$60,000 – $160,000+" },
  { project: "Composite deck with view (300-500 sq ft)", range: "$20,000 – $45,000" },
  { project: "Retaining wall system (50-100+ linear ft)", range: "$15,000 – $40,000" },
  { project: "Extended driveway (600-1200 sq ft)", range: "$35,000 – $65,000" },
];

const FAQS = [
  {
    q: "Do Oro-Medonte projects require special permits?",
    a: "Permit and zoning requirements depend on wall height, setbacks, grading, and property location. Oro-Medonte's current zoning by-law treats retaining walls 1 metre or higher as accessory structures subject to applicable provisions. Waterfront and conservation-regulated properties may require additional approval. Confirm site-specific requirements with the Township and conservation authority before construction.",
  },
  {
    q: "Is there a travel charge for Oro-Medonte?",
    a: "No. Oro-Medonte is within our core Simcoe County service area — no additional travel fees.",
  },
  {
    q: "Can you work on properties with septic systems?",
    a: "Yes. We locate septic beds and setbacks before design. All hardscape is planned to avoid septic infrastructure and maintain required clearances.",
  },
  {
    q: "How do you handle large properties with limited access?",
    a: "We bring equipment suited to the site. For properties with narrow access or long hauls from the road, we plan logistics during the design phase and price accordingly — no surprises at build time.",
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
  "description": "Premium landscaping and hardscape contractor serving Oro-Medonte, Ontario. Specializing in interlocking stone, composite decking, retaining walls, and landscape design for estate properties.",
  "url": "https://goldenmaplelandscaping.ca/locations/oro-medonte",
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
    "@type": "AdministrativeArea",
    "name": "Oro-Medonte",
    "url": "https://en.wikipedia.org/wiki/Oro-Medonte",
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

export default function OroMedonteLanding() {
  return (
    <div className="pt-32 pb-24 bg-brand-nearblack min-h-screen text-brand-bonewhite">
      <SEO
        title="Landscaping Contractor Oro-Medonte"
        description="Luxury outdoor living spaces for Oro-Medonte properties. Interlocking patios, composite decks & retaining walls. Built by Barrie's top-rated landscape team. Free quotes."
        canonical="https://goldenmaplelandscaping.ca/locations/oro-medonte"
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
              <MapPin size={16} /> Serving Oro-Medonte & Shanty Bay
            </span>
            <h1 className="font-display text-5xl md:text-7xl font-light mb-8 leading-tight">
              Premium Landscaping & Outdoor Living <br />
              <span className="text-brand-gold-dark italic">in Oro-Medonte, Ontario.</span>
            </h1>
            <p className="font-sans text-lg text-brand-muted leading-relaxed font-light mb-6 max-w-3xl">
              Oro-Medonte is home to some of Simcoe County's finest properties — and they deserve outdoor spaces to match. Golden Maple Landscaping brings premium hardscape construction to Oro-Medonte's estate lots, lakefront homes, and rural retreats.
            </p>
            <p className="font-sans text-base text-brand-muted leading-relaxed font-light mb-12 max-w-3xl">
              Based in Barrie, we're minutes from most Oro-Medonte project sites. Our in-house crew handles every phase — no subcontractors, no shortcuts.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-5 mb-12">
              <Link
                to="/contact"
                onClick={() => trackEngagement('cta_click', 'oromedonte_hero_quote')}
                className="btn-primary py-4 px-10"
              >
                Request Your Free Oro-Medonte Quote
              </Link>
              <a
                href="tel:7055003581"
                onClick={() => trackCall('oromedonte_hero_phone')}
                className="flex items-center gap-3 font-sans text-base text-brand-gold-dark hover:text-brand-bonewhite transition-colors"
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
              Why Oro-Medonte Homeowners Choose <span className="text-brand-gold-dark italic">Golden Maple</span>
            </h2>
            <p className="font-sans text-base text-brand-muted font-light leading-relaxed mb-6 max-w-3xl">
              Oro-Medonte properties are unique. Larger lots, elevation changes, mature tree canopies, and lakefront exposure all require a contractor who designs around the land — not against it.
            </p>
            <ul className="space-y-3 mb-10 max-w-3xl">
              <li className="font-sans text-sm text-brand-muted font-light"><strong className="text-brand-bonewhite">Significant grade changes</strong> requiring engineered retaining walls and stepped patios</li>
              <li className="font-sans text-sm text-brand-muted font-light"><strong className="text-brand-bonewhite">Mature tree root zones</strong> that demand careful excavation and base design</li>
              <li className="font-sans text-sm text-brand-muted font-light"><strong className="text-brand-bonewhite">Lake Simcoe and Bass Lake waterfront</strong> with conservation authority requirements</li>
              <li className="font-sans text-sm text-brand-muted font-light"><strong className="text-brand-bonewhite">Long driveways</strong> needing durable interlocking that handles vehicle loads and plowing</li>
            </ul>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                "5.0-star rated across Google, HomeStars & Yelp",
                "Premium materials — Techo-Bloc, Permacon, TimberTech, In-Lite",
                "Full design service — 3D renders before we break ground",
                "Transparent pricing — detailed quotes, no hidden fees",
                "Built for the terrain — engineered bases, proper drainage",
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
              Our Services in <span className="text-brand-gold-dark italic">Oro-Medonte</span>
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
              Oro-Medonte Communities <span className="text-brand-gold-dark italic">We Serve</span>
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
              What Does Landscaping Cost <span className="text-brand-gold-dark italic">in Oro-Medonte?</span>
            </h2>
            <p className="font-sans text-sm text-brand-muted font-light mb-8">
              Oro-Medonte projects tend to run larger than typical Barrie residential work. Typical ranges:
            </p>
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
              Larger lots, elevation work, and remote access can increase costs. We provide detailed written quotes after a site visit. Use our <Link to="/cost-estimator?city=oro-medonte" className="text-brand-gold-dark hover:underline">Cost Estimator</Link> for a quick ballpark.
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
              Get Your Free Oro-Medonte Landscaping Quote
            </h2>
            <p className="font-sans text-brand-muted font-light mb-10 max-w-2xl mx-auto">
              Ready to create an outdoor space that matches your property? Contact Golden Maple Landscaping for a free site visit and detailed quote.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-8">
              <Link to="/contact" className="btn-primary py-4 px-10">Request a Quote</Link>
              <a href="tel:7055003581" onClick={() => trackCall('oromedonte_phone')} className="flex items-center gap-3 font-sans text-sm text-brand-gold-dark hover:text-brand-bonewhite transition-colors">
                <Phone size={16} /> 705-500-3581
              </a>
            </div>
            <a href="mailto:yorkis@goldenmaplelandscaping.ca" className="flex items-center justify-center gap-3 font-sans text-sm text-brand-muted hover:text-brand-gold-dark transition-colors">
              <Mail size={16} /> yorkis@goldenmaplelandscaping.ca
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
