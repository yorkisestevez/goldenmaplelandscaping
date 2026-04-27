import { useParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, MapPin, Calendar, Ruler, Shield } from 'lucide-react';
import SEO from '../components/SEO';

interface ProjectData {
  slug: string;
  title: string;
  location: string;
  category: string;
  year: string;
  duration: string;
  investment: string;
  heroImg: string;
  images: string[];
  description: string;
  challenge: string;
  solution: string;
  specs: string[];
  testimonial?: { text: string; name: string; };
}

const PROJECT_DATA: Record<string, ProjectData> = {
  'shanty-bay-estate': {
    slug: 'shanty-bay-estate',
    title: 'The Shanty Bay Estate',
    location: 'Shanty Bay, ON',
    category: 'Full Transformation',
    year: '2025',
    duration: '6 weeks',
    investment: '$85,000+',
    heroImg: '/images/projects/best.JPEG',
    images: ['/images/projects/best.JPEG', '/images/projects/IMG_4826.jpg'],
    description: 'This sprawling lakeside estate required a complete outdoor living transformation. The homeowners wanted a space that matched the grandeur of their waterfront property — multi-level entertaining areas, seamless indoor-outdoor flow, and materials that could withstand decades of Simcoe County weather.',
    challenge: 'The property had severe grading issues with a 4-foot elevation drop from the back door to the lake. The existing landscape was mostly clay soil with poor drainage, causing water to pool against the foundation during spring thaw.',
    solution: 'We excavated to 16 inches across the entire project area, installed a full perforated drain tile system, and built three distinct living levels connected by custom stone steps with integrated lighting. The result is a resort-calibre outdoor space that handles water flawlessly and looks stunning year-round.',
    specs: ['16" compacted clear stone base', 'Unilock Beacon Hill Trio pavers', 'Allan Block retaining walls with geogrid', 'In-Lite LED landscape lighting system', 'Perforated drain tile drainage system', 'Custom natural stone steps'],
    testimonial: { text: 'We got three quotes. Two contractors wanted to dig 6 inches. Yorkis said he\'d go 14. Three winters later, not a single stone has moved.', name: 'Michael R.' }
  },
  'bradford-modern-pergola': {
    slug: 'bradford-modern-pergola',
    title: 'Bradford Modern Pergola',
    location: 'Bradford, ON',
    category: 'Hardscape Design',
    year: '2025',
    duration: '4 weeks',
    investment: '$45,000+',
    heroImg: '/images/projects/patio-pergola.png',
    images: ['/images/projects/patio-pergola.png'],
    description: 'A modern outdoor living space that bridges the gap between traditional landscaping and contemporary architecture. The homeowners wanted clean geometric lines, a covered area for all-weather entertaining, and a patio surface that would never need maintenance.',
    challenge: 'The backyard was narrow with limited space, requiring a design that maximized every square foot without feeling cramped. The existing concrete slab was cracked and uneven from years of frost heave.',
    solution: 'We removed the old concrete, excavated to full depth, and designed a multi-zone layout that creates the illusion of a much larger space. The modern pergola provides shade and rain protection while the interlocking stone base is engineered for permanent stability.',
    specs: ['14" compacted clear stone base', 'Techo-Bloc Blu Grande slabs', 'Custom aluminum pergola structure', 'Integrated LED strip lighting', 'Polymeric sand jointing', 'Stainless steel edge restraints'],
  },
  'innisfil-lakeside-retreat': {
    slug: 'innisfil-lakeside-retreat',
    title: 'Innisfil Lakeside Retreat',
    location: 'Innisfil, ON',
    category: 'Outdoor Living',
    year: '2024',
    duration: '5 weeks',
    investment: '$65,000+',
    heroImg: '/images/projects/covered patio.JPG',
    images: ['/images/projects/covered patio.JPG'],
    description: 'A year-round lakeside sanctuary designed for a family who wanted to enjoy their waterfront property in every season. The covered patio creates a protected entertaining space while the surrounding hardscape extends the usable outdoor area dramatically.',
    challenge: 'Lakeside properties in Innisfil face unique soil conditions — sandy topsoil over clay, with a high water table. Traditional base preparation wouldn\'t be sufficient for long-term stability.',
    solution: 'We used a modified base system with geotextile separation fabric, oversized clear stone, and additional compaction passes. The covered structure is anchored to concrete footings below the frost line to prevent any movement from freeze-thaw cycles.',
    specs: ['16" clear stone base with geotextile', 'Unilock EnduraColor pavers', 'Custom covered patio structure', 'Concrete footings below frost line', 'Integrated ceiling fans and lighting', 'Natural gas line for future kitchen'],
    testimonial: { text: 'Yorkis showed us the 3D render and I literally started tearing up — it was the exact space I\'d been dreaming about since we moved to Innisfil.', name: 'Sarah L.' }
  },
  'barrie-heights-structural': {
    slug: 'barrie-heights-structural',
    title: 'Barrie Heights Structural',
    location: 'Barrie, ON',
    category: 'Retaining Walls',
    year: '2025',
    duration: '3 weeks',
    investment: '$35,000+',
    heroImg: '/images/projects/garden-wall.JPEG',
    images: ['/images/projects/garden-wall.JPEG'],
    description: 'A challenging structural project that transformed a steep, unusable hillside into multi-level garden terraces. The homeowners had been told by two other contractors that their slope was "too steep to do anything with." We disagreed.',
    challenge: 'A 6-foot elevation change over a 12-foot horizontal run, with clay soil and mature trees that needed to be preserved. The retaining wall system needed to handle significant lateral soil pressure while maintaining the existing tree root zones.',
    solution: 'We designed a two-tier wall system with geogrid reinforcement at every third course, a full drainage system behind each wall, and careful excavation around existing root zones. The result reclaimed over 400 square feet of flat, usable garden space.',
    specs: ['Allan Block retaining wall system', 'Geogrid reinforcement every 3rd course', 'Full perforated drain tile system', '24" clear stone drainage zone', 'Root zone protection protocols', 'Architectural cap stones'],
  },
  'orillia-premium-walkway': {
    slug: 'orillia-premium-walkway',
    title: 'Orillia Premium Walkway',
    location: 'Orillia, ON',
    category: 'Interlocking Stone',
    year: '2024',
    duration: '2 weeks',
    investment: '$22,000+',
    heroImg: '/images/projects/orillia-walkway.png',
    images: ['/images/projects/orillia-walkway.png'],
    description: 'A front walkway that transformed the entire curb appeal of this modern Orillia home. The original concrete path was cracked, stained, and detracted from an otherwise beautiful property.',
    challenge: 'The existing walkway had a grade issue that directed water toward the front door. The homeowner wanted a dramatic improvement without disrupting established garden beds on either side.',
    solution: 'We carefully removed the old concrete, re-graded the subbase to correct the drainage, and installed a sweeping curved walkway with accent borders. The new drainage pattern moves water away from the home and into a dry well system.',
    specs: ['12" compacted clear stone base', 'Techo-Bloc Blu 60mm pavers', 'Accent border in contrasting colour', 'Corrected drainage grading', 'Dry well drainage system', 'LED path lighting integration'],
  },
  'simcoe-county-driveway': {
    slug: 'simcoe-county-driveway',
    title: 'Simcoe County Driveway',
    location: 'Simcoe County, ON',
    category: 'Interlocking Stone',
    year: '2025',
    duration: '3 weeks',
    investment: '$40,000+',
    heroImg: '/images/projects/paver-driveway.JPG',
    images: ['/images/projects/paver-driveway.JPG'],
    description: 'A heavy-duty interlocking driveway designed to handle daily vehicle traffic, snow plows, and decades of Simcoe County weather. The homeowner wanted to replace their deteriorating asphalt driveway with something that would last indefinitely.',
    challenge: 'Driveways take significantly more abuse than patios — vehicle weight, turning forces, plow blades, and salt exposure. The base system needs to be engineered for vehicular loads, not just pedestrian traffic.',
    solution: 'We used our maximum 16-inch base depth with H-pattern herringbone paver layout (the strongest interlock pattern for driveways). The edge restraints are heavy-duty aluminum pinned to the base, and we used high-traffic polymeric sand rated for vehicular applications.',
    specs: ['16" compacted granular base', 'Permacon 80mm driveway pavers', 'Herringbone H-pattern for maximum interlock', 'Heavy-duty aluminum edge restraints', 'Vehicular-grade polymeric sand', 'Proper crown for water runoff'],
  },
  'silver-maple-radiance': {
    slug: 'silver-maple-radiance',
    title: 'Silver Maple Radiance',
    location: 'Barrie, ON',
    category: 'Composite Decking',
    year: '2024',
    duration: '3 weeks',
    investment: '$38,000+',
    heroImg: '/images/projects/Silver Maple Radiance Rail 0101.jpg',
    images: ['/images/projects/Silver Maple Radiance Rail 0101.jpg'],
    description: 'A premium TimberTech deck installation that showcases what modern composite decking can achieve. The Silver Maple colour with Radiance Rail system creates a contemporary lakeside aesthetic that will never need staining or maintenance.',
    challenge: 'The homeowners had a 15-year-old pressure-treated deck that was warped, splintering, and had soft spots from rot. They wanted a replacement that would never need the annual maintenance burden they\'d been dealing with.',
    solution: 'We removed the old deck entirely, inspected and reinforced the substructure, and installed TimberTech AZEK decking with the Radiance Rail system. The hidden fastener system creates a clean, screw-free surface.',
    specs: ['TimberTech AZEK Vintage Collection', 'Silver Maple colour board', 'Radiance Rail system', 'Hidden fastener installation', 'Reinforced substructure', '50-year manufacturer warranty'],
  },
  'luxury-outdoor-kitchen': {
    slug: 'luxury-outdoor-kitchen',
    title: 'Luxury Outdoor Kitchen',
    location: 'Bradford, ON',
    category: 'Outdoor Living',
    year: '2025',
    duration: '5 weeks',
    investment: '$55,000+',
    heroImg: '/images/projects/luxury outdoor kitchen.jpeg',
    images: ['/images/projects/luxury outdoor kitchen.jpeg'],
    description: 'A fully functional outdoor kitchen that changed how this Bradford family entertains. Complete with built-in grill, refrigeration, prep counter, and bar seating — all on a structural base designed for permanence.',
    challenge: 'Outdoor kitchens involve gas lines, electrical, structural veneers, and countertops — all of which need perfect base stability. Any settling can crack gas connections, misalign countertops, and create safety hazards.',
    solution: 'We built the kitchen island on a reinforced concrete pad with 16 inches of clear stone base underneath. All gas and electrical were run during the base phase, and the granite countertops were templated after the structure was fully cured.',
    specs: ['16" base with concrete pad foundation', 'Natural gas line installation (TSSA permitted)', 'Granite countertops (Dekton alternative available)', 'Built-in Weber Summit grill', 'Stainless steel refrigeration', 'In-Lite task and ambient lighting'],
  },
  'cousy-fire-feature': {
    slug: 'cousy-fire-feature',
    title: 'Cousy Fire Feature',
    location: 'Shanty Bay, ON',
    category: 'Hardscape Design',
    year: '2024',
    duration: '2 weeks',
    investment: '$18,000+',
    heroImg: '/images/projects/cousy fire feature.jpeg',
    images: ['/images/projects/cousy fire feature.jpeg'],
    description: 'An intimate fire feature area designed for cool Simcoe County evenings. The custom-built fire pit with surrounding seat wall creates a natural gathering point that extends the outdoor living season by months.',
    challenge: 'The homeowner wanted a fire feature that was both beautiful and compliant with local bylaws. The location needed to account for wind patterns, proximity to structures, and integration with the existing patio.',
    solution: 'We designed a natural gas fire feature that eliminates smoke complaints, provides instant on/off convenience, and can be placed closer to the home than a wood-burning alternative. The surrounding seat wall provides comfortable seating for 8-10 people.',
    specs: ['Custom natural gas fire pit', 'Natural stone seat wall surround', '14" structural base', 'TSSA-permitted gas installation', 'Fireglass media (amber)', 'Integrated seat wall lighting'],
  },
  'front-entrance-grandeur': {
    slug: 'front-entrance-grandeur',
    title: 'Front Entrance Grandeur',
    location: 'Barrie, ON',
    category: 'Interlocking Stone',
    year: '2025',
    duration: '2 weeks',
    investment: '$25,000+',
    heroImg: '/images/projects/Front-entrance-idea-pavers.JPG',
    images: ['/images/projects/Front-entrance-idea-pavers.JPG'],
    description: 'A front entrance transformation that combines natural stone textures with modern paving patterns. The homeowner wanted visitors to feel the quality of their home before they even reached the front door.',
    challenge: 'The existing entrance had uneven concrete steps and a narrow walkway that felt cramped and unwelcoming. The grade also directed water toward the garage.',
    solution: 'We widened the walkway, rebuilt the steps with matching pavers and natural stone treads, and re-graded the entrance to direct water away from all structures. The accent borders and texture contrast create a welcoming, premium first impression.',
    specs: ['12" compacted clear stone base', 'Unilock Beacon Hill pavers', 'Natural stone step treads', 'Accent border detailing', 'Corrected drainage grading', 'Low-voltage path lighting'],
  },
  'lakeside-pool-decking': {
    slug: 'lakeside-pool-decking',
    title: 'Lakeside Pool Decking',
    location: 'Simcoe County, ON',
    category: 'Hardscape Design',
    year: '2024',
    duration: '4 weeks',
    investment: '$50,000+',
    heroImg: '/images/projects/pool-deck-ideas.JPEG',
    images: ['/images/projects/pool-deck-ideas.JPEG'],
    description: 'A precision-cut pool surround that creates a seamless transition from the home to the water. The non-slip paver surface provides safety for wet feet while the clean lines frame the pool like a piece of architecture.',
    challenge: 'Pool decks have unique requirements — the surface must be non-slip when wet, must drain away from the pool to prevent contamination, and must withstand constant exposure to chlorinated water and sun.',
    solution: 'We selected pavers with textured, non-slip surfaces and installed them with a slight grade directing water to perimeter drains — never into the pool. All materials were chosen for UV and chlorine resistance to prevent fading and deterioration.',
    specs: ['14" compacted clear stone base', 'Non-slip textured pavers', 'Perimeter drainage system', 'Chlorine-resistant polymeric sand', 'UV-stable paver selection', 'Integrated pool coping stones'],
  },
  'architectural-visuals': {
    slug: 'architectural-visuals',
    title: 'Architectural Visuals',
    location: 'Barrie & Simcoe County',
    category: 'Landscape Design',
    year: '2025',
    duration: 'Design Phase',
    investment: 'Included in consultation',
    heroImg: '/images/projects/rendering1.jpg',
    images: ['/images/projects/rendering1.jpg'],
    description: 'Our 3D design process lets you walk through your future backyard before we move a single stone. These high-fidelity renderings capture every detail — materials, colours, textures, lighting — so you can make confident decisions about your investment.',
    challenge: 'Most homeowners struggle to visualize how a landscape design will actually look in their space. Flat drawings and material samples only tell part of the story.',
    solution: 'We create photorealistic 3D renderings from multiple angles, including aerial views and eye-level perspectives. Clients can see exactly how their chosen materials will look against their home, in their actual lighting conditions, before any construction begins.',
    specs: ['Photorealistic 3D rendering', 'Multiple viewing angles', 'Accurate material textures', 'Lighting simulation (day/night)', 'Revision rounds included', 'Client-approved before construction'],
  },
};

