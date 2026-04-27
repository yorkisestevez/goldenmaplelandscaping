import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Shield, Award, CheckCircle, Star, Quote, ChevronRight, Compass, Clock } from 'lucide-react';
import SEO from '../components/SEO';
import BuyersGuide from '../components/BuyersGuide';
import Manifesto from '../components/Manifesto';
import Process from '../components/Process';
import { Link } from 'react-router-dom';
import BeforeAfterSlider from '../components/BeforeAfterSlider';
import QuickQuote from '../components/QuickQuote';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const HERO_IMAGES = [
  "/images/projects/best.JPEG",
  "/images/projects/luxury decking.jpg",
  "/images/projects/Outdoor living life.jpeg",
  "/images/projects/cousy fire feature.jpeg"
];

const Hero = () => {
  const [currentIdx, setCurrentIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % HERO_IMAGES.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative min-h-[95vh] flex items-center overflow-hidden bg-brand-nearblack">
      <div className="absolute inset-0 z-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIdx}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 0.55, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2, ease: "easeOut" }}
            className="absolute inset-0"
          >
            <img
              src={HERO_IMAGES[currentIdx]}
              alt="Premium landscaping project in Barrie, Ontario by Golden Maple Landscaping"
              className="w-full h-full object-cover"
              loading={currentIdx === 0 ? 'eager' : 'lazy'}
              fetchPriority={currentIdx === 0 ? 'high' : 'auto'}
              decoding="async"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-r from-brand-nearblack via-brand-nearblack/60 to-brand-nearblack/20" />
      </div>

      <div className="container-custom relative z-10 py-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-center">
          {/* Hero Copy */}
          <div className="lg:col-span-7">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="flex items-center gap-4 mb-10"
            >
              <div className="h-px w-16 bg-brand-gold" />
              <span className="font-sans text-xs font-normal tracking-[0.4em] uppercase text-brand-gold">
                Barrie, Simcoe County & Cottage Country
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.2 }}
              className="font-display text-5xl md:text-7xl lg:text-8xl font-light text-brand-bonewhite leading-[1.05] mb-12"
            >
              The backyard you've <br />
              <span className="text-brand-gold italic">always pictured.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.4 }}
              className="font-sans text-base md:text-lg text-brand-muted max-w-xl mb-12 leading-relaxed font-light"
            >
              You've spent enough nights staring out the window at a yard that doesn't match the home you've built. We're here to fix that — with an outdoor space engineered to outlast the next twenty winters and become the place your family actually wants to be.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.7 }}
              className="flex items-center gap-8"
            >
              <Link to="/portfolio" className="group flex items-center gap-4 text-brand-bonewhite font-sans text-[11px] uppercase tracking-[0.25em] hover:text-brand-gold transition-colors">
                View Portfolio
                <ArrowRight size={16} strokeWidth={1.5} className="transition-transform group-hover:translate-x-2" />
              </Link>
              <span className="w-px h-4 bg-brand-dim/30 hidden sm:block" />
              <Link to="/cost-estimator" className="hidden sm:flex group items-center gap-4 text-brand-bonewhite font-sans text-[11px] uppercase tracking-[0.25em] hover:text-brand-gold transition-colors">
                Cost Calculator
                <ArrowRight size={16} strokeWidth={1.5} className="transition-transform group-hover:translate-x-2" />
              </Link>
            </motion.div>
          </div>

          {/* Hero Quote Form */}
          <div className="lg:col-span-5 w-full">
            <QuickQuote />
          </div>
        </div>

        {/* Slideshow Progress Dots */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-4">
          {HERO_IMAGES.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIdx(idx)}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-500",
                currentIdx === idx ? "bg-brand-gold w-8" : "bg-brand-muted/30"
              )}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

