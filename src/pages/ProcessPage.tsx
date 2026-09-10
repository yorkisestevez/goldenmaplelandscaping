import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Compass, Shield, Heart, Ruler, Hammer, CheckCircle, ArrowRight } from 'lucide-react';
import SEO from '../components/SEO';

const PROCESS_STEPS = [
  {
    id: 'consultation',
    title: '01. Professional Consultation',
    desc: 'A project conversation to discuss your priorities, budget, and site considerations.',
    icon: Compass,
    link: '/process/consultation',
    img: '/images/projects/Golden Maple deck and walkway.jpg'
  },
  {
    id: 'site-assessment',
    title: '02. Site Analysis & Assessment',
    desc: 'Precision laser measurements, soil evaluation, and drainage analysis to ensure structural integrity.',
    icon: Ruler,
    link: '/process/site-assessment',
    img: '/images/projects/Golden Maple deck and walkway.jpg'
  },
  {
    id: '3d-design',
    title: '03. 3D Landscape Design',
    desc: 'Breathe life into your vision with high-resolution 3D renderings and architectural plans.',
    icon: Heart,
    link: '/process/3d-design',
    img: '/images/projects/Golden Maple deck and walkway.jpg'
  },
  {
    id: 'material-selection',
    title: '04. Curated Material Selection',
    desc: 'Material options are reviewed for the project scope and current availability.',
    icon: Shield,
    link: '/process/material-selection',
    img: '/images/projects/luxury decking.jpg'
  },
  {
    id: 'construction',
    title: '05. Engineered Construction',
    desc: 'Project-specific base, drainage, and site-management details confirmed in the written scope.',
    icon: Hammer,
    link: '/process/construction',
    img: '/images/projects/Golden Maple deck and walkway.jpg'
  },
  {
    id: 'completion',
    title: '06. Final Handover & Project Terms',
    desc: 'A final walkthrough and review of the current written project terms.',
    icon: CheckCircle,
    link: '/process/completion',
    img: '/images/projects/Silver Maple Radiance Rail 0101.jpg'
  }
];

export default function ProcessPage() {
  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO 
        title="Our Process | How We Build"
        description="Explore a project-planning process and confirm current scope, terms, and responsibilities with our team."
        canonical="https://goldenmaplelandscaping.ca/process"
      />
      
      <section className="section-padding pt-48">
        <div className="container-custom">
          <div className="max-w-4xl mb-32">
            <span className="font-sans text-xs tracking-[0.4em] uppercase text-brand-gold-dark mb-8 block">
              The Golden Maple Standard
            </span>
            <h1 className="font-display text-5xl md:text-8xl font-light text-brand-bonewhite leading-[1.05] mb-12">
              A Process Rooted in <br />
              <span className="italic text-brand-gold-dark">Engineering & Precision.</span>
            </h1>
            <p className="font-sans text-xl text-brand-muted leading-relaxed font-light max-w-2xl">
              Luxury outdoor living is not accidental. It is the result of meticulous planning, transparent communication, and a refusal to cut corners where it matters most.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {PROCESS_STEPS.map((step, idx) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: idx * 0.1 }}
                className="group bg-brand-surface border border-brand-dim/10 rounded-[2px] overflow-hidden hover:border-brand-gold/30 transition-all duration-500 flex flex-col h-full"
              >
                <div className="aspect-video relative overflow-hidden">
                  <img
                    src={step.img}
                    alt={`${step.title} — Golden Maple Landscaping process step`}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700"
                  />
                  <div className="absolute inset-0 bg-brand-black/40" />
                </div>
                <div className="p-12 flex flex-col flex-1">
                  <step.icon className="text-brand-gold mb-8" size={32} strokeWidth={1.5} />
                  <h2 className="font-display text-3xl font-light text-brand-bonewhite mb-6 leading-tight">{step.title}</h2>
                  <p className="font-sans text-base text-brand-muted leading-relaxed font-light mb-10 flex-1">
                    {step.desc}
                  </p>
                  <Link 
                    to={step.link} 
                    className="flex items-center gap-4 text-brand-gold-dark font-sans text-xs uppercase tracking-widest group-hover:gap-6 transition-all font-medium py-2"
                  >
                    <span>View Phase Details</span>
                    <ArrowRight size={16} strokeWidth={1.5} />
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-padding bg-brand-burgundy text-brand-porcelain">
        <div className="container-custom text-center">
          <h2 className="font-display text-4xl md:text-8xl font-light mb-12 leading-tight">
            Ready to experience <br />
            <span className="text-brand-gold italic">the Golden Maple way?</span>
          </h2>
          <p className="font-sans text-lg text-brand-porcelain/80 max-w-2xl mx-auto mb-16 font-light leading-relaxed">
            Start with a project conversation to confirm the current consultation scope and discuss your property.
          </p>
          <Link to="/contact" className="btn-primary px-20 py-5">Tell Us Your Budget</Link>
        </div>
      </section>
    </div>
  );
}
