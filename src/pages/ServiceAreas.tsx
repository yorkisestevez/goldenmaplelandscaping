import { motion } from 'motion/react';
import { MapPin, CheckCircle, ArrowRight } from 'lucide-react';
import SEO from '../components/SEO';
import { Link } from 'react-router-dom';

const AREAS: { name: string; desc: string; slug: string | null }[] = [
  { name: "Barrie", desc: "Our primary service hub for interlocking and landscape design.", slug: "barrie" },
  { name: "Innisfil", desc: "Premium backyard renovations and retaining walls in Innisfil, ON.", slug: "innisfil" },
  { name: "Oro-Medonte", desc: "Custom hardscape construction for rural and lakeside properties.", slug: "oro-medonte" },
  { name: "Springwater", desc: "Premium outdoor construction for Midhurst, Elmvale & Springwater Township.", slug: "springwater" },
  { name: "Angus", desc: "Professional landscaping and interlocking stone services in Angus.", slug: null },
  { name: "Orillia", desc: "Expert landscape design and construction in the Orillia area.", slug: null },
  { name: "Shanty Bay", desc: "Bespoke outdoor living spaces for Shanty Bay estates.", slug: null },
  { name: "Cottage Country", desc: "Serving Muskoka and surrounding areas for large-scope projects.", slug: null },
];

export default function ServiceAreas() {
  return (
    <div className="pt-32 bg-brand-black min-h-screen">
      <SEO 
        title="Service Areas | Barrie & Simcoe County"
        description="Golden Maple Landscaping serves Barrie, Innisfil, Oro-Medonte, Springwater, Angus, Orillia, and surrounding areas in Simcoe County. Premium interlocking and landscape design."
        canonical="https://goldenmaplelandscaping.ca/service-areas"
      />
      
      <div className="max-w-[1200px] mx-auto px-6 md:px-12 py-24">
        <div className="text-center max-w-3xl mx-auto mb-24">
          <div className="font-sans text-[10px] tracking-[0.35em] uppercase text-brand-gold mb-8">
            Service Areas
          </div>
          <h1 className="font-display text-5xl md:text-7xl leading-[1.1] mb-10 text-brand-bone">
            Landscaping <br />
            <span className="italic text-brand-gold text-4xl md:text-6xl">Simcoe County & Cottage Country.</span>
          </h1>
          <p className="font-sans font-light text-lg text-brand-muted leading-[1.8]">
            Golden Maple Landscaping is proud to serve homeowners across Simcoe County and the surrounding Cottage Country. We extend our services to these regions for projects where the scope aligns with our signature architectural standards.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-32">
          {AREAS.map((area, idx) => (
            <motion.div
              key={area.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: idx * 0.1 }}
              className="bg-brand-dark border border-brand-gold/10 p-8 rounded-[2px] flex flex-col hover:border-brand-gold/40 transition-all group"
            >
              <div className="text-brand-gold mb-6 group-hover:scale-110 transition-transform duration-500">
                <MapPin size={32} strokeWidth={1.5} />
              </div>
              <h2 className="font-display text-2xl text-brand-bone mb-4">{area.name}</h2>
              <p className="font-sans font-light text-[14px] text-brand-muted leading-[1.6] mb-8 flex-1">
                {area.desc}
              </p>
              <Link
                to={area.slug ? `/locations/${area.slug}` : "/contact"}
                className="flex items-center gap-4 text-brand-gold font-sans text-[10px] uppercase tracking-[0.3em] group-hover:gap-6 transition-all"
              >
                <span>{area.slug ? "Learn More" : "Request Quote"}</span>
                <ArrowRight size={14} />
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 md:gap-24 items-center mb-32">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="font-display text-4xl md:text-6xl leading-[1.1] mb-10 text-brand-bone">
              Landscaping <br />
              <span className="italic text-brand-gold">Near Me in Barrie.</span>
            </h2>
            <p className="font-sans font-light text-lg text-brand-muted leading-[1.8] mb-12">
              Searching for "landscaping near me" in Barrie? Golden Maple Landscaping is a locally owned and operated company with deep roots in the community. We understand the local soil conditions, climate challenges, and architectural styles of Simcoe County.
            </p>
            <ul className="space-y-6 mb-12">
              {[
                "Locally Owned & Operated",
                "Deep Knowledge of Simcoe County Soil",
                "Familiar with Local Permit Requirements",
                "Responsive Local Customer Support",
                "On-Site Consultations in 48 Hours"
              ].map((item, idx) => (
                <li key={idx} className="flex items-center gap-4 text-brand-bone font-sans font-light">
                  <CheckCircle size={18} className="text-brand-gold shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Link to="/contact" className="btn-primary px-12 py-5">Book Your Design Consultation</Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative h-[400px] md:h-[600px] rounded-[2px] overflow-hidden"
          >
            <img
              src="/images/projects/orillia-walkway.jpg"
              alt="Landscaping Service Areas in Simcoe County"
              className="w-full h-full object-cover grayscale-[20%] contrast-[110%]"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-brand-black/20" />
            <div className="absolute inset-0 border border-brand-gold/10" />
          </motion.div>
        </div>

        <div className="text-center bg-brand-deeper p-16 border border-brand-gold/10 rounded-[2px]">
          <h2 className="font-display text-4xl text-brand-bone mb-8">Serving your neighborhood.</h2>
          <p className="font-sans font-light text-brand-muted mb-12 max-w-2xl mx-auto">
            Contact Golden Maple Landscaping today to schedule a design consultation. We serve Barrie, Simcoe County, and surrounding Cottage Country communities where project scope aligns with our expertise.
          </p>
          <Link to="/contact" className="btn-primary px-12 py-5">Discuss Your Property</Link>
        </div>
      </div>
    </div>
  );
}
