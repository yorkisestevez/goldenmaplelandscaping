import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, BookOpen } from 'lucide-react';
import SEO from '../components/SEO';

const BLOG_POSTS = [
    {
    slug: "paver-walkway-cost-barrie",
    title: "What Does a Paver Walkway Cost in Barrie? Real 2026 Pricing Guide",
    excerpt: "Get real 2026 pricing for a paver walkway in Barrie, Ontario, and learn what factors like materials, base prep, and size will impact your final investment.",
    category: "Investment",
    readTime: "9 min",
    image: "/images/projects/orillia-walkway.jpg",
  },
  {
    slug: 'landscaping-cost-guide-barrie',
    title: 'How Much Does Landscaping Cost in Barrie? A 2026 Price Guide',
    excerpt: 'The definitive guide to landscaping costs in Barrie and Simcoe County. Authentic price ranges for interlocking, retaining walls, grading, and full property transformations.',
    category: 'Investment',
    readTime: '8 min',
    image: '/images/projects/best.JPEG',
  },
  {
    slug: 'interlocking-patio-cost-ontario',
    title: 'How Much Does an Interlocking Patio Cost in Ontario?',
    excerpt: 'Detailed breakdown of what an interlocking patio costs in Ontario. Explains price factors like excavation, base materials, paver types, and exactly what drives the price.',
    category: 'Investment',
    readTime: '7 min',
    image: '/images/projects/patio-pergola.jpg',
  },
  {
    slug: 'hidden-costs-cheap-landscaping',
    title: 'The Hidden Costs of "Cheap" Landscaping',
    excerpt: 'Why accepting the lowest landscaping bid often costs double in the end. A look at the cut corners in cheap patio installations and failing retaining walls.',
    category: 'Investment',
    readTime: '6 min',
    image: '/images/projects/IMG_4826.jpg',
  },
  {
    slug: 'why-patios-sink-barrie',
    title: 'Why Patios Sink in Barrie (And How to Prevent It)',
    excerpt: 'The freeze-thaw cycle destroys shallow bases. Learn why 12-16" of compacted clear stone is the only way to build a patio that lasts in Simcoe County.',
    category: 'Engineering',
    readTime: '7 min',
    image: '/images/projects/best.JPEG',
  },
  {
    slug: 'clear-stone-vs-granular-a-base',
    title: 'Clear Stone vs. Granular A: Why Your Patio Base Decides Everything',
    excerpt: '95% of Barrie contractors quote Granular A. It traps water, fails under freeze-thaw, and is the #1 reason hardscapes sink. Here\'s the ICPI open-graded alternative we build on.',
    category: 'Engineering',
    readTime: '9 min',
    image: '/images/projects/best.JPEG',
  },
  {
    slug: 'timbertech-vs-wood-decking-ontario',
    title: 'TimberTech vs. Wood Decking: The Real Cost Over 20 Years',
    excerpt: 'Wood looks cheaper upfront — until you add up the staining, repairs, and replacements. Here\'s the honest math on composite vs. traditional decking in Ontario.',
    category: 'Decking',
    readTime: '8 min',
    image: '/images/projects/TimberTech Dark Cocoa PrimeCollection Composite Decking Beauty1.jpg',
  },
  {
    slug: 'retaining-wall-guide-simcoe-county',
    title: 'The Complete Guide to Retaining Walls in Simcoe County',
    excerpt: 'When do you need an engineer? What materials last longest? How deep should your base be? Everything homeowners need to know before building a retaining wall.',
    category: 'Retaining Walls',
    readTime: '10 min',
    image: '/images/projects/garden-wall.JPEG',
  },
  {
    slug: 'how-to-choose-landscaping-contractor-barrie',
    title: 'How to Choose a Landscaping Contractor in Barrie (Without Getting Burned)',
    excerpt: 'The 7 questions you must ask before signing any contract — and the red flags that tell you to walk away immediately.',
    category: 'Hiring Guide',
    readTime: '9 min',
    image: '/images/projects/IMG_4826.jpg',
  },
  {
    slug: 'unilock-vs-techo-bloc-vs-permacon',
    title: 'Unilock vs. Techo-Bloc vs. Permacon: Which Paver is Right for Your Home?',
    excerpt: 'We install all three brands. Here\'s an honest comparison of durability, aesthetics, warranty, and cost — straight from the contractor who works with them daily.',
    category: 'Materials',
    readTime: '8 min',
    image: '/images/projects/IHPX8926.JPEG',
  },
  {
    slug: 'outdoor-kitchen-planning-guide',
    title: 'Planning an Outdoor Kitchen in Ontario: What You Need to Know',
    excerpt: 'Gas lines, countertop materials, drainage, and winter protection — the complete planning checklist for an outdoor kitchen that actually works year-round.',
    category: 'Outdoor Living',
    readTime: '7 min',
    image: '/images/projects/luxury outdoor kitchen.jpeg',
  },
  {
    slug: 'landscape-lighting-guide-barrie',
    title: 'Landscape Lighting: The Investment That Doubles Your Outdoor Living Hours',
    excerpt: 'Professional lighting transforms your property after dark. Learn about low-voltage LED systems, placement strategy, and why DIY kits don\'t compare.',
    category: 'Lighting',
    readTime: '6 min',
    image: '/images/projects/IHPX8926.JPEG',
  },
  {
    slug: 'winter-damage-prevention-interlocking',
    title: 'How to Protect Your Interlocking Stone From Winter Damage',
    excerpt: 'Salt, plows, and ice can destroy your patio. Here are the maintenance tips that will keep your interlocking looking perfect through every Barrie winter.',
    category: 'Maintenance',
    readTime: '5 min',
    image: '/images/projects/best.JPEG',
  },
  {
    slug: 'backyard-renovation-roi-ontario',
    title: 'Does a Backyard Renovation Increase Home Value in Ontario?',
    excerpt: 'The data says yes — but only if it\'s done right. Here\'s what appraisers actually look for and which projects deliver the highest ROI in Simcoe County.',
    category: 'Investment',
    readTime: '7 min',
    image: '/images/projects/IMG_4826.jpg',
  },
  {
    slug: 'fire-pit-regulations-barrie',
    title: 'Fire Pit Rules in Barrie: Permits, Setbacks, and What You Can Actually Build',
    excerpt: 'Before you build a fire feature, you need to know the rules. Here\'s a plain-English breakdown of Barrie\'s fire pit bylaws and how to stay compliant.',
    category: 'Regulations',
    readTime: '6 min',
    image: '/images/projects/cousy fire feature.jpeg',
  },
  {
    slug: 'best-time-install-patio-ontario',
    title: 'Best Time to Install a Paver Patio in Ontario (2026 Guide)',
    excerpt: 'Month-by-month breakdown of when to install in Barrie and Simcoe County. Booking lead times, weather windows, and how to lock 2026 pricing before mid-season hikes.',
    category: 'Project Planning',
    readTime: '9 min',
    image: '/images/projects/best.JPEG',
  },
  {
    slug: 'landscape-permits-barrie-simcoe',
    title: 'Permits, Bylaws & Inspections for Hardscape in Barrie & Simcoe County',
    excerpt: 'Complete 2026 reference: which projects need permits, the 1-metre retaining wall rule, municipality-by-municipality contact info, and Ontario One Call requirements.',
    category: 'Project Planning',
    readTime: '11 min',
    image: '/images/projects/garden-wall.JPEG',
  },
  {
    slug: 'pool-deck-materials-ontario',
    title: 'Pool Deck Materials Compared: Porcelain, Concrete Pavers, Natural Stone',
    excerpt: 'Full side-by-side breakdown of pool surround materials in Ontario — slip ratings, heat retention, real 2026 cost per sqft, and which fits salt-water vs chlorine pools.',
    category: 'Materials',
    readTime: '10 min',
    image: '/images/projects/decking1.jpg',
  },
];

