import { Helmet } from 'react-helmet-async';
import { motion } from 'motion/react';
import { MapPin, CheckCircle, ArrowRight, Phone, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../../components/SEO';

const COMMUNITIES = [
  "Midhurst — Springwater's fastest-growing community, new builds",
  "Elmvale — established residential and rural-edge properties",
  "Minesing — semi-rural homes with room for large outdoor projects",
  "Anten Mills — rural properties and estate lots",
  "Snow Valley area — recreational properties and hillside builds",
  "Phelpston — rural residential and farmstead properties",
];

const SERVICES = [
  {
    title: "Interlocking Stone Patios & Driveways",
    desc: "Durable interlocking installations for Springwater properties — from compact new-build patios in Midhurst to extended estate driveways. Proper base preparation for local clay soil conditions. Techo-Bloc, Permacon, and porcelain paver options.",
    link: "/services/interlocking-barrie",
  },
  {
    title: "Composite Decking",
    desc: "Low-maintenance composite decks built for Springwater's outdoor lifestyle. TimberTech and Trex options with custom railings, built-in seating, and integrated lighting. Multi-level designs for properties with grade changes.",
    link: "/services/composite-decking-barrie",
  },
  {
    title: "Retaining Walls",
    desc: "Structural and decorative retaining walls for Springwater's varied terrain. Armour stone for natural aesthetics, modular block for structural grade changes, and tiered systems for sloped properties.",
    link: "/services/retaining-walls-barrie",
  },
  {
    title: "Landscape Design",
    desc: "Complete outdoor living design from initial concept to build-ready plans. We design around your property's existing features — mature trees, natural grades, well and septic locations.",
    link: "/services/landscape-design-barrie",
  },
];

const PRICING = [
  { project: "Interlocking patio (200-400 sq ft)", range: "$12,000 – $25,000" },
  { project: "Full backyard transformation", range: "$35,000 – $90,000" },
  { project: "Composite deck (200-350 sq ft)", range: "$15,000 – $35,000" },
  { project: "Retaining wall (30-60 linear ft)", range: "$8,000 – $20,000" },
  { project: "Extended rural driveway", range: "$25,000 – $55,000" },
  { project: "Premium outdoor living space", range: "$90,000 – $160,000+" },
];

const FAQS = [
  {
    q: "Do Springwater projects require permits?",
    a: "Most patio and deck projects don't require permits. Retaining walls over 1 metre require a building permit from Springwater Township. Properties near watercourses may need Nottawasaga Valley Conservation Authority (NVCA) approval. We handle all applications.",
  },
  {
    q: "Is there a travel charge for Springwater?",
    a: "No. Springwater is adjacent to Barrie and within our core service area — no travel fees.",
  },
  {
    q: "Can you work around well and septic systems?",
    a: "Absolutely. We locate all underground infrastructure during the design phase and maintain required setbacks. All hardscape is planned to keep septic access clear and avoid compromising your well.",
  },
  {
    q: "How do you handle clay soil in Springwater?",
    a: "Clay soil is common in Springwater and requires deeper excavation and geotextile fabric to prevent base contamination. We adjust base preparation specs for local soil conditions — this is factored into every quote.",
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
  "description": "Premium landscaping and hardscape contractor serving Springwater Township, Ontario. Specializing in interlocking stone, composite decking, retaining walls, and landscape design.",
  "url": "https://goldenmaplelandscaping.ca/locations/springwater",
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
    "name": "Springwater",
    "url": "https://en.wikipedia.org/wiki/Springwater,_Ontario",
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

export default function SpringwaterLanding() {
  return (
    <div className="pt-32 pb-24 bg-brand-nearblack min-h-screen text-brand-bonewhite">
      <SEO
        title="Landscaping & Outdoor Construction Springwater"
        description="Serving Springwater Township with premium hardscape & landscape construction. Driveways, patios, decks & walls. Local Simcoe County contractor. Free quotes."
        canonical="https://goldenmaplelandscaping.ca/locations/springwater"
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
              <MapPin size={16} /> Serving Springwater & Midhurst
            </span>
            <h1 className="font-display text-5xl md:text-7xl font-light mb-8 leading-tight">
              Premium Landscaping & Hardscape <br />
              <span className="text-brand-gold italic">Contractor in Springwater, Ontario.</span>
            </h1>
            <p className="font-sans text-lg text-brand-muted leading-relaxed font-light mb-6 max-w-3xl">
              Golden Maple Landscaping serves Springwater Township homeowners with premium outdoor construction — the same quality and precision we deliver across Simcoe County. From Midhurst to Elmvale to Anten Mills, we build hardscapes designed for Springwater's rural properties and growing residential communities.
            </p>
            <p className="font-sans text-base text-brand-muted leading-relaxed font-light mb-12 max-w-3xl">
              Based in Barrie, we're adjacent to Springwater's borders. No travel fees, no subcontractors — our in-house crew handles every project.
            </p>
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
              Why Springwater Homeowners Choose <span className="text-brand-gold italic">Golden Maple</span>
            </h2>
            <p className="font-sans text-base text-brand-muted font-light leading-relaxed mb-6 max-w-3xl">
              Springwater's blend of new subdivision development and established rural properties creates unique landscaping needs. We work with both:
            </p>
            <ul className="space-y-3 mb-10 max-w-3xl">
              <li className="font-sans text-sm text-brand-muted font-light"><strong className="text-brand-bonewhite">New construction in Midhurst</strong> — builder-grade lots transformed into premium outdoor spaces</li>
              <li className="font-sans text-sm text-brand-muted font-light"><strong className="text-brand-bonewhite">Rural estate properties</strong> — large-scale hardscaping with long driveways and expansive patios</li>
              <li className="font-sans text-sm text-brand-muted font-light"><strong className="text-brand-bonewhite">Established homes in Elmvale, Minesing</strong> — backyard renovations and front entry upgrades</li>
              <li className="font-sans text-sm text-brand-muted font-light"><strong className="text-brand-bonewhite">Hobby farms and acreages</strong> — functional and aesthetic hardscaping at scale</li>
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
                  <CheckCircle size={18} className="text-brand-gold shrink-0 mt-0.5" />
                  <span className="font-sans text-sm text-brand-muted font-light">{item}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Services */}
          <div className="mb-24">
            <h2 className="font-display text-3xl md:text-5xl text-brand-bonewhite mb-12">
              Our Services in <span className="text-brand-gold italic">Springwater</span>
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

          {/* Communities */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mb-24"
          >
            <h2 className="font-display text-3xl md:text-5xl text-brand-bonewhite mb-10">
              Springwater Communities <span className="text-brand-gold italic">We Serve</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {COMMUNITIES.map((c) => (
                <div key={c} className="flex items-start gap-3 bg-brand-surface p-4 border border-brand-dim/20 rounded-sm">
                  <MapPin size={16} className="text-brand-gold shrink-0 mt-0.5" />
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
              What Does Landscaping Cost <span className="text-brand-gold italic">in Springwater?</span>
            </h2>
            <p className="font-sans text-sm text-brand-muted font-light mb-8">
              Pricing is consistent with our Barrie rates. Rural properties with longer equipment hauls may see modest adjustments. Typical ranges:
            </p>
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
              Want a faster answer? Use our <Link to="/cost-estimator" className="text-brand-gold hover:underline">Cost Estimator</Link> for an instant ballpark.
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
              Get Your Free Springwater Landscaping Quote
            </h2>
            <p className="font-sans text-brand-muted font-light mb-10 max-w-2xl mx-auto">
              Ready to build the outdoor space your property deserves? Contact Golden Maple Landscaping for a free site visit and detailed quote.
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