const TrustBar = () => {
  const items = [
    { icon: Shield, text: "WSIB Certified" },
    { icon: Award, text: "$5M Liability" },
    { icon: CheckCircle, text: "5-Year Sink & Settlement Warranty" },
    { icon: Star, text: "5.0 Google Rating" },
  ];

  return (
    <div className="bg-brand-surface border-b border-brand-dim/10 py-6 md:py-10">
      <div className="container-custom">
        <div className="flex flex-wrap justify-center md:justify-between items-center gap-6 md:gap-8 lg:gap-10">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-4">
              <item.icon className="text-brand-gold" size={20} strokeWidth={1.5} />
              <span className="font-sans text-xs md:text-sm font-normal uppercase tracking-[0.2em] text-brand-muted">
                {item.text}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const ServicesGrid = () => {
  const services = [
    {
      title: "Interlocking Stone & Patios",
      desc: "The patio where your kids grow up, where Saturday dinners happen, where life slows down. We build it on a foundation that won't shift — ever.",
      img: "/images/projects/best.JPEG",
      link: "/services/interlocking-barrie"
    },
    {
      title: "Retaining Walls",
      desc: "Slope problems become your home's best architectural feature. Precision-engineered walls that hold back the earth and turn unusable land into living space.",
      img: "/images/projects/garden-wall.JPEG",
      link: "/services/retaining-walls-barrie"
    },
    {
      title: "Landscape Design",
      desc: "Walk through your future backyard in vivid 3D before we move a single stone. See the vision, refine it, fall in love with it — then watch us build it.",
      img: "/images/projects/rendering1.jpg",
      link: "/services/landscape-design-barrie"
    },
    {
      title: "Composite Decking",
      desc: "The look of real wood with none of the maintenance headaches. No staining, no rotting, no splinters — just 30+ years of barefoot summer evenings.",
      img: "/images/projects/TimberTech Dark Cocoa PrimeCollection Composite Decking Beauty1.jpg",
      link: "/services/composite-decking-barrie"
    },
    {
      title: "Outdoor Kitchens",
      desc: "Stop running in and out of the house. Cook, serve, and entertain in one seamless space designed around how you actually host.",
      img: "/images/projects/luxury outdoor kitchen.jpeg",
      link: "/contact"
    },
    {
      title: "Fire Features",
      desc: "The gathering spot that turns a cool Simcoe County evening into the best part of your week. Custom fire pits that become your family's favourite place.",
      img: "/images/projects/cousy fire feature.jpeg",
      link: "/contact"
    },
    {
      title: "Landscape Lighting",
      desc: "Your outdoor space doesn't clock out at sunset. Professional lighting that makes your property feel safe, dramatic, and alive after dark.",
      img: "/images/projects/IHPX8926.JPEG",
      link: "/contact"
    }
  ];

  return (
    <section className="section-padding bg-brand-nearblack">
      <div className="container-custom">
        <div className="flex flex-col md:flex-row justify-between items-end gap-12 mb-20">
          <div className="max-w-2xl">
            <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold mb-6 block">
              Our Expertise
            </span>
            <h2 className="font-display text-4xl md:text-8xl font-light text-brand-bonewhite leading-tight">
              Mastery in every detail.
            </h2>
          </div>
          <Link to="/services" className="group flex items-center gap-3 text-brand-bonewhite font-sans text-[11px] uppercase tracking-[0.2em] hover:text-brand-gold transition-colors">
            View All Services
            <ChevronRight size={18} strokeWidth={1.5} />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-10">
          {services.map((service, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className={cn(
                "group bg-brand-surface rounded-[2px] overflow-hidden border border-brand-dim/10 hover:border-brand-gold/30 transition-all duration-500 flex flex-col",
                idx >= 4 ? "lg:col-span-1" : ""
              )}
            >
              <div className="h-80 overflow-hidden relative">
                <img
                  src={service.img}
                  alt={`${service.title} in Barrie & Simcoe County by Golden Maple Landscaping`}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-brand-nearblack/20 group-hover:bg-transparent transition-colors" />
              </div>
              <div className="p-10 md:p-12 flex flex-col flex-1">
                <h3 className="font-display text-2xl font-light text-brand-bonewhite mb-5 group-hover:text-brand-gold transition-colors min-h-[4rem] flex items-center">
                  {service.title}
                </h3>
                <p className="font-sans text-sm text-brand-muted leading-relaxed mb-10 font-light flex-1">
                  {service.desc}
                </p>
                <Link to={service.link} className="flex items-center gap-4 text-brand-gold font-sans text-xs uppercase tracking-[0.2em] font-medium mt-auto">
                  Explore Service
                  <ArrowRight size={16} strokeWidth={1.5} className="transition-transform group-hover:translate-x-2" />
                </Link>
                </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const WhyGoldenMaple = () => {
  return (
    <section className="section-padding bg-brand-surface text-brand-bonewhite overflow-hidden relative">
      <div className="container-custom relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
          <div>
            <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold mb-10 block">
              The Golden Maple Standard
            </span>
            <h2 className="font-display text-4xl md:text-7xl font-light leading-tight mb-12">
              Why your neighbour's <br />
              <span className="text-brand-gold italic">patio is already sinking.</span>
            </h2>
            <div className="space-y-12">
              <div className="flex gap-8">
                <div className="w-14 h-14 bg-brand-midsurface flex items-center justify-center rounded-[2px] shrink-0 border border-brand-dim/10">
                  <Compass className="text-brand-gold" size={24} strokeWidth={1.5} />
                </div>
                <div>
                  <h4 className="font-display text-2xl font-light text-brand-bonewhite mb-3">We Dig Twice as Deep</h4>
                  <p className="font-sans text-sm text-brand-muted leading-relaxed font-light">
                    Most contractors dig 6-8 inches and call it done. We dig 12-16". That's the difference between a patio that lasts three winters and one that lasts thirty years.
                  </p>
                </div>
              </div>
              <div className="flex gap-8">
                <div className="w-14 h-14 bg-brand-midsurface flex items-center justify-center rounded-[2px] shrink-0 border border-brand-dim/10">
                  <Shield className="text-brand-gold" size={24} strokeWidth={1.5} />
                </div>
                <div>
                  <h4 className="font-display text-2xl font-light text-brand-bonewhite mb-3">Fully Protected. Zero Risk to You.</h4>
                  <p className="font-sans text-sm text-brand-muted leading-relaxed font-light">
                    WSIB certified. $5 million in liability coverage. Ask your current contractor if they can say the same — most can't. We protect your family's biggest investment like it's our own.
                  </p>
                </div>
              </div>
              <div className="flex gap-8">
                <div className="w-14 h-14 bg-brand-midsurface flex items-center justify-center rounded-[2px] shrink-0 border border-brand-dim/10">
                  <Award className="text-brand-gold" size={24} strokeWidth={1.5} />
                </div>
                <div>
                  <h4 className="font-display text-2xl font-light text-brand-bonewhite mb-3">If It Sinks, We Come Back. Period.</h4>
                  <p className="font-sans text-sm text-brand-muted leading-relaxed font-light">
                    Our 5-year sink and settlement warranty isn't just a piece of paper. It's our promise that what we build will stay exactly where we put it. We've never had to honour a claim — and that's the point.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="aspect-[4/5] rounded-[2px] overflow-hidden shadow-2xl border border-brand-dim/10">
              <img
                src="/images/projects/paver-driveway.JPG"
                alt="Engineered paver driveway with proper base prep, Barrie ON"
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="absolute -bottom-10 -left-10 bg-brand-gold p-12 hidden md:block rounded-[2px]">
              <span className="font-display text-7xl font-light text-brand-nearblack block mb-2">10+</span>
              <span className="font-sans text-[10px] font-normal uppercase tracking-[0.25em] text-brand-nearblack">Years of Excellence</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const BeforeAfterSection = () => {
  return (
    <section className="section-padding bg-brand-nearblack">
      <div className="container-custom">
        <div className="text-center max-w-3xl mx-auto mb-24">
          <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold mb-6 block">
            Transformations
          </span>
          <h2 className="font-display text-4xl md:text-7xl font-light text-brand-bonewhite">
            This is what's possible.
          </h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
          <BeforeAfterSlider 
            beforeImage="/images/projects/WhatsApp Image 2026-03-20 at 8.12.26 PM.jpeg"
            afterImage="/images/projects/IMG_4826.jpg"
          />
          <div className="flex flex-col justify-center space-y-10">
            <h3 className="font-display text-3xl md:text-4xl font-light text-brand-bonewhite leading-tight">They almost sold this house. Now they never want to leave.</h3>
            <p className="font-sans text-brand-muted leading-relaxed font-light">
              This Barrie family was ready to move. Their backyard was unusable — overgrown, uneven, and an eyesore. We regraded the entire site, installed a 14-inch structural base, and built them the multi-level entertaining space they'd been dreaming about since they bought the home.
            </p>
            <ul className="space-y-5">
              {['Custom Retaining Walls', 'Permeable Paver Installation', 'Integrated Landscape Lighting', 'Natural Stone Accents'].map((item, i) => (
                <li key={i} className="flex items-center gap-4 font-sans font-normal text-[11px] uppercase tracking-[0.2em] text-brand-bonewhite">
                  <CheckCircle size={16} strokeWidth={1.5} className="text-brand-gold" />
                  {item}
                </li>
              ))}
            </ul>
            <Link to="/portfolio" className="btn-ghost w-fit">View More Projects</Link>
          </div>
        </div>
      </div>
    </section>
  );
};

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
    <section className="section-padding bg-brand-surface">
      <div className="container-custom">
        <div className="text-center max-w-3xl mx-auto mb-24">
          <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold mb-6 block">
            Real Homeowners. Real Results.
          </span>
          <h2 className="font-display text-4xl md:text-7xl font-light text-brand-bonewhite">
            Don't take our word for it.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {reviews.map((review, idx) => (
            <div key={idx} className="bg-brand-midsurface p-12 rounded-[2px] border border-brand-dim/10 relative">
              <Quote size={40} strokeWidth={1} className="text-brand-gold/10 absolute top-10 left-10" />
              <div className="relative z-10">
                <div className="flex gap-1 mb-8">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={14} className="fill-brand-gold text-brand-gold" />
                  ))}
                </div>
                <p className="font-sans text-brand-bonewhite italic leading-relaxed mb-10 font-light">
                  "{review.text}"
                </p>
                <div>
                  <p className="font-display text-xl font-light text-brand-bonewhite">{review.name}</p>
                  <p className="font-sans text-[10px] uppercase tracking-[0.25em] text-brand-gold mt-1">{review.location}, ON</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const FinalCTA = () => {
  return (
    <section className="section-padding bg-brand-nearblack relative overflow-hidden">
      <div className="absolute inset-0 opacity-40">
          <img
            src="/images/projects/best.JPEG"
            alt="Completed luxury backyard transformation in Simcoe County"
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
      </div>
      <div className="container-custom relative z-10 text-center">
        <h2 className="font-display text-4xl md:text-8xl font-light text-brand-bonewhite mb-12 leading-tight">
          This time next year, <br />
          <span className="text-brand-gold italic">you could be living in it.</span>
        </h2>
        <p className="font-sans text-lg text-brand-bonewhite/80 max-w-2xl mx-auto mb-10 font-light leading-relaxed">
          Start with a 15-minute call. Tell us about the space you've been picturing. We'll tell you honestly whether your vision and your budget can meet — and if they can, we'll walk it through with you, every step.
        </p>
        <div className="flex flex-col items-center gap-12 mb-16">
          <div className="h-px w-20 bg-brand-gold/30" />
          <span className="font-sans text-base md:text-lg text-brand-gold font-normal tracking-[0.1em] uppercase">
            Free 15-min discovery call · No fee, no pressure
          </span>
          <div className="h-px w-20 bg-brand-gold/30" />
        </div>
        <Link to="/contact" className="btn-primary px-20 py-5">
          Let's Talk About Your Property
        </Link>
      </div>
    </section>
  );
};

const ContractorPainPoints = () => {
  const points = [
    {
      pain: "Your Patio is Sinking After One Winter",
      cause: "They dug 6 inches, threw down some gravel, and called it a base. Now your stones are uneven and you're back to square one.",
      solution: "We excavate 12-16 inches deep and use structural-grade clear stone — so your patio looks the same in year ten as it did on day one.",
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
        <div className="max-w-4xl mx-auto text-center mb-24">
          <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold mb-6 block">
            Sound Familiar?
          </span>
          <h2 className="font-display text-4xl md:text-7xl font-light text-brand-bonewhite leading-tight mb-10">
            You've been burned <br />
            <span className="text-brand-gold italic">by a contractor before.</span>
          </h2>
          <p className="font-sans text-lg text-brand-muted leading-relaxed font-light">
            We hear it every week. Homeowners in Barrie who hired someone "affordable" and got sinking stones, ghosted communication, and surprise invoices. We built Golden Maple to be the opposite of that experience.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {points.map((point, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="bg-brand-surface p-12 rounded-[2px] border border-brand-dim/10"
            >
              <div className="flex items-start gap-8">
                <div className="w-14 h-14 bg-brand-midsurface flex items-center justify-center rounded-[2px] shrink-0 shadow-sm border border-brand-dim/10">
                  <point.icon className="text-brand-gold" size={24} strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="font-display text-2xl font-light text-brand-bonewhite mb-6">{point.pain}</h3>
                  <div className="space-y-6">
                    <div className="flex gap-4">
                      <span className="font-sans text-[10px] font-normal uppercase tracking-widest text-brand-burgundy shrink-0 mt-1">Typical:</span>
                      <p className="font-sans text-sm text-brand-muted italic font-light">{point.cause}</p>
                    </div>
                    <div className="flex gap-4">
                      <span className="font-sans text-[10px] font-normal uppercase tracking-widest text-brand-gold shrink-0 mt-1">Our Way:</span>
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

const SocialProofStrip = () => {
  const stats = [
    { number: "5.0", label: "Google Rating", sub: "42+ verified reviews" },
    { number: "10+", label: "Years in Barrie", sub: "Since 2014" },
    { number: "12-16\"", label: "Base Depth", sub: "2× industry standard" },
    { number: "$5M", label: "Liability Coverage", sub: "WSIB certified" },
  ];

  return (
    <section className="py-16 md:py-20 bg-brand-surface border-y border-brand-dim/10">
      <div className="container-custom">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {stats.map((stat, idx) => (
            <div key={idx} className="text-center">
              <span className="font-display text-4xl md:text-5xl font-light text-brand-gold block mb-3">{stat.number}</span>
              <span className="font-sans text-[11px] uppercase tracking-[0.25em] text-brand-bonewhite block mb-2 font-medium">{stat.label}</span>
              <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-brand-muted font-light">{stat.sub}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default function Home() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "Golden Maple Landscaping",
    "image": "https://ais-dev-nbspxodpsmicgderdsv3ck-152684830137.us-east1.run.app/logo.png",
    "@id": "https://ais-dev-nbspxodpsmicgderdsv3ck-152684830137.us-east1.run.app",
    "url": "https://ais-dev-nbspxodpsmicgderdsv3ck-152684830137.us-east1.run.app",
    "telephone": "+1-705-500-3581",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Barrie, Ontario",
      "addressLocality": "Barrie",
      "addressRegion": "ON",
      "postalCode": "L4M",
      "addressCountry": "CA"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": 44.3894,
      "longitude": -79.6903
    },
    "openingHoursSpecification": {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday"
      ],
      "opens": "08:00",
      "closes": "18:00"
    },
    "sameAs": [
      "https://www.instagram.com/goldenmaplelandscaping"
    ]
  };

  return (
    <>
      <SEO 
        title="Premium Landscaping & Hardscape Contractor | Barrie ON"
        description="Transform your outdoor space with Barrie's top-rated hardscape contractor. Interlocking, decking, retaining walls & more. 5-star reviews. Get a free quote."
        schema={schema}
      />
      <Hero />
      <TrustBar />
      <SocialProofStrip />
      <ServicesGrid />
      <Manifesto />
      <ContractorPainPoints />
      <WhyGoldenMaple />
      <BeforeAfterSection />
      <Process />
      <Testimonials />
      <section className="section-padding bg-brand-black border-t border-brand-dim/5">
      <div className="container-custom">
        <div className="max-w-3xl mx-auto mb-20 text-center">
          <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold mb-6 block">Common Questions</span>
          <h2 className="font-display text-4xl md:text-6xl font-light text-brand-bonewhite">Expert Insights.</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-5xl mx-auto">
          {[
            {
              q: "Why do you dig so much deeper than other contractors?",
              a: "Because Barrie's freeze-thaw cycle is brutal. A 6-inch base might look fine the first summer, but by the second winter your stones are shifting. We dig 12-16 inches and use clear stone that drains properly — because fixing a sinking patio costs more than doing it right the first time."
            },
            {
              q: "Why TimberTech instead of regular wood decking?",
              a: "Because nobody wants to spend their weekends sanding and staining a deck. TimberTech AZEK doesn't rot, warp, or splinter — even after decades of Simcoe County snow and ice. It looks like real wood without any of the maintenance, and it comes with up to a 50-year warranty."
            },
            {
              q: "What if something goes wrong after the project is done?",
              a: "Then we come back and fix it. Our 5-year sink and settlement warranty means if anything shifts or settles, it's on us. But honestly? We've never had to honour a claim. That's what happens when you build things properly from the start."
            },
            {
              q: "Is there a fee to get started?",
              a: "No. Your first conversation with us is a free 15-minute discovery call by phone — honest scope assessment, honest budget feedback, no pressure. If we're the right fit for your project, we'll come walk your property at no charge. The only paid step in our process is full landscape design, which only applies if you want detailed 3D plans before construction."
            }
          ].map((faq, idx) => (
            <div key={idx} className="bg-brand-surface p-10 border border-brand-dim/10 rounded-[2px] hover:border-brand-gold/20 transition-colors">
              <h3 className="font-display text-2xl font-light text-brand-gold mb-6 leading-tight">{faq.q}</h3>
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