export default function Resources() {
  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO 
        title="Landscaping Resources & Expert Guides | Barrie & Simcoe County | Golden Maple"
        description="Expert landscaping guides, contractor hiring tips, material comparisons, and maintenance advice from Barrie's highest-rated hardscape contractor. Free resources to help you make informed decisions."
        canonical="https://goldenmaplelandscaping.ca/resources"
      />

      <section className="section-padding pt-40 md:pt-48">
        <div className="container-custom">
          <div className="max-w-3xl mb-24">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold mb-8 block">Resources</span>
              <h1 className="font-display text-5xl md:text-8xl font-light text-brand-bonewhite leading-[1.05] mb-10">
                Expert guides for <br />
                <span className="italic text-brand-gold">smarter homeowners.</span>
              </h1>
              <p className="font-sans text-lg text-brand-muted leading-relaxed font-light">
                Before you spend a dollar on your backyard, arm yourself with the knowledge that separates a 3-year patio from a 30-year one.
              </p>
            </motion.div>
          </div>

          {/* Buyer's Guide Feature Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="mb-24"
          >
            <Link to="/buyers-guide" className="group block">
              <div className="bg-brand-surface border border-brand-gold/20 rounded-[2px] p-10 md:p-16 flex flex-col md:flex-row items-center gap-12 hover:border-brand-gold/40 transition-all duration-500">
                <div className="w-20 h-20 bg-brand-gold/10 flex items-center justify-center rounded-full shrink-0 border border-brand-gold/20 group-hover:bg-brand-gold/20 transition-colors">
                  <BookOpen className="text-brand-gold" size={32} strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold mb-3 block">Featured Resource</span>
                  <h2 className="font-display text-3xl md:text-4xl font-light text-brand-bonewhite mb-4 group-hover:text-brand-gold transition-colors">The Homeowner's Buyer's Guide</h2>
                  <p className="font-sans text-brand-muted font-light leading-relaxed">The complete guide to hiring the right landscaping contractor in Barrie. What to ask, what to expect, and how to protect your investment.</p>
                </div>
                <ArrowRight className="text-brand-gold shrink-0 group-hover:translate-x-2 transition-transform" size={24} strokeWidth={1.5} />
              </div>
            </Link>
          </motion.div>

          {/* Blog Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {BLOG_POSTS.map((post, idx) => (
              <motion.div
                key={post.slug}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.05 * idx }}
              >
                <Link to={`/resources/${post.slug}`} className="group block h-full">
                  <div className="bg-brand-surface border border-brand-dim/10 rounded-[2px] overflow-hidden h-full flex flex-col hover:border-brand-gold/20 transition-all duration-500">
                    <div className="aspect-[16/10] overflow-hidden">
                      <img
                        src={post.image}
                        alt={post.title}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                    </div>
                    <div className="p-8 flex flex-col flex-1">
                      <div className="flex items-center gap-4 mb-5">
                        <span className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-gold font-medium">{post.category}</span>
                        <span className="flex items-center gap-1 font-sans text-[10px] uppercase tracking-[0.2em] text-brand-muted">
                          <Clock size={10} strokeWidth={1.5} /> {post.readTime}
                        </span>
                      </div>
                      <h3 className="font-display text-xl font-light text-brand-bonewhite mb-4 leading-tight group-hover:text-brand-gold transition-colors">{post.title}</h3>
                      <p className="font-sans text-sm text-brand-muted font-light leading-relaxed flex-1">{post.excerpt}</p>
                      <div className="mt-6 flex items-center gap-3 font-sans text-[11px] uppercase tracking-[0.2em] text-brand-gold group-hover:gap-5 transition-all">
                        Read Article <ArrowRight size={14} strokeWidth={1.5} />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
