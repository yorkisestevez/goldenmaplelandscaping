import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, BookOpen, Calculator } from 'lucide-react';
import SEO from '../components/SEO';
import { BLOG_POSTS } from '../data/blogPosts';
import { LIBRARY_SECTIONS } from '../data/library';


export default function Resources() {
  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO 
        title="Landscaping Resources & Planning Guides | Barrie & Simcoe County | Golden Maple"
        description="Landscaping guides, contractor hiring tips, material comparisons, and maintenance topics to help with project planning."
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
              <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-8 block">Resources</span>
              <h1 className="font-display text-5xl md:text-8xl font-light text-brand-bonewhite leading-[1.05] mb-10">
                Expert guides for <br />
                <span className="italic text-brand-gold-dark">smarter homeowners.</span>
              </h1>
              <p className="font-sans text-lg text-brand-muted leading-relaxed font-light">
                Use these guides to prepare questions about site conditions, materials, maintenance, and written project terms.
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
                  <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-3 block">Featured Resource</span>
                  <h2 className="font-display text-3xl md:text-4xl font-light text-brand-bonewhite mb-4 group-hover:text-brand-gold-dark transition-colors">The Homeowner's Buyer's Guide</h2>
                  <p className="font-sans text-brand-muted font-light leading-relaxed">The complete guide to hiring the right landscaping contractor in Barrie. What to ask, what to expect, and how to protect your investment.</p>
                </div>
                <ArrowRight className="text-brand-gold shrink-0 group-hover:translate-x-2 transition-transform" size={24} strokeWidth={1.5} />
              </div>
            </Link>
          </motion.div>

          {/* Cost estimator band */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="mb-24"
          >
            <Link to="/cost-estimator" className="group block">
              <div className="bg-brand-surface border border-brand-gold/20 rounded-[2px] p-10 md:p-16 flex flex-col md:flex-row items-center gap-12 hover:border-brand-gold/40 transition-all duration-500">
                <div className="w-20 h-20 bg-brand-gold/10 flex items-center justify-center rounded-full shrink-0 border border-brand-gold/20 group-hover:bg-brand-gold/20 transition-colors">
                  <Calculator className="text-brand-gold" size={32} strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-3 block">Free Tool</span>
                  <h2 className="font-display text-3xl md:text-4xl font-light text-brand-bonewhite mb-4 group-hover:text-brand-gold-dark transition-colors">What will your project cost?</h2>
                  <p className="font-sans text-brand-muted font-light leading-relaxed">Explore a planning tool, then confirm current scope, material availability, and pricing with the project team.</p>
                </div>
                <ArrowRight className="text-brand-gold shrink-0 group-hover:translate-x-2 transition-transform" size={24} strokeWidth={1.5} />
              </div>
            </Link>
          </motion.div>

          {/* Library topic chips — /library groups these posts by construction topic */}
          <nav aria-label="Browse by topic" className="mb-16 flex flex-wrap items-center gap-3">
            <Link to="/library" className="font-sans text-[11px] uppercase tracking-[0.25em] text-brand-gold-dark hover:text-brand-bonewhite transition-colors mr-3">
              Outdoor Construction Library:
            </Link>
            {LIBRARY_SECTIONS.map((section) => (
              <Link
                key={section.slug}
                to={`/library/${section.slug}`}
                className="font-sans text-[12px] text-brand-bonewhite border border-brand-dim/60 bg-brand-surface px-4 py-2 rounded-[2px] hover:border-brand-gold/60 transition-colors"
              >
                {section.title}
              </Link>
            ))}
          </nav>

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
                        <span className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-gold-dark font-medium">{post.category}</span>
                        <span className="flex items-center gap-1 font-sans text-[10px] uppercase tracking-[0.2em] text-brand-muted">
                          <Clock size={10} strokeWidth={1.5} /> {post.readTime}
                        </span>
                      </div>
                      <h3 className="font-display text-xl font-light text-brand-bonewhite mb-4 leading-tight group-hover:text-brand-gold-dark transition-colors">{post.title}</h3>
                      <p className="font-sans text-sm text-brand-muted font-light leading-relaxed flex-1">{post.excerpt}</p>
                      <div className="mt-6 flex items-center gap-3 font-sans text-[11px] uppercase tracking-[0.2em] text-brand-gold-dark group-hover:gap-5 transition-all">
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
