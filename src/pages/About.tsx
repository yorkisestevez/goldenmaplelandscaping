import { motion } from 'motion/react';
import { Shield, Award, CheckCircle, Compass, ArrowRight } from 'lucide-react';
import SEO from '../components/SEO';
import { Link } from 'react-router-dom';

export default function About() {
  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO 
        title="About Golden Maple Landscaping | Barrie ON"
        description="Founded by Yorkis Estevez in Barrie, Golden Maple delivers premium outdoor construction with precision craftsmanship. 8 five-star Google reviews. Meet our team."
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
                Your backyard should be the place your family actually wants to be — dinner on the patio, kids on the lawn, coffee out back before the day starts.
              </p>
              <p className="font-sans text-lg text-brand-bonewhite leading-relaxed mb-12 font-normal">
                Our job is to build it so it stays that way, season after season.
              </p>
              <div className="space-y-8 font-sans text-lg text-brand-muted leading-relaxed mb-16 font-light">
                <p>
                  We're a Barrie-based hardscape crew, and our approach is simple: listen to how you want to live outside, quote it honestly, and build it properly the first time — engineering before shortcuts, craft before speed.
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
              className="relative w-full max-w-[420px] mx-auto"
            >
              {/* Rotated editorial outline behind the frame */}
              <div className="absolute -inset-3 border border-brand-gold/20 rounded-[2px] rotate-2" aria-hidden="true" />
              <div className="absolute -inset-3 border border-brand-gold/10 rounded-[2px] -rotate-1" aria-hidden="true" />
              {/* Framed portrait */}
              <div className="relative rounded-[2px] overflow-hidden border border-brand-gold/40 shadow-[0_45px_90px_-30px_rgba(0,0,0,0.8)]">
                <img
                  src="/images/projects/yorkis-founder-golden-maple.webp"
                  alt="Yorkis Estevez, founder of Golden Maple Landscaping, in Golden Maple branded gear"
                  className="w-full object-cover"
                  referrerPolicy="no-referrer"
                />
                {/* Name plate on a gradient scrim inside the photo */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent pt-28 pb-9 px-8 text-center">
                  <div className="mx-auto mb-5 h-px w-12 bg-brand-gold/70" aria-hidden="true" />
                  <p className="font-display text-3xl text-brand-bonewhite font-light">Yorkis Estevez</p>
                  <p className="font-sans text-[10px] uppercase tracking-[0.4em] text-brand-gold mt-3">Founder &amp; Lead Builder</p>
                </div>
              </div>
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
                  If you're like most homeowners we meet, you've heard the stories — the patio that sank after one winter, the contractor who went quiet after the deposit, the quote that grew halfway through the job. Being careful about who you hire isn't paranoia. It's smart.
                </p>
                <p>
                  So instead of telling you how much we love this work (we do), here's what you can actually expect when we build for you: <span className="text-brand-bonewhite font-normal">a fixed price before we start, a crew that shows up when we said we would, an update every day, and a clean site every evening.</span>
                </p>
                <p>
                  The parts you'll never see get the most attention — a deep 12–16" engineered base, proper drainage, clean detailing. Those invisible details are what decide whether your patio stays level for twenty years or has to be redone in two.
                </p>
                <p className="text-brand-bonewhite font-normal italic">
                  We're not trying to be the cheapest or the biggest. We're trying to be the company you're glad you picked — five years from now, not just on handover day.
                </p>
                <div className="bg-brand-burgundy/10 border-l-2 border-brand-gold p-10 md:p-16 rounded-[2px]">
                  <p className="text-brand-bonewhite text-2xl md:text-3xl font-display font-light leading-tight">
                    Every build is backed by a <span className="text-brand-gold">5-year sink and settlement warranty</span> — in writing. If your stones ever sink or shift, we come back and make it right.
                  </p>
                </div>
                <p>
                  If you're planning a space your family will enjoy for years to come, I'd love to walk your property with you — honest scope, honest budget, no pressure.
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
