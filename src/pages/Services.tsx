import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { BUSINESS, publicClaimCopy } from '../data/business';
import { Grid, Hexagon, AlignJustify, ListTree, Layout, ChefHat, Flame, Sun, Leaf, Lightbulb, Map, ArrowRight, Layers } from 'lucide-react';
import SEO from '../components/SEO';
import PublicationTrustBar from '../components/PublicationTrustBar';
import Reveal from '../components/Reveal';
import ResponsiveImage from '../components/ResponsiveImage';
import { CARD_SIZES, categorySlug, coverForCategory, projectsInCategory, type ProjectCategory } from '../data/projects';

// `category` links a service to the attested portfolio register. A card only shows a
// photo when a real Golden Maple project exists in that category — never a catalog or
// AI image. Kitchens, fire features and lighting have no attested photo yet.
const SERVICE_CARDS: Array<{ id: string; title: string; desc: string; icon: typeof Grid; link: string; category?: ProjectCategory }> = [
  {
    id: 'interlocking',
    title: 'Interlocking Stone & Patios',
    desc: 'The patio where your family gathers, where summer memories happen. We build it on a foundation twice as deep as the industry standard.',
    icon: Grid,
    category: 'Patios & interlocking',
    link: '/services/interlocking-barrie'
  },
  {
    id: 'walls',
    title: 'Retaining Walls',
    desc: 'That slope in your yard isn\'t a problem — it\'s your home\'s best architectural feature waiting to happen.',
    icon: AlignJustify,
    category: 'Walls & steps',
    link: '/services/retaining-walls-barrie'
  },
  {
    id: 'design',
    title: 'Landscape Design',
    desc: 'Walk through your future backyard in vivid 3D. See it, refine it, love it — before we move a single stone.',
    icon: Map,
    category: 'Lakeside & cottage',
    link: '/services/landscape-design-barrie'
  },
  {
    id: 'decking',
    title: 'Composite Decking',
    desc: 'The look of real hardwood with none of the maintenance. No staining, no rotting — just decades of barefoot summer evenings.',
    icon: Layers,
    category: 'Decks',
    link: '/services/composite-decking-barrie'
  },
  {
    id: 'kitchens',
    title: 'Outdoor Kitchens',
    desc: 'Stop running in and out of the house. Cook, serve, and entertain in one seamless outdoor space.',
    icon: ChefHat,
    link: '/contact'
  },
  {
    id: 'firepits',
    title: 'Fire Features',
    desc: 'The gathering spot that turns a cool evening into the best part of your week. Your family\'s new favourite place.',
    icon: Flame,
    link: '/contact'
  },
  {
    id: 'lighting',
    title: 'Landscape Lighting',
    desc: 'Your outdoor space doesn\'t clock out at sunset. Professional lighting that makes your property feel alive after dark.',
    icon: Lightbulb,
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
      <PublicationTrustBar />
      
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
            {SERVICE_CARDS.map((service, idx) => {
              const cover = service.category ? coverForCategory(service.category) : undefined;
              const hasProjects = service.category ? projectsInCategory(service.category).length > 0 : false;
              return (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: idx * 0.1 }}
                className="bg-brand-surface rounded-[2px] border border-brand-dim/10 hover:border-brand-gold/30 transition-all duration-500 flex flex-col group shadow-2xl overflow-hidden"
              >
                {cover && (
                  <Link to={service.link} className="block overflow-hidden border-b border-brand-dim/10" aria-label={`${service.title}: see a completed project`}>
                    <ResponsiveImage image={cover} sizes={CARD_SIZES} aspect="3/2" className="transition-transform duration-700 motion-safe:group-hover:scale-[1.03]" />
                  </Link>
                )}
                <div className="p-12 flex flex-col flex-1">
                <div className="w-16 h-16 bg-brand-midsurface flex items-center justify-center rounded-[2px] text-brand-gold mb-10 group-hover:bg-brand-gold group-hover:text-brand-black transition-colors duration-500 border border-brand-dim/10">
                  <service.icon size={28} strokeWidth={1.5} />
                </div>
                <h2 className="font-display text-3xl font-light text-brand-bonewhite mb-6 group-hover:text-brand-gold-dark transition-colors leading-tight">{service.title}</h2>
                <p className="font-sans text-[15px] text-brand-muted leading-relaxed mb-10 flex-1 font-light">
                  {service.desc}
                </p>
                <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                  <Link
                    to={service.link}
                    className="flex items-center gap-4 text-brand-gold-dark font-sans text-xs uppercase tracking-[0.2em] group-hover:gap-6 transition-all font-medium"
                  >
                    <span>Explore Service</span>
                    <ArrowRight size={16} strokeWidth={1.5} />
                  </Link>
                  {hasProjects && service.category && (
                    <Link
                      to={`/portfolio?category=${categorySlug(service.category)}`}
                      className="font-sans text-xs uppercase tracking-[0.2em] text-brand-muted hover:text-brand-gold-dark transition-colors"
                    >
                      See projects
                    </Link>
                  )}
                </div>
                </div>
              </motion.div>
              );
            })}
          </div>
        </div>

        <div className="bg-brand-surface p-12 md:p-20 rounded-[2px] border border-brand-dim/10 text-center mb-40 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-px bg-brand-gold/30" />
          <h2 className="font-display text-3xl md:text-5xl font-light text-brand-bonewhite mb-8">Every project starts with a <span className="text-brand-gold-dark italic">conversation.</span></h2>
          <p className="font-sans text-lg text-brand-muted max-w-2xl mx-auto mb-12 font-light">
            Start with a project conversation. Current scope and timing are confirmed directly.
          </p>
          <Link to="/contact" className="btn-primary px-16 py-5">Get My Free Estimate</Link>
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
              <p className="font-sans text-sm text-brand-porcelain/80 leading-relaxed font-light">Drainage, soil, access, intended use, and local requirements inform project-specific site preparation and framing scope.</p>
            </div>
            <div className="space-y-6">
              <h3 className="font-display text-3xl font-light text-brand-gold">Project documentation</h3>
              <p className="font-sans text-sm text-brand-porcelain/80 leading-relaxed font-light">{publicClaimCopy(BUSINESS.credentials.wsib, 'Current coverage documentation is available.')} {publicClaimCopy(BUSINESS.credentials.liabilityInsurance, 'Current liability coverage documentation is available.')}</p>
            </div>
            <div className="space-y-6">
              <h3 className="font-display text-3xl font-light text-brand-gold">Written project terms</h3>
              <p className="font-sans text-base text-brand-porcelain/80 leading-relaxed font-light">Ask us for the current written workmanship terms and project-specific scope.</p>
            </div>
          </div>
          <Link to="/contact" className="btn-primary px-16 py-5">Let's Talk About Your Project</Link>
        </Reveal>
      </section>
    </div>
  );
}
