import { motion } from 'motion/react';
import { Shield, Award, CheckCircle, Compass, ArrowRight } from 'lucide-react';
import SEO from '../components/SEO';
import { Link } from 'react-router-dom';

export default function About() {
  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO 
        title="About Golden Maple Landscaping | Barrie ON"
        description="Founded by Yorkis Estevez in Barrie, Golden Maple delivers premium outdoor construction with precision craftsmanship. 42 five-star reviews. Meet our team."
        canonical="https://goldenmaplelandscaping.ca/about"
      />
      
      <section className="section-padding pt-48">
        <div className="container-custom">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center mb-40">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold mb-10 block">
                Who We Are
              </span>
              <h1 className="font-display text-5xl md:text-8xl font-light text-brand-bonewhite leading-[1.05] mb-12">
                We build spaces <br />
                <span className="italic text-brand-gold">families enjoy for years.</span>
              </h1>
              <p className="font-sans text-lg text-brand-muted leading-relaxed mb-12 font-light">
                We're a Barrie-based hardscape team that genuinely loves this work — shaping patios, walkways, and retaining walls that become the place a family gathers, season after season.
              </p>
              <p className="font-sans text-lg text-brand-bonewhite leading-relaxed mb-12 font-normal">
                And we build them to stay that way for a very long time.
              </p>
              <div className="space-y-8 font-sans text-lg text-brand-muted leading-relaxed mb-16 font-light">
                <p>
                  Our approach is simple: do the work properly the first time, and stand behind it long after. We put engineering before shortcuts and craft before speed, because the spaces we build are meant to be enjoyed for decades — not patched after a season.
                </p>
                <p>
                  Your home is one of the biggest investments you'll ever make. The work we do outside of it should honour that — and be a pleasure to live with every single day.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-10">
                <Link to="/contact" className="btn-primary py-5 px-10">Get My Estimate</Link>
                <Link to="/portfolio" className="flex items-center gap-4 text-brand-bonewhite font-sans text-xs uppercase tracking-[0.2em] hover:text-brand-gold transition-colors font-medium">
                  See Our Work <ArrowRight size={16} strokeWidth={1.5} />
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-[380px] mx-auto aspect-[4/5]"
            >
              {/* Soft gold-edged blob — the "frame" he floats in front of */}
              <div className="gm-blob absolute inset-[7%] bg-gradient-to-br from-brand-cream-light via-brand-cream to-brand-midsurface border-[3px] border-brand-gold/45 shadow-[0_30px_70px_-20px_rgba(94,74,15,0.38)]" />
              {/* Offset second outline — layered editorial accent */}
              <div className="gm-blob absolute inset-[7%] border border-brand-gold/25 rotate-6 scale-[1.05]" style={{ animationDelay: '-8s' }} />
              {/* Floating cut-out — bottom-anchored, head breaks above the blob */}
              <img
                src="/images/projects/yorkis-cutout-headshot.png"
                alt="Yorkis Estevez - Founder of Golden Maple Landscaping"
                className="gm-float absolute inset-x-0 bottom-0 mx-auto h-[102%] w-auto max-w-none object-contain object-bottom grayscale-[0.7] contrast-[1.05] drop-shadow-[0_18px_22px_rgba(0,0,0,0.22)]"
                referrerPolicy="no-referrer"
              />
            </motion.div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-40">
            {[
              { icon: Shield, title: "WSIB Certified", desc: "Your property is fully protected. Our team is fully covered. No grey areas." },
              { icon: Award, title: "$5M Liability", desc: "We carry $5M in liability coverage — full protection for your property and complete peace of mind for you." },
              { icon: CheckCircle, title: "5-Year Warranty", desc: "If your stones sink or shift, we come back and make it right. Simple, and in writing." },
              { icon: Compass, title: "12-16\" Base Depth", desc: "We build on a 12–16\" engineered base — the deep foundation that keeps your patio level and solid through every freeze-thaw season." }
            ].map((item, idx) => (
              <div key={idx} className="bg-brand-surface p-12 rounded-[2px] border border-brand-dim/10 text-center">
                <item.icon className="text-brand-gold mx-auto mb-8" size={32} strokeWidth={1.5} />
                <h3 className="font-display text-2xl font-light text-brand-bonewhite mb-4">{item.title}</h3>
                <p className="font-sans text-sm text-brand-muted leading-relaxed font-light">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="mb-40 bg-brand-surface p-16 md:p-24 rounded-[2px] border border-brand-dim/10">
            <div className="max-w-5xl mx-auto">
              <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold mb-10 block">
                The Golden Maple Difference
              </span>
              <h2 className="font-display text-4xl md:text-7xl font-light text-brand-bonewhite leading-tight mb-16">
                Built right <br />
                <span className="text-brand-gold italic">from the ground up.</span>
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
                <div className="space-y-12">
                  <h3 className="font-sans text-sm uppercase tracking-[0.25em] text-red-400/90 font-normal">The Industry Standard</h3>
                  <ul className="space-y-10 font-sans text-lg text-brand-bonewhite/60 font-light">
                    <li className="flex gap-6">
                      <span className="text-red-400 font-normal shrink-0">✕</span>
                      Shallow 6" bases that sink after one winter.
                    </li>
                    <li className="flex gap-6">
                      <span className="text-red-400 font-normal shrink-0">✕</span>
                      Communication that stops after the deposit.
                    </li>
                    <li className="flex gap-6">
                      <span className="text-red-400 font-normal shrink-0">✕</span>
                      Hidden fees and "surprise" mid-project costs.
                    </li>
                    <li className="flex gap-6">
                      <span className="text-red-400 font-normal shrink-0">✕</span>
                      Messy job sites and zero property protection.
                    </li>
                  </ul>
                </div>
                <div className="space-y-12">
                  <h3 className="font-sans text-sm uppercase tracking-[0.25em] text-brand-gold font-normal">The Golden Maple Way</h3>
                  <ul className="space-y-10 font-sans text-lg text-brand-bonewhite font-light">
                    <li className="flex gap-6">
                      <span className="text-brand-gold font-normal shrink-0">✓</span>
                      Deep 12-16" structural bases for zero shifting.
                    </li>
                    <li className="flex gap-6">
                      <span className="text-brand-gold font-normal shrink-0">✓</span>
                      Daily updates and a dedicated project manager.
                    </li>
                    <li className="flex gap-6">
                      <span className="text-brand-gold font-normal shrink-0">✓</span>
                      Fixed-price, transparent quotes. No surprises.
                    </li>
                    <li className="flex gap-6">
                      <span className="text-brand-gold font-normal shrink-0">✓</span>
                      5-year craftsmanship warranty on all installations.
                    </li>
                    <li className="flex gap-6">
                      <span className="text-brand-gold font-normal shrink-0">✓</span>
                      Professional site management and daily cleanup.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-40">
            <div className="text-center mb-16">
              <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold mb-10 block">
                Manufacturing Partners
              </span>
              <h2 className="font-display text-4xl md:text-7xl font-light text-brand-bonewhite leading-tight">
                Elite Materials for <br />
                <span className="text-brand-gold italic">Elite Construction.</span>
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              {[
                { 
                  name: "Unilock", 
                  strength: "Highest Quality Pavers", 
                  desc: "Reserved for our higher-end architectural projects, Unilock represents the absolute peak of hardscape durability and aesthetic luxury." 
                },
                { 
                  name: "Techo-Bloc", 
                  strength: "Techo-Pro Certified", 
                  desc: "As a Techo-Pro partner, we leverage the incredible versatility and unique, modern aesthetics of Techo-Bloc for custom-designed outdoor havens." 
                },
                { 
                  name: "Permacon", 
                  strength: "Preferred Innovation", 
                  desc: "Permacon is our preferred partner for business due to their consistent innovation and exceptional customer appreciation. They set the standard for service and reliability." 
                }
              ].map((partner, idx) => (
                <div key={idx} className="bg-brand-surface p-12 rounded-[2px] border border-brand-dim/10 hover:border-brand-gold/30 transition-all group">
                  <h3 className="font-display text-2xl text-brand-gold mb-4 uppercase tracking-widest">{partner.name}</h3>
                  <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-brand-bonewhite mb-6 font-normal underline decoration-brand-gold/30 underline-offset-8">
                    {partner.strength}
                  </p>
                  <p className="font-sans text-sm text-brand-muted leading-relaxed font-light group-hover:text-brand-bonewhite transition-colors">
                    {partner.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-40">
            <div className="max-w-4xl mx-auto">
              <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold mb-12 block text-center">
                A Letter From Yorkis
              </span>
              <div className="space-y-12 font-sans text-xl md:text-2xl text-brand-muted leading-relaxed font-light">
                <p>
                  I started Golden Maple because I love building things that last — and I wanted to do it the right way, for people who'd actually get to enjoy them.
                </p>
                <p>
                  There's nothing better than handing over a finished backyard and watching a family picture their next few years in it — the dinners, the kids running around, the quiet morning coffee on a patio that still looks brand new seasons later. <span className="text-brand-bonewhite font-normal">That's the part of this work I love most.</span>
                </p>
                <p>
                  So we pour our attention into the fundamentals — deep, engineered bases, proper drainage, clean detailing. They're the parts you never see, and they're what decide whether a space holds up for two seasons or twenty.
                </p>
                <p className="text-brand-bonewhite font-normal italic">
                  We're not trying to be the cheapest or the biggest. We just want to build outdoor spaces beautifully, and build them to be enjoyed for a very long time.
                </p>
                <p>
                  Every project I take on is personal. My name is on it, my crew is on it, and we build it the way we'd build it for our own families.
                </p>
                <div className="bg-brand-burgundy/10 border-l-2 border-brand-gold p-10 md:p-16 rounded-[2px]">
                  <p className="text-brand-bonewhite text-2xl md:text-3xl font-display font-light leading-tight">
                    We back every build with a <span className="text-brand-gold">5-year sink and settlement warranty</span> — not because we have to, but because we build every space to be enjoyed for far longer than that.
                  </p>
                </div>
                <p>
                  If you're planning a space your family will enjoy for years to come, we'd love to build it with you.
                </p>
              </div>
              <div className="mt-20 text-center">
                <p className="font-display text-4xl text-brand-gold italic font-light">Yorkis Estevez</p>
                <p className="font-sans text-[10px] font-normal tracking-[0.4em] uppercase text-brand-muted mt-3">Founder & Lead Builder</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-padding bg-brand-burgundy text-brand-bonewhite">
        <div className="container-custom text-center">
          <h2 className="font-display text-4xl md:text-8xl font-light mb-12 leading-tight">
            Let's build something <br />
            <span className="text-brand-gold italic">your family will love.</span>
          </h2>
          <p className="font-sans text-lg text-brand-bonewhite/80 max-w-2xl mx-auto mb-16 font-light">
            Start with a free estimate request. Honest scope, honest budget, no pressure. If we're the right fit, we'll come walk your property — no fee. If we're not, we'll point you toward someone who is.
          </p>
          <Link to="/contact" className="btn-primary px-20 py-5">Get My Estimate</Link>
        </div>
      </section>
    </div>
  );
}
