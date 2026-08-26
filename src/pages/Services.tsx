import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Grid, Hexagon, AlignJustify, ListTree, Layout, ChefHat, Flame, Sun, Leaf, Lightbulb, Map, ArrowRight, Layers } from 'lucide-react';
import SEO from '../components/SEO';
import Reveal from '../components/Reveal';

const SERVICE_CARDS = [
  {
    id: 'interlocking',
    title: 'Interlocking Stone & Patios',
    desc: 'The patio where your family gathers, where summer memories happen. We build it on a foundation twice as deep as the industry standard.',
    icon: Grid,
    img: '/images/projects/IMG_4826.jpg',
    link: '/services/interlocking-barrie'
  },
  {
    id: 'walls',
    title: 'Retaining Walls',
    desc: 'That slope in your yard isn\'t a problem — it\'s your home\'s best architectural feature waiting to happen.',
    icon: AlignJustify,
    img: '/images/projects/garden-wall.JPEG',
    link: '/services/retaining-walls-barrie'
  },
  {
    id: 'design',
    title: 'Landscape Design',
    desc: 'Walk through your future backyard in vivid 3D. See it, refine it, love it — before we move a single stone.',
    icon: Map,
    img: '/images/projects/rendering1.jpg',
    link: '/services/landscape-design-barrie'
  },
  {
    id: 'decking',
    title: 'Composite Decking',
    desc: 'The look of real hardwood with none of the maintenance. No staining, no rotting — just decades of barefoot summer evenings.',
    icon: Layers,
    img: '/images/projects/TimberTech Dark Cocoa PrimeCollection Composite Decking Beauty1.jpg',
    link: '/services/composite-decking-barrie'
  },
  {
    id: 'kitchens',
    title: 'Outdoor Kitchens',
    desc: 'Stop running in and out of the house. Cook, serve, and entertain in one seamless outdoor space.',
    icon: ChefHat,
    img: '/images/projects/luxury outdoor kitchen.jpeg',
    link: '/contact'
  },
  {
    id: 'firepits',
    title: 'Fire Features',
    desc: 'The gathering spot that turns a cool evening into the best part of your week. Your family\'s new favourite place.',
    icon: Flame,
    img: '/images/projects/cousy fire feature.jpeg',
    link: '/contact'
  },
  {
    id: 'lighting',
    title: 'Landscape Lighting',
    desc: 'Your outdoor space doesn\'t clock out at sunset. Professional lighting that makes your property feel alive after dark.',
    icon: Lightbulb,
    img: '/images/projects/IHPX8926.JPEG',
    link: '/contact'
  }
];

export default function Services() {
  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO 
        title="Landscaping Services in Barrie"
        description="Interlocking stone, composite decking, retaining walls & landscape design. Premium outdoor construction for Barrie & Simcoe County homeowners. View our services."
        canonical="https://goldenmaplelandscaping.ca/services"
      />
      
      <section className="section-padding pt-48">
        <div className="container-custom">
          <Reveal className="text-center max-w-3xl mx-auto mb-32">
            <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-10 block">
              Our Expertise
            </span>
            <h1 className="font-display text-5xl md:text-8xl font-light text-brand-bonewhite leading-[1.05] mb-12">
              Landscaping Services <br />
              <span className="italic text-brand-gold-dark">in Barrie ON.</span>
            </h1>
            <p className="font-sans text-lg text-brand-muted leading-relaxed font-light">
              From interlocking stone driveways to complex multi-level retaining walls, we provide the engineering and craftsmanship your property deserves.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 mb-40">
            {SERVICE_CARDS.map((service, idx) => (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: idx * 0.1 }}
                className="bg-brand-surface p-12 rounded-[2px] border border-brand-dim/10 hover:border-brand-gold/30 transition-all duration-500 flex flex-col group shadow-2xl"
              >
                <div className="w-16 h-16 bg-brand-midsurface flex items-center justify-center rounded-[2px] text-brand-gold mb-10 group-hover:bg-brand-gold group-hover:text-brand-black transition-colors duration-500 border border-brand-dim/10">
                  <service.icon size={28} strokeWidth={1.5} />
                </div>
                <h2 className="font-display text-3xl font-light text-brand-bonewhite mb-6 group-hover:text-brand-gold-dark transition-colors leading-tight">{service.title}</h2>
                <p className="font-sans text-[15px] text-brand-muted leading-relaxed mb-10 flex-1 font-light">
                  {service.desc}
                </p>
                <Link 
                  to={service.link} 
                  className="flex items-center gap-4 text-brand-gold-dark font-sans text-xs uppercase tracking-[0.2em] group-hover:gap-6 transition-all font-medium"
                >
                  <span>Explore Service</span>
                  <ArrowRight size={16} strokeWidth={1.5} />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="bg-brand-surface p-12 md:p-20 rounded-[2px] border border-brand-dim/10 text-center mb-40 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-px bg-brand-gold/30" />
          <h2 className="font-display text-3xl md:text-5xl font-light text-brand-bonewhite mb-8">Every project starts with a <span className="text-brand-gold-dark italic">conversation.</span></h2>
          <p className="font-sans text-lg text-brand-muted max-w-2xl mx-auto mb-12 font-light">
            Free estimate · 24-hour response · No sales call required.
          </p>
          <Link to="/contact" className="btn-primary px-16 py-5">Get My Estimate</Link>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-40 h-px bg-brand-gold/30" />
        </div>
      </section>

      <section className="section-padding bg-brand-burgundy text-brand-porcelain">
        <Reveal className="container-custom text-center">
          <h2 className="font-display text-4xl md:text-8xl font-light mb-20 leading-tight">
            The Golden Maple <br />
            <span className="text-brand-gold italic">Standard.</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-20 max-w-6xl mx-auto mb-24">
            <div className="space-y-6">
              <h3 className="font-display text-3xl font-light text-brand-gold">Structural Integrity</h3>
              <p className="font-sans text-sm text-brand-porcelain/80 leading-relaxed font-light">From 12–16" deep interlocking bases to code-exceeding deck framing, we build for the Canadian climate.</p>
            </div>
            <div className="space-y-6">
              <h3 className="font-display text-3xl font-light text-brand-gold">WSIB & $5M</h3>
              <p className="font-sans text-sm text-brand-porcelain/80 leading-relaxed font-light">Full protection for our team and your property on every single job site.</p>
            </div>
            <div className="space-y-6">
              <h3 className="font-display text-3xl font-light text-brand-gold">5-Year Warranty</h3>
              <p className="font-sans text-base text-brand-porcelain/80 leading-relaxed font-light">A 5-year sink and settlement warranty on all craftsmanship, reflecting our confidence in our 12–16" base depth standards.</p>
            </div>
          </div>
          <Link to="/contact" className="btn-primary px-16 py-5">Let's Talk About Your Project</Link>
        </Reveal>
      </section>
    </div>
  );
}
