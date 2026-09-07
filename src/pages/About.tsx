import { motion } from 'motion/react';
import { Shield, Award, CheckCircle, MapPin, Phone, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import { trackCall } from '../utils/analytics';

const COVERAGE = [
  'Barrie',
  'Innisfil',
  'Oro-Medonte',
  'Springwater',
  'Midhurst',
  'Cottage Country',
];

const CREDENTIALS = [
  { icon: Shield, title: 'WSIB Certified', detail: 'Fully covered crew on every job site.' },
  { icon: Award, title: '$5M Liability', detail: 'Your property and project are protected.' },
  { icon: CheckCircle, title: '5-Year Sink & Settlement Warranty', detail: 'If it shifts, we come back and fix it.' },
  { icon: MapPin, title: 'Barrie-based since 2014', detail: 'Local crew. Local winters. Local accountability.' },
];

export default function About() {
  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO
        title="About Golden Maple Landscaping | Barrie Hardscape Crew"
        description="Barrie-based hardscape contractor for Simcoe County and Cottage Country. Interlocking, patios, retaining walls, and composite decks — WSIB certified, $5M liability, 5-year warranty. Free estimate."
        canonical="https://goldenmaplelandscaping.ca/about"
      />

      <section className="section-padding pt-48">
        <div className="container-custom max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-20"
          >
            <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-8 block">
              Who We Are
            </span>
            <h1 className="font-display text-5xl md:text-7xl font-light text-brand-bonewhite leading-[1.05] mb-10">
              We build outdoor spaces <br />
              <span className="italic text-brand-gold-dark">families actually use.</span>
            </h1>
            <p className="font-sans text-lg text-brand-muted leading-relaxed font-light max-w-3xl mx-auto">
              Golden Maple Landscaping is a Barrie hardscape crew serving Simcoe County and Cottage Country.
              Interlocking stone, patios, retaining walls, and composite decks — engineered for Ontario freeze-thaw,
              built by the same people who quote the work.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-24">
            {CREDENTIALS.map((item) => (
              <div
                key={item.title}
                className="bg-brand-surface border border-brand-dim/10 p-8 rounded-[2px] flex gap-5"
              >
                <item.icon className="text-brand-gold-dark shrink-0 mt-1" size={22} strokeWidth={1.5} />
                <div>
                  <h2 className="font-display text-2xl font-light text-brand-bonewhite mb-2">{item.title}</h2>
                  <p className="font-sans text-sm text-brand-muted font-light leading-relaxed">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-brand-surface border border-brand-dim/10 p-10 md:p-14 rounded-[2px] mb-24">
            <h2 className="font-display text-3xl md:text-4xl font-light text-brand-bonewhite mb-6">
              Where we work
            </h2>
            <p className="font-sans text-base text-brand-muted font-light leading-relaxed mb-8 max-w-2xl">
              We take projects across Barrie, Simcoe County, and Cottage Country. If you&apos;re in our service area,
              Yorkis will tell you straight whether the job is a fit — no pressure, no runaround.
            </p>
            <ul className="flex flex-wrap gap-3 mb-10">
              {COVERAGE.map((place) => (
                <li
                  key={place}
                  className="font-sans text-[11px] uppercase tracking-[0.2em] text-brand-gold-dark border border-brand-gold/30 px-4 py-2 rounded-full"
                >
                  {place}
                </li>
              ))}
            </ul>
            <Link
              to="/locations/barrie"
              className="inline-flex items-center gap-3 font-sans text-[11px] uppercase tracking-[0.25em] text-brand-porcelain hover:text-brand-gold transition-colors"
            >
              Barrie service details
              <ArrowRight size={14} strokeWidth={1.5} />
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start mb-24">
            <div>
              <h2 className="font-display text-3xl md:text-4xl font-light text-brand-bonewhite mb-6 leading-tight">
                Built like it&apos;s our own backyard.
              </h2>
              <p className="font-sans text-base text-brand-muted font-light leading-relaxed mb-6">
                Most of the calls we get start the same way: a patio that sank, a contractor who went quiet, or a
                quote that grew halfway through. We built Golden Maple to be the opposite of that.
              </p>
              <p className="font-sans text-base text-brand-muted font-light leading-relaxed mb-6">
                Yorkis is on site for the builds that matter. You get honest scope, a fixed price we stand behind,
                and a crew that cleans up every day. The base you never see is dug 12–16&quot; for Barrie winters —
                so the patio you live on still looks right a decade later.
              </p>
              <p className="font-sans text-sm text-brand-gold-dark font-normal tracking-wide uppercase">
                Yorkis Estevez · Founder &amp; Lead Builder
              </p>
            </div>
            <div className="bg-brand-surface border border-brand-dim/10 p-10 rounded-[2px] space-y-8">
              <h3 className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark">
                Free estimate
              </h3>
              <p className="font-sans text-base text-brand-muted font-light leading-relaxed">
                Tell us your name, phone, and email. Yorkis replies within 24 hours with an honest read on scope,
                timeline, and fit. Budget is optional. No sales call required to start.
              </p>
              <Link to="/contact" className="btn-primary w-full py-5 text-center block">
                Get My Free Estimate
              </Link>
              <a
                href="tel:7055003581"
                onClick={() => trackCall('about_phone')}
                className="flex items-center justify-center gap-3 font-sans text-[11px] uppercase tracking-[0.25em] text-brand-gold-dark hover:text-brand-gold transition-colors"
              >
                <Phone size={14} strokeWidth={1.5} />
                Or call (705) 500-3581
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
