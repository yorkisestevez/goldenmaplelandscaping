import { motion } from 'motion/react';
import { ArrowRight, Shield, Award, CheckCircle, Star, Quote, ChevronRight, Compass, Clock } from 'lucide-react';
import SEO from '../components/SEO';
import BuyersGuide from '../components/BuyersGuide';
import Manifesto from '../components/Manifesto';
import Process from '../components/Process';
import HeroDepth from '../components/HeroDepth';
import { Link } from 'react-router-dom';
import Reveal from '../components/Reveal';
import { trackEngagement, trackCall } from '../utils/analytics';
import { cn } from '../utils/cn';
import { BUSINESS, publicClaimCopy, publicContact } from '../data/business';
import ResponsiveImage from '../components/ResponsiveImage';
import InstagramFeed from '../components/InstagramFeed';
import { FEATURED_PROJECTS, getProject, projectCoverFull, projectCover } from '../data/projects';

const ServicesGrid = () => {
  const services = [
    { title: 'Patios & interlocking', image: projectCover(getProject('barrie-diamond-inlay-patio')!), desc: 'Beautiful underfoot. Planned for dining, gathering and everyday life outside.', link: '/services/interlocking-barrie' },
    { title: 'Composite decking', image: projectCover(getProject('deck-and-garden-walkway')!), desc: 'An extension of your home, with room to unwind and materials chosen for your routine.', link: '/services/composite-decking-barrie' },
    { title: 'Walls & garden spaces', image: projectCover(getProject('sloped-backyard-patio-steps')!), desc: 'Bring definition to your landscape with considered levels, planting and stonework.', link: '/services/retaining-walls-barrie' },
  ];
  return (
    <section className="home-services bg-brand-nearblack">
      <div className="container-custom">
        <div className="flex flex-col md:flex-row justify-between md:items-end gap-6 mb-10 border-t border-brand-dim pt-10">
          <div><p className="text-[10px] uppercase tracking-[0.22em] text-brand-gold-dark font-medium mb-4">Considered from the ground up</p><h2 className="home-services-heading font-display">Good living starts outside.</h2></div>
          <Link to="/services" className="home-project-link self-start md:self-auto">Our services <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
        <div className="no-scrollbar -mx-8 flex snap-x snap-mandatory gap-5 overflow-x-auto px-8 pb-2 md:mx-0 md:grid md:grid-cols-3 md:gap-7 md:overflow-visible md:px-0 md:pb-0">
          {services.map((service) => (
            <Link to={service.link} key={service.title} className="group block w-[78vw] shrink-0 snap-start md:w-auto md:shrink">
              <div className="overflow-hidden mb-6"><ResponsiveImage image={service.image} sizes="(min-width: 768px) 33vw, 100vw" aspect="fill" className="home-service-photo transition-transform duration-500 motion-safe:group-hover:scale-[1.03]" /></div>
              <div className="flex items-center justify-between gap-4 mb-3"><h3 className="font-display text-3xl">{service.title}</h3><ArrowRight size={18} className="text-brand-gold-dark shrink-0" aria-hidden="true" /></div>
              <p className="text-sm leading-relaxed text-brand-muted max-w-sm">{service.desc}</p>
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-4 mt-12 pt-6 border-t border-brand-dim text-xs text-brand-muted">
          <span className="text-brand-gold-dark uppercase tracking-widest text-[10px] font-medium">Complete the space</span>
          <Link to="/services/landscape-design-barrie" className="hover:text-brand-ink">Landscape design</Link>
          <Link to="/contact" className="hover:text-brand-ink">Outdoor kitchens</Link>
          <Link to="/contact" className="hover:text-brand-ink">Fire features</Link>
          <Link to="/contact" className="hover:text-brand-ink">Landscape lighting</Link>
        </div>
      </div>
    </section>
  );
};

const WhyGoldenMaple = () => {
  const standards = [
    { icon: Compass, title: 'Project-specific site preparation', body: 'Drainage, soil conditions, access, and final excavation/base depth are reviewed for the written scope of each project.' },
    { icon: Shield, title: 'Documentation before work begins', body: publicClaimCopy(BUSINESS.credentials.liabilityInsurance, 'Current liability coverage documentation is available.'), },
    { icon: Award, title: 'Written project terms', body: publicClaimCopy(BUSINESS.credentials.workmanshipWarranty, 'Written workmanship terms are available for your project.'), },
  ];
  return (
    <section className="section-padding bg-brand-cream text-brand-ink overflow-hidden relative">
      <div className="container-custom relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
          <div>
            <Reveal>
              <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-green-dark mb-10 block font-medium">
                The Golden Maple Standard
              </span>
              <h2 className="font-display text-4xl md:text-7xl font-light leading-tight mb-12 text-brand-ink">
                Why your neighbour's <br />
                <span className="text-brand-green-dark italic">patio is already sinking.</span>
              </h2>
            </Reveal>
            <div className="space-y-12">
              {standards.map((s, i) => (
                <Reveal key={s.title} delay={0.1 + i * 0.1} className="flex gap-8">
                  <div className="w-14 h-14 bg-brand-cream-light flex items-center justify-center rounded-[2px] shrink-0 border border-brand-ink/10 shadow-sm">
                    <s.icon className="text-brand-green-dark" size={24} strokeWidth={1.5} />
                  </div>
                  <div>
                    <h4 className="font-display text-2xl font-light text-brand-ink mb-3">{s.title}</h4>
                    <p className="font-sans text-sm text-brand-ink-soft leading-relaxed font-light">{s.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="aspect-[4/5] rounded-[2px] overflow-hidden shadow-2xl border border-brand-ink/10">
              <ResponsiveImage image={projectCoverFull(getProject('cobblestone-driveway')!)} sizes="(min-width: 1024px) 45vw, 100vw" aspect="fill" className="w-full h-full object-cover" />
            </div>
            <div className="absolute -bottom-10 -left-10 bg-brand-green-dark p-12 hidden md:block rounded-[2px] shadow-xl">
              <span className="font-display text-7xl font-light text-brand-porcelain block mb-2">10+</span>
              <span className="font-sans text-[10px] font-normal uppercase tracking-[0.25em] text-brand-porcelain">Years of Excellence</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const SelectedWork = () => (
  <section id="selected-work" className="section-padding bg-brand-cream-light scroll-mt-24">
    <div className="container-custom">
      <Reveal className="text-center max-w-3xl mx-auto mb-12 md:mb-24">
        <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-6 block">
          Selected work
        </span>
        <h2 className="font-display text-4xl md:text-7xl font-light text-brand-bonewhite">
          Recent work, up close.
        </h2>
      </Reveal>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 mb-14 md:mb-20">
        {FEATURED_PROJECTS.map((project, idx) => (
          <Reveal key={project.slug} delay={idx * 0.1}>
            <Link to={`/portfolio/${project.slug}`} className="group flex flex-col">
              <div className="rounded-[2px] overflow-hidden border border-brand-dim/40 bg-brand-surface mb-6 md:mb-10">
                <ResponsiveImage
                  image={projectCover(project)}
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  aspect="4/3"
                  className="transition-transform duration-1000 motion-safe:group-hover:scale-[1.04]"
                />
              </div>
              <span className="font-sans text-[10px] uppercase tracking-[0.3em] text-brand-gold-dark mb-4 block">
                {project.category}
              </span>
              <h3 className="font-display text-3xl md:text-4xl font-light text-brand-bonewhite leading-tight mb-6 group-hover:text-brand-gold-dark transition-colors">
                {project.title}
              </h3>
              <p className="font-sans text-brand-muted leading-relaxed font-light mb-6">
                {project.summary}
              </p>
              <div className="flex items-center gap-3 font-sans text-[11px] uppercase tracking-[0.2em] text-brand-bonewhite/80">
                <CheckCircle size={14} strokeWidth={1.5} className="text-brand-gold-dark shrink-0" aria-hidden="true" />
                Completed project · {project.town}, ON
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
      <Reveal className="text-center">
        <Link to="/portfolio" className="btn-ghost">View all projects</Link>
      </Reveal>
    </div>
  </section>
);

const Testimonials = () => {
  const reviews = [
    {
      name: "Michael R.",
      location: "Barrie",
      text: "We got three quotes. Two contractors wanted to dig 6 inches. Yorkis said he'd go 14. Three winters later, not a single stone has moved. You get what you pay for — and with Golden Maple, you get perfection.",
    },
    {
      name: "Sarah L.",
      location: "Innisfil",
      text: "I was nervous spending this much on our backyard. Then Yorkis showed us the 3D render and I literally started tearing up — it was the exact space I'd been dreaming about since we moved to Innisfil. And the finished product? Even better.",
    },
    {
      name: "David K.",
      location: "Midhurst",
      text: "After being ghosted by two other contractors, Golden Maple was a completely different experience. Daily updates, a clean site, and they finished on time. Our neighbours keep coming over to ask who did the work.",
    }
  ];

  return (
    <section className="section-padding bg-brand-cream">
      <div className="container-custom">
        <Reveal className="text-center max-w-3xl mx-auto mb-12 md:mb-24">
          <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-green-dark mb-6 block font-medium">
            Real Homeowners. Real Results.
          </span>
          <h2 className="font-display text-4xl md:text-7xl font-light text-brand-ink">
            Don't take our word for it.
          </h2>
        </Reveal>
        <div className="no-scrollbar -mx-8 flex snap-x snap-mandatory gap-5 overflow-x-auto px-8 pb-2 md:mx-0 md:grid md:grid-cols-3 md:gap-10 md:overflow-visible md:px-0 md:pb-0">
          {reviews.map((review, idx) => (
            <Reveal key={idx} delay={idx * 0.12} className="w-[84vw] shrink-0 snap-start bg-brand-cream-light p-8 md:w-auto md:shrink md:p-12 rounded-[2px] border border-brand-ink/10 shadow-[0_18px_50px_-30px_rgba(33,30,21,0.45)] relative">
              <Quote size={40} strokeWidth={1} className="text-brand-green-dark/15 absolute top-10 left-10" />
              <div className="relative z-10">
                <div className="flex gap-1 mb-8">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={14} className="fill-brand-gold-dark text-brand-gold-dark" />
                  ))}
                </div>
                <p className="font-sans text-brand-ink italic leading-relaxed mb-10 font-light">
                  "{review.text}"
                </p>
                <div>
                  <p className="font-display text-xl font-light text-brand-ink">{review.name}</p>
                  <p className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-green-dark mt-1 font-medium">{review.location}, ON</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};

const FinalCTA = () => {
  return (
    <section className="section-padding bg-brand-burgundy relative overflow-hidden">
      <div className="absolute inset-0 opacity-40">
          <ResponsiveImage image={projectCoverFull(getProject('barrie-diamond-inlay-patio')!)} sizes="100vw" aspect="fill" className="w-full h-full object-cover" />
      </div>
      <Reveal className="container-custom relative z-10 text-center">
        <h2 className="font-display text-4xl md:text-8xl font-light text-brand-porcelain mb-12 leading-tight">
          This time next year, <br />
          <span className="text-brand-gold italic">you could be living in it.</span>
        </h2>
        <p className="font-sans text-lg text-brand-porcelain/80 max-w-2xl mx-auto mb-10 font-light leading-relaxed">
          Tell us what you're picturing and your planning budget. We can discuss scope, availability and whether the proposed investment fits your project.
        </p>
        <div className="flex flex-col items-center gap-12 mb-16">
          <div className="h-px w-20 bg-brand-gold/30" />
          <span className="font-sans text-base md:text-lg text-brand-gold font-normal tracking-[0.1em] uppercase">
            Start with a project conversation · Current scope and timing confirmed directly
          </span>
          <div className="h-px w-20 bg-brand-gold/30" />
        </div>
        <Link to="/contact" className="btn-primary px-20 py-5">
          Get My Estimate
        </Link>
      </Reveal>
    </section>
  );
};

const ContractorPainPoints = () => {
  const points = [
    {
      pain: "Your Patio is Sinking After One Winter",
      cause: "They dug 6 inches, threw down some gravel, and called it a base. Now your stones are uneven and you're back to square one.",
      solution: "We review drainage, soil, access, and the project-specific excavation/base plan before finalizing a written scope.",
      icon: Compass
    },
    {
      pain: "They Took Your Deposit and Disappeared",
      cause: "They were responsive before you paid. Now it's been three weeks with no updates, no timeline, and no one answering the phone.",
      solution: "Yorkis is on-site personally. You get daily photo updates and direct communication from the owner — not an answering machine.",
      icon: Clock
    },
    {
      pain: "The 'Final' Price Kept Climbing",
      cause: "What started as a $15K quote turned into $22K after 'unforeseen' extras. Sound familiar?",
      solution: "We give you a fixed, detailed quote upfront. The price we agree on is the price you pay. No exceptions, no surprises.",
      icon: Shield
    },
    {
      pain: "Your Property Looked Like a Construction Zone",
      cause: "Materials dumped on the lawn, equipment blocking the driveway, debris everywhere for weeks.",
      solution: "Our crew cleans and organizes the site every single day. Your neighbours won't even know we're there.",
      icon: CheckCircle
    }
  ];

  return (
    <section className="section-padding bg-brand-nearblack">
      <div className="container-custom">
        <Reveal className="max-w-4xl mx-auto text-center mb-12 md:mb-24">
          <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-6 block">
            Sound Familiar?
          </span>
          <h2 className="font-display text-4xl md:text-7xl font-light text-brand-bonewhite leading-tight mb-10">
            You've been burned <br />
            <span className="text-brand-gold-dark italic">by a contractor before.</span>
          </h2>
          <p className="font-sans text-lg text-brand-muted leading-relaxed font-light">
            Compare more than the headline price. Ask each contractor to explain site preparation, drainage, written scope, payment stages and how changes will be approved.
          </p>
        </Reveal>

        <div className="no-scrollbar -mx-8 flex snap-x snap-mandatory gap-5 overflow-x-auto px-8 pb-2 md:mx-0 md:grid md:grid-cols-2 md:gap-12 md:overflow-visible md:px-0 md:pb-0">
          {points.map((point, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="w-[86vw] shrink-0 snap-start bg-brand-surface p-7 md:w-auto md:shrink md:p-12 rounded-[2px] border border-brand-dim/10"
            >
              <div className="flex items-start gap-5 md:gap-8">
                <div className="w-14 h-14 bg-brand-midsurface flex items-center justify-center rounded-[2px] shrink-0 shadow-sm border border-brand-dim/10">
                  <point.icon className="text-brand-gold-dark" size={24} strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="font-display text-2xl font-light text-brand-bonewhite mb-6">{point.pain}</h3>
                  <div className="space-y-6">
                    <div className="flex gap-4">
                      <span className="font-sans text-[10px] font-normal uppercase tracking-widest text-brand-error shrink-0 mt-1">Typical:</span>
                      <p className="font-sans text-sm text-brand-muted italic font-light">{point.cause}</p>
                    </div>
                    <div className="flex gap-4">
                      <span className="font-sans text-[10px] font-normal uppercase tracking-widest text-brand-gold-dark shrink-0 mt-1">Our Way:</span>
                      <p className="font-sans text-sm text-brand-bonewhite font-normal">{point.solution}</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default function Home() {
  // NO local LocalBusiness schema here. This page used to define its own,
  // which shipped a stale dev Cloud Run URL as the business @id/url/image
  // into production, plus a postal code (L4M) that disagreed with the
  // canonical one (L4N) elsewhere — two conflicting LocalBusiness identities
  // for one business. root.tsx's `businessGraph` already emits the single
  // canonical #business entity (with real reviews/rating) on every route,
  // this one included. Do not re-add a per-page schema here.

  return (
    <>
      <SEO
        title="Barrie Landscaping Company | Patios, Interlock & Retaining Walls"
        description="Barrie landscaping for interlocking patios, driveways, retaining walls and outdoor spaces across Simcoe County. Get an instant cost range and contact us to confirm project details."
        canonical="https://goldenmaplelandscaping.ca/"
      />
      <HeroDepth />
      <ServicesGrid />
      <SelectedWork />
      <InstagramFeed />
      <Manifesto />
      <ContractorPainPoints />
      <WhyGoldenMaple />
      <Process />
      <Testimonials />
      <section className="section-padding bg-brand-nearblack border-t border-brand-dim/5">
      <div className="container-custom">
        <div className="max-w-3xl mx-auto mb-10 md:mb-20 text-center">
          <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-6 block">Common Questions</span>
          <h2 className="font-display text-4xl md:text-6xl font-light text-brand-bonewhite">Expert Insights.</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 max-w-5xl mx-auto">
          {[
            {
              q: "Why do you dig so much deeper than other contractors?",
              a: "Freeze-thaw, drainage, soil, access, and the intended use all affect site preparation. We confirm the project-specific excavation and base plan in the written scope."
            },
            {
              q: "Why TimberTech instead of regular wood decking?",
              a: "Because nobody wants to spend their weekends sanding and staining a deck. TimberTech AZEK doesn't rot, warp, or splinter — even after decades of Simcoe County snow and ice. It looks like real wood without any of the maintenance, and it comes with up to a 50-year warranty."
            },
            {
              q: "What if something goes wrong after the project is done?",
              a: publicClaimCopy(BUSINESS.credentials.workmanshipWarranty, 'Written workmanship terms are available for your project.')
            },
            {
              q: "Is there a fee to get started?",
              a: publicClaimCopy(BUSINESS.commercialPolicies.consultation, 'Contact us to confirm the current consultation and design scope.')
            }
          ].map((faq, idx) => (
            <div key={idx} className="bg-brand-surface p-7 md:p-10 border border-brand-dim/10 rounded-[2px] hover:border-brand-gold/20 transition-colors">
              <h3 className="font-display text-2xl font-light text-brand-gold-dark mb-4 md:mb-6 leading-tight">{faq.q}</h3>
              <p className="font-sans text-base text-brand-muted leading-relaxed font-light">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    <BuyersGuide />
    <FinalCTA />
    </>
  );
}
