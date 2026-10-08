import { ArrowRight, Shield, Award, CheckCircle, Compass, Clock } from 'lucide-react';
import SEO from '../components/SEO';
import BuyersGuide from '../components/BuyersGuide';
import Manifesto from '../components/Manifesto';
import Process from '../components/Process';
import HeroDepth from '../components/HeroDepth';
import GoogleReviewsLink from '../components/GoogleReviewsLink';
import { Link } from 'react-router-dom';
import Reveal from '../components/Reveal';
import { BUSINESS, publicClaimCopy } from '../data/business';
import { OWNER_FACTS, ownerFact } from '../data/ownerFacts';
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
          <Link to="/services/outdoor-kitchens-barrie" className="hover:text-brand-ink">Outdoor kitchens</Link>
          <Link to="/contact" className="hover:text-brand-ink">Fire features</Link>
          <Link to="/contact" className="hover:text-brand-ink">Landscape lighting</Link>
          <Link to="/services/seasonal-cleanup-barrie" className="hover:text-brand-ink">Spring &amp; fall clean-ups</Link>
        </div>
      </div>
    </section>
  );
};

const WhyGoldenMaple = () => {
  const years = ownerFact(OWNER_FACTS.yearsInBusiness);
  const standards = [
    { icon: Compass, title: 'Project-specific site preparation', body: 'Drainage, soil conditions, access, and final excavation/base depth are reviewed for the written scope of each project.' },
    { icon: Shield, title: 'Coverage on file', body: publicClaimCopy(BUSINESS.credentials.liabilityInsurance, ''), },
    { icon: Award, title: 'Written workmanship terms', body: publicClaimCopy(BUSINESS.credentials.workmanshipWarranty, ''), },
  ].filter((item) => item.body);
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
                    <h3 className="font-display text-2xl font-light text-brand-ink mb-3">{s.title}</h3>
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
            {years && (
              <div className="absolute -bottom-10 -left-10 bg-brand-green-dark p-8 hidden md:block rounded-[2px] shadow-xl max-w-[220px]">
                <span className="font-display text-3xl font-light text-brand-porcelain block mb-2">{years}</span>
              </div>
            )}
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
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10 lg:gap-12 mb-14 md:mb-20">
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

const GoogleReviews = () => (
  <section className="section-padding bg-brand-cream">
    <div className="container-custom text-center max-w-2xl mx-auto">
      <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-green-dark mb-6 block font-medium">
        Reviews
      </span>
      <h2 className="font-display text-4xl md:text-6xl font-light text-brand-ink mb-8">
        Read what homeowners wrote on Google.
      </h2>
      <p className="font-sans text-base text-brand-ink-soft font-light leading-relaxed mb-8">
        We don&apos;t reprint reviews on this site. The current comments, photos, and rating live on our Google listing.
      </p>
      <GoogleReviewsLink className="btn-primary inline-flex" />
    </div>
  </section>
);

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
      solution: "Yorkis Estevez is the founder and lead builder. You talk to the person responsible for the job, and the written scope is what the crew builds.",
      icon: Clock
    },
    {
      pain: "The 'Final' Price Kept Climbing",
      cause: "What started as a $15K quote turned into $22K after 'unforeseen' extras. Sound familiar?",
      solution: "The written quote is the price for the written scope. If the work changes, we write the change and you approve it before the price moves.",
      icon: Shield
    },
    {
      pain: "Your Property Looked Like a Construction Zone",
      cause: "Materials dumped on the lawn, equipment blocking the driveway, debris everywhere for weeks.",
      solution: "The written scope says how the work area is protected and how the property is left when the job is done.",
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
            <div key={idx} className="w-[86vw] shrink-0 snap-start bg-brand-surface p-7 md:w-auto md:shrink md:p-12 rounded-[2px] border border-brand-dim/10">
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
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const HOME_FAQS = [
  {
    q: 'Why is the base different on every property?',
    a: 'Freeze-thaw, drainage, soil, access, and how you will use the surface all change the excavation and base. Those details are written into the scope for that property. There is no single depth we publish for every patio.',
  },
  {
    q: 'Why TimberTech instead of regular wood decking?',
    a: 'TimberTech AZEK is a capped composite. It does not need the seasonal sanding and staining that wood decking does, and the manufacturer publishes its own fade and stain warranty for the board line you choose. We confirm that product paperwork with the written scope.',
  },
  {
    q: 'What if a patio is already sinking?',
    a: 'A settled or uneven interlock patio is a repair and re-level, not a new install. Start with the Barrie patio rebuild page, or send the quote form with “Patio repair or re-level” selected.',
  },
  {
    q: 'What happens after I send the form?',
    a: 'We use your name, phone, town, project type, and timing to reply about the scope. Sending the form does not book a date. If you want a time on the calendar, use the booking page once we have the project details.',
  },
].concat(
  [
    publicClaimCopy(BUSINESS.credentials.workmanshipWarranty, ''),
  ].filter(Boolean).map((answer) => ({
    q: 'What workmanship terms are in writing?',
    a: answer,
  })),
);

export default function Home() {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: HOME_FAQS.map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: { '@type': 'Answer', text: faq.a },
    })),
  };

  return (
    <>
      <SEO
        title="Barrie Landscaping Company | Patios, Interlock & Retaining Walls"
        description="Golden Maple builds interlocking patios, driveways, retaining walls and composite decks for homeowners in Barrie and Simcoe County."
        canonical="https://goldenmaplelandscaping.ca/"
        schema={faqSchema}
      />
      <HeroDepth />
      <SelectedWork />
      <ServicesGrid />
      <InstagramFeed />
      <Manifesto />
      <ContractorPainPoints />
      <WhyGoldenMaple />
      <Process />
      <GoogleReviews />
      <section className="section-padding bg-brand-nearblack border-t border-brand-dim/5">
      <div className="container-custom">
        <div className="max-w-3xl mx-auto mb-10 md:mb-20 text-center">
          <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-6 block">Common Questions</span>
          <h2 className="font-display text-4xl md:text-6xl font-light text-brand-bonewhite">Before you ask for a quote.</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 max-w-5xl mx-auto">
          {HOME_FAQS.map((faq) => (
            <div key={faq.q} className="bg-brand-surface p-7 md:p-10 border border-brand-dim/10 rounded-[2px]">
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
