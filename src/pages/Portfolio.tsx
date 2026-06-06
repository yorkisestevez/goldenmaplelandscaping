import { motion } from 'motion/react';
import { ArrowRight, Grid, AlignJustify, Map } from 'lucide-react';
import SEO from '../components/SEO';
import Reveal from '../components/Reveal';
import { Link } from 'react-router-dom';

const PROJECTS = [
  {
    id: 1,
    slug: "shanty-bay-estate",
    title: "The Shanty Bay Estate",
    category: "Full Transformation",
    desc: "A sprawling lakeside estate transformation featuring multi-level porcelain terraces and custom structural walls.",
    img: "/images/projects/IMG_4826.jpg"
  },
  {
    id: 2,
    slug: "bradford-modern-pergola",
    title: "Bradford Modern Pergola",
    category: "Hardscape Design",
    desc: "Clean geometric lines meet functional luxury with this integrated patio and custom pergola system.",
    img: "/images/projects/patio-pergola.jpg"
  },
  {
    id: 3,
    slug: "innisfil-lakeside-retreat",
    title: "Innisfil Lakeside Retreat",
    category: "Outdoor Living",
    desc: "A year-round outdoor sanctuary featuring a covered patio and integrated outdoor kitchen foundations.",
    img: "/images/projects/covered patio.JPG"
  },
  {
    id: 4,
    slug: "barrie-heights-structural",
    title: "Barrie Heights Structural",
    category: "Retaining Walls",
    desc: "Precision-engineered retaining walls that reclaimed massive elevation changes for functional garden space.",
    img: "/images/projects/garden-wall.JPEG"
  },
  {
    id: 5,
    slug: "orillia-premium-walkway",
    title: "Orillia Premium Walkway",
    category: "Interlocking Stone",
    desc: "Curated interlocking stone walkway that brings architectural curb appeal to a modern Orillia residence.",
    img: "/images/projects/orillia-walkway.jpg"
  },
  {
    id: 6,
    slug: "simcoe-county-driveway",
    title: "Simcoe County Driveway",
    category: "Interlocking Stone",
    desc: "Heavy-duty driveway installation engineered with our 16\" base standard for lifetime durability.",
    img: "/images/projects/paver-driveway.JPG"
  },
  {
    id: 7,
    slug: "silver-maple-radiance",
    title: "Silver Maple Radiance",
    category: "Composite Decking",
    desc: "A premium TimberTech deck installation featuring the Silver Maple Radiance Rail system for modern lakeside aesthetics.",
    img: "/images/projects/Silver Maple Radiance Rail 0101.jpg"
  },
  {
    id: 8,
    slug: "luxury-outdoor-kitchen",
    title: "Luxury Outdoor Kitchen",
    category: "Outdoor Living",
    desc: "Custom outdoor kitchen build in Bradford, featuring high-end grilling stations and built-in refrigeration.",
    img: "/images/projects/luxury outdoor kitchen.jpeg"
  },
  {
    id: 9,
    slug: "cousy-fire-feature",
    title: "Cozy Fire Feature",
    category: "Hardscape Design",
    desc: "A custom-built fire pit area designed for intimate gatherings and evening ambiance in Shanty Bay.",
    img: "/images/projects/cousy fire feature.jpeg"
  },
  {
    id: 10,
    slug: "front-entrance-grandeur",
    title: "Front Entrance Grandeur",
    category: "Interlocking Stone",
    desc: "An architectural front entrance design that combines natural stone textures with modern paving patterns.",
    img: "/images/projects/Front-entrance-idea-pavers.JPG"
  },
  {
    id: 11,
    slug: "lakeside-pool-decking",
    title: "Paver Patio & Pergola",
    category: "Hardscape Design",
    desc: "A Permacon paver patio with a cedar pergola and built-in seating — a complete backyard living space on a deep, freeze-thaw-proof base.",
    img: "/images/projects/patio-pergola.jpg"
  },
  {
    id: 12,
    slug: "architectural-visuals",
    title: "Architectural Visuals",
    category: "Landscape Design",
    desc: "High-fidelity 3D renderings that bring our clients' visions to life before breaking ground on their dream project.",
    img: "/images/projects/rendering1.jpg"
  }
];

export default function Portfolio() {
  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO 
        title="Landscaping Portfolio | Barrie Projects"
        description="Browse completed interlocking patios, decks, retaining walls & outdoor living spaces across Barrie and Simcoe County. See the quality before you commit."
        canonical="https://goldenmaplelandscaping.ca/portfolio"
      />
      
      <section className="section-padding pt-48">
        <div className="container-custom">
          <Reveal className="text-center max-w-3xl mx-auto mb-32">
            <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold mb-10 block">
              Our Portfolio
            </span>
            <h1 className="font-display text-5xl md:text-8xl font-light text-brand-bonewhite leading-[1.05] mb-12">
              Landscaping Project <br />
              <span className="italic text-brand-gold">Gallery in Barrie.</span>
            </h1>
            <p className="font-sans text-lg text-brand-muted leading-relaxed font-light">
              Explore our collection of premium outdoor transformations. From structural engineering to aesthetic mastery, our work reflects our commitment to quality and craftsmanship.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 mb-40">
            {PROJECTS.map((project, idx) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: idx * 0.1 }}
              >
                <Link to={`/portfolio/${project.slug}`} className="group relative h-[650px] rounded-[2px] overflow-hidden cursor-pointer shadow-2xl border border-brand-dim/10 block">
                <img
                  src={project.img}
                  alt={project.title}
                  className="w-full h-full object-cover contrast-[110%] transition-transform duration-1000 group-hover:scale-110 opacity-80 group-hover:opacity-100"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-nearblack via-brand-nearblack/40 to-transparent opacity-90 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="absolute inset-0 p-12 flex flex-col justify-end">
                  <span className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-gold mb-6 block">
                    {project.category}
                  </span>
                  <h3 className="font-display text-4xl font-light text-brand-bonewhite mb-6 group-hover:text-brand-gold transition-colors duration-500 leading-tight">
                    {project.title}
                  </h3>
                  <p className="font-sans text-sm text-brand-muted leading-relaxed mb-10 opacity-0 translate-y-6 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-700 ease-[0.16, 1, 0.3, 1] font-light">
                    {project.desc}
                  </p>
                  <div className="flex items-center gap-6 text-brand-gold font-sans text-[10px] uppercase tracking-[0.3em]">
                    <span>View Project</span>
                    <div className="w-10 h-px bg-brand-gold group-hover:w-16 transition-all duration-500" />
                  </div>
                </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-padding bg-brand-burgundy text-brand-bonewhite">
        <Reveal className="container-custom text-center">
          <h2 className="font-display text-4xl md:text-8xl font-light mb-12 leading-tight">
            Your backyard could <br />
            <span className="text-brand-gold italic">be next.</span>
          </h2>
          <p className="font-sans text-lg text-brand-bonewhite/80 max-w-2xl mx-auto mb-16 font-light">
            Every project in this gallery started with a single conversation. Tell us what you're imagining — we'll show you what's possible.
          </p>
          <Link to="/contact" className="btn-primary px-20">Let's Talk About Your Property</Link>
        </Reveal>
      </section>
    </div>
  );
}