export default function ProjectDetail() {
  const { slug } = useParams();
  const project = slug ? PROJECT_DATA[slug] : null;

  if (!project) {
    return (
      <div className="bg-brand-nearblack min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-display text-4xl text-brand-bonewhite mb-6">Project Not Found</h1>
          <Link to="/portfolio" className="btn-primary">Back to Portfolio</Link>
        </div>
      </div>
    );
  }

  const slugs = Object.keys(PROJECT_DATA);
  const currentIdx = slugs.indexOf(project.slug);
  const prevSlug = currentIdx > 0 ? slugs[currentIdx - 1] : null;
  const nextSlug = currentIdx < slugs.length - 1 ? slugs[currentIdx + 1] : null;

  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO
        title={`${project.title} | ${project.category} in ${project.location} | Golden Maple`}
        description={project.description}
      />

      <section className="section-padding pt-40 md:pt-48">
        <div className="container-custom">
          <Link to="/portfolio" className="inline-flex items-center gap-3 font-sans text-[11px] uppercase tracking-[0.25em] text-brand-gold hover:text-brand-bonewhite transition-colors mb-12 group">
            <ArrowLeft size={14} strokeWidth={2} className="group-hover:-translate-x-1 transition-transform" />
            Back to Portfolio
          </Link>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <div className="flex flex-wrap items-center gap-6 mb-6">
              <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold">{project.category}</span>
              <span className="flex items-center gap-2 font-sans text-[11px] uppercase tracking-[0.2em] text-brand-muted">
                <MapPin size={12} strokeWidth={1.5} className="text-brand-gold" /> {project.location}
              </span>
              <span className="flex items-center gap-2 font-sans text-[11px] uppercase tracking-[0.2em] text-brand-muted">
                <Calendar size={12} strokeWidth={1.5} className="text-brand-gold" /> {project.year}
              </span>
            </div>
            <h1 className="font-display text-4xl md:text-7xl font-light text-brand-bonewhite leading-[1.1] mb-6">{project.title}</h1>
            <div className="flex flex-wrap gap-8 mb-16">
              <div className="bg-brand-surface px-6 py-3 rounded-[2px] border border-brand-dim/10">
                <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-brand-muted block">Duration</span>
                <span className="font-display text-lg text-brand-bonewhite font-light">{project.duration}</span>
              </div>
              <div className="bg-brand-surface px-6 py-3 rounded-[2px] border border-brand-dim/10">
                <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-brand-muted block">Investment</span>
                <span className="font-display text-lg text-brand-gold font-light">{project.investment}</span>
              </div>
            </div>
          </motion.div>

          {/* Hero Image */}
          <div className="aspect-[21/9] rounded-[2px] overflow-hidden mb-24 border border-brand-dim/10">
            <img src={project.heroImg} alt={`${project.title} — Golden Maple Landscaping portfolio`} loading="eager" fetchPriority="high" decoding="async" className="w-full h-full object-cover" />
          </div>

          {/* Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-20 mb-32">
            <div className="lg:col-span-2 space-y-12">
              <div>
                <h2 className="font-display text-3xl font-light text-brand-bonewhite mb-6">The Project</h2>
                <p className="font-sans text-lg text-brand-muted leading-relaxed font-light">{project.description}</p>
              </div>
              <div>
                <h2 className="font-display text-3xl font-light text-brand-bonewhite mb-6">The Challenge</h2>
                <p className="font-sans text-lg text-brand-muted leading-relaxed font-light">{project.challenge}</p>
              </div>
              <div>
                <h2 className="font-display text-3xl font-light text-brand-bonewhite mb-6">Our Solution</h2>
                <p className="font-sans text-lg text-brand-muted leading-relaxed font-light">{project.solution}</p>
              </div>

              {project.testimonial && (
                <div className="bg-brand-surface border-l-2 border-brand-gold p-10 rounded-[2px]">
                  <p className="font-display text-xl text-brand-bonewhite italic font-light leading-relaxed mb-4">"{project.testimonial.text}"</p>
                  <p className="font-sans text-[11px] uppercase tracking-[0.2em] text-brand-gold">— {project.testimonial.name}</p>
                </div>
              )}
            </div>

            {/* Specs Sidebar */}
            <div>
              <div className="bg-brand-surface p-10 rounded-[2px] border border-brand-dim/10 sticky top-32">
                <h3 className="font-display text-2xl font-light text-brand-gold mb-8">Project Specifications</h3>
                <ul className="space-y-5">
                  {project.specs.map((spec, idx) => (
                    <li key={idx} className="flex items-start gap-4">
                      <Shield className="text-brand-gold shrink-0 mt-0.5" size={14} strokeWidth={1.5} />
                      <span className="font-sans text-sm text-brand-muted font-light">{spec}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-10 pt-8 border-t border-brand-dim/10">
                  <Link to="/contact" className="btn-primary w-full text-center">Start Your Project</Link>
                </div>
              </div>
            </div>
          </div>

          {/* Prev/Next Navigation */}
          <div className="flex justify-between items-center pt-16 border-t border-brand-dim/10">
            {prevSlug ? (
              <Link to={`/portfolio/${prevSlug}`} className="group flex items-center gap-4 font-sans text-[11px] uppercase tracking-[0.2em] text-brand-muted hover:text-brand-gold transition-colors">
                <ArrowLeft size={16} strokeWidth={1.5} className="group-hover:-translate-x-1 transition-transform" />
                Previous Project
              </Link>
            ) : <div />}
            {nextSlug ? (
              <Link to={`/portfolio/${nextSlug}`} className="group flex items-center gap-4 font-sans text-[11px] uppercase tracking-[0.2em] text-brand-muted hover:text-brand-gold transition-colors">
                Next Project
                <ArrowRight size={16} strokeWidth={1.5} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            ) : <div />}
          </div>
        </div>
      </section>
    </div>
  );
}
