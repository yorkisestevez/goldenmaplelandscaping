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
                Why Golden Maple Exists
              </span>
              <h1 className="font-display text-5xl md:text-8xl font-light text-brand-bonewhite leading-[1.05] mb-12">
                You shouldn't have to <br />
                <span className="italic text-brand-gold">gamble on your home.</span>
              </h1>
              <p className="font-sans text-lg text-brand-muted leading-relaxed mb-12 font-light">
                Every spring, we get the same call. A homeowner three years past their build, watching the patio they paid $40,000 for sink another inch. The contractor has stopped answering. The warranty turned out to be worth less than the paper it was written on.
              </p>
              <p className="font-sans text-lg text-brand-bonewhite leading-relaxed mb-12 font-normal">
                That's not a story you should have to live.
              </p>
              <div className="space-y-8 font-sans text-lg text-brand-muted leading-relaxed mb-16 font-light">
                <p>
                  Golden Maple exists for a single reason — to be the contractor we wished existed when we started in this trade. One that builds it right the first time. One that picks up the phone five years later. One that puts engineering above margin and craft above speed.
                </p>
                <p>
                  Your home is the most important investment you'll ever make. The work we do on the outside of it should honour that.
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
              className="relative aspect-[4/5] rounded-[2px] overflow-hidden shadow-2xl border border-brand-dim/10"
            >
              <img
                src="/images/projects/Yorkis Estevez.jpg"
                alt="Yorkis Estevez - Founder of Golden Maple Landscaping"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-brand-nearblack/20 mix-blend-overlay" />
            </motion.div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-40">
            {[
              { icon: Shield, title: "WSIB Certified", desc: "Your property is fully protected. Our team is fully covered. No grey areas." },
              { icon: Award, title: "$5M Liability", desc: "We carry more insurance than most contractors even know exists. That's how seriously we take your home." },
              { icon: CheckCircle, title: "5-Year Warranty", desc: "If your stones sink or shift, we come back and fix it. No arguments, no fine print." },
              { icon: Compass, title: "12-16\" Base Depth", desc: "Most competitors dig 6 inches. We dig more than double. Your patio will outlast the mortgage." }
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
                Every horror story <br />
                <span className="text-brand-gold italic">starts the same way.</span>
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
                <div className="space-y-12">
                  <h3 className="font-sans text-sm uppercase tracking-[0.25em] text-brand-burgundy/80 font-normal">The Industry Standard</h3>
                  <ul className="space-y-10 font-sans text-lg text-brand-bonewhite/60 font-light">
                    <li className="flex gap-6">
                      <span className="text-brand-burgundy font-normal shrink-0">✕</span>
                      Shallow 6" bases that sink after one winter.
                    </li>
                    <li className="flex gap-6">
                      <span className="text-brand-burgundy font-normal shrink-0">✕</span>
                      Communication that stops after the deposit.
                    </li>
                    <li className="flex gap-6">
                      <span className="text-brand-burgundy font-normal shrink-0">✕</span>
                      Hidden fees and "surprise" mid-project costs.
                    </li>
                    <li className="flex gap-6">
                      <span className="text-brand-burgundy font-normal shrink-0">✕</span>
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
                  I started Golden Maple because I was tired of watching good people lose money on bad landscaping.
                </p>
                <p>
                  Half of every summer, our crew spends ripping out patios and retaining walls that other contractors poured three years ago. The pavers that sank. The walls that leaned. The drainage that turned a backyard into a swamp every April. <span className="text-brand-bonewhite font-normal">All of it built by people who knew better, and chose not to.</span>
                </p>
                <p>
                  The customer pays for that twice — once for the failed install, and again for the proper rebuild. I refuse to be part of an industry that treats homeowners that way.
                </p>
                <p className="text-brand-bonewhite font-normal italic">
                  So we built Golden Maple to be different. Not the cheapest. Not the biggest. The best at one specific thing — engineering outdoor spaces that still look the way we left them, twenty winters later.
                </p>
                <p>
                  Every project I take on is personal. My name is on it. My crew is on it. And five years from now, when something goes wrong somewhere on your property, I want you to think of one company first — and know that we'll be there.
                </p>
                <div className="bg-brand-burgundy/10 border-l-2 border-brand-gold p-10 md:p-16 rounded-[2px]">
                  <p className="text-brand-bonewhite text-2xl md:text-3xl font-display font-light leading-tight">
                    We back every build with a <span className="text-brand-gold">5-year sink and settlement warranty</span>. Not because the law requires it. Because we'd build it the same way for our own homes.
                  </p>
                </div>
                <p>
                  If you're tired of the gamble, that's exactly what we built this for.
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
