import { Link, useLocation } from 'react-router-dom';
import React, { useRef, useState, useEffect } from 'react';
import { lazy, Suspense } from 'react';
import { Phone, MapPin, Mail, Shield, Award, ChevronDown, Instagram, Facebook } from 'lucide-react';
import { trackEngagement, trackCall } from '../utils/analytics';
import { onInteractOrIdle } from '../utils/defer';
const ChatWidget = lazy(() => import('./ChatWidget'));
import { cn } from '../utils/cn';
import { BUSINESS, publicClaimCopy, publicContact } from '../data/business';

// Canonical profile URLs live in src/data/business.ts — never hardcode handles here.
const SOCIAL_LINKS = [
  { name: 'Instagram', Icon: Instagram, url: BUSINESS.urls.instagram.value },
  { name: 'Facebook', Icon: Facebook, url: BUSINESS.urls.facebook.value },
] as const;


// Service pages linked from the mobile menu and the site-wide footer.
const SERVICE_LINKS = [
  { href: "/services/interlocking-barrie", label: "Interlocking Stone" },
  { href: "/services/interlocking-driveways-barrie", label: "Interlock Driveways" },
  { href: "/services/porcelain-patios-barrie", label: "Porcelain Patios" },
  { href: "/services/composite-decking-barrie", label: "Composite Decking" },
  { href: "/services/retaining-walls-barrie", label: "Retaining Walls" },
  { href: "/services/outdoor-kitchens-barrie", label: "Outdoor Kitchens" },
  { href: "/services/front-entrance-landscaping-barrie", label: "Front Entrances" },
  { href: "/services/seasonal-cleanup-barrie", label: "Seasonal Clean-Ups" },
  { href: "/services/landscape-design-barrie", label: "Landscape Design" },
];

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const resourcesRef = useRef<HTMLDivElement>(null);
  const servicesRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isMobileMenuOpen]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const navLinks = [
    { href: "/services", label: "Services", hasServicesDropdown: true },
    { href: "/portfolio", label: "Portfolio" },
    { href: "/cost-estimator", label: "Cost Estimator" },
    { href: "/process", label: "Process" },
    { href: "/resources", label: "Resources", hasDropdown: true },
    { href: "/about", label: "About" },
  ];

  const flagshipServices = [
    { href: "/services/interlocking-barrie", label: "Interlocking Stone", desc: "Patios, walkways, driveways" },
    { href: "/services/composite-decking-barrie", label: "Composite Decking", desc: "TimberTech & Trex builds" },
    { href: "/services/retaining-walls-barrie", label: "Retaining Walls", desc: "Engineered with geogrid" },
    { href: "/services/landscape-design-barrie", label: "Landscape Design", desc: "3D plans + fixed quotes" },
  ];

  const serviceLocationPills = [
    { slug: "barrie", label: "Barrie" },
    { slug: "innisfil", label: "Innisfil" },
    { slug: "oro-medonte", label: "Oro-Medonte" },
    { slug: "springwater", label: "Springwater" },
    { slug: "orillia", label: "Orillia" },
    { slug: "wasaga-beach", label: "Wasaga Beach" },
    { slug: "midland", label: "Midland" },
    { slug: "collingwood", label: "Collingwood" },
  ];

  const resourceLinks = [
    { href: "/library", label: "Outdoor Construction Library" },
    { href: "/cost-guide", label: "Free 2026 Cost Guide (PDF)" },
    { href: "/buyers-guide", label: "Buyer's Guide" },
    { href: "/cost-estimator", label: "Cost Estimator" },
    { href: "/resources/landscaping-cost-guide-barrie", label: "Landscaping Cost Guide" },
    { href: "/resources/interlocking-patio-cost-ontario", label: "Interlocking Patio Costs" },
    { href: "/resources/hidden-costs-cheap-landscaping", label: "Hidden Costs of Cheap Quotes" },
    { href: "/resources/why-patios-sink-barrie", label: "Why Patios Sink in Barrie" },
    { href: "/resources/timbertech-vs-wood-decking-ontario", label: "TimberTech vs. Wood" },
    { href: "/resources/retaining-wall-guide-simcoe-county", label: "Retaining Wall Guide" },
    { href: "/resources/how-to-choose-landscaping-contractor-barrie", label: "Choosing a Contractor" },
    { href: "/resources/unilock-vs-techo-bloc-vs-permacon", label: "Paver Brand Comparison" },
  ];


  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 max-w-full overflow-x-clip transition-all duration-500",
          isScrolled || isMobileMenuOpen
            ? 'bg-brand-nearblack/95 backdrop-blur-md border-b border-brand-dim/70 py-3'
            : 'bg-brand-nearblack/95 backdrop-blur-md border-b border-brand-dim/70 py-5'
        )}
      >
        <div className="container-custom flex items-center justify-between">
          {/* Logo */}
          <Link
            to="/"
            onClick={() => setIsMobileMenuOpen(false)}
            className="flex items-center gap-2.5 group relative z-50 shrink-0 mr-6"
          >
            <img
              src="/logo-mark.webp"
              alt="Golden Maple Landscaping"
              width={160}
              height={129}
              decoding="async"
              fetchPriority="low"
              className="h-9 md:h-11 w-auto"
            />
            <span className="flex flex-col">
              <span className="font-display text-lg md:text-2xl xl:text-xl 2xl:text-3xl leading-none tracking-tight text-brand-bonewhite group-hover:text-brand-gold-dark transition-colors duration-500">
                GOLDEN MAPLE
              </span>
              <span className="font-sans text-[9px] md:text-[11px] uppercase tracking-[0.22em] xl:tracking-[0.14em] 2xl:tracking-[0.28em] font-light text-brand-gold-dark mt-1.5">
                Landscaping
              </span>
            </span>
          </Link>

          {/* Desktop Nav - centered */}
          <nav className="hidden xl:flex items-center gap-3 2xl:gap-6 mx-auto min-w-0">
            {navLinks.map((link) => (
              link.hasServicesDropdown ? (
                <div
                  key={link.href}
                  className="relative"
                  ref={servicesRef}
                  onMouseEnter={() => setServicesOpen(true)}
                  onMouseLeave={() => setServicesOpen(false)}
                >
                  <Link
                    to={link.href}
                    className={cn(
                      "font-sans text-[9px] 2xl:text-[10px] uppercase tracking-[0.12em] 2xl:tracking-[0.18em] transition-colors hover:text-brand-gold-dark font-medium whitespace-nowrap flex items-center gap-1",
                      location.pathname.startsWith('/services') ? "text-brand-gold-dark" : "text-brand-bonewhite"
                    )}
                  >
                    {link.label}
                    <ChevronDown size={10} strokeWidth={2} className={cn("transition-transform", servicesOpen && "rotate-180")} />
                  </Link>
                  
                    {servicesOpen && (
                      <div className="absolute top-full left-1/2 -translate-x-1/2 pt-4 w-[640px]">
                        <div className="bg-brand-surface border border-brand-dim/40 rounded-[2px] shadow-2xl p-8 grid grid-cols-2 gap-x-8 gap-y-2">
                          <div>
                            <span className="font-sans text-[11px] uppercase tracking-[0.2em] text-brand-gold-dark font-medium mb-4 block">
                              Flagship Services
                            </span>
                            <div className="space-y-1">
                              {flagshipServices.map((s) => (
                                <Link
                                  key={s.href}
                                  to={s.href}
                                  className="group block px-3 py-2.5 hover:bg-brand-nearblack/50 rounded-[2px] transition-all"
                                >
                                  <div className="font-sans text-[13px] text-brand-bonewhite group-hover:text-brand-gold-dark font-medium transition-colors">
                                    {s.label}
                                  </div>
                                  <div className="font-sans text-[11px] text-brand-bonewhite/70 font-light mt-0.5">
                                    {s.desc}
                                  </div>
                                </Link>
                              ))}
                            </div>
                          </div>
                          <div>
                            <span className="font-sans text-[11px] uppercase tracking-[0.2em] text-brand-gold-dark font-medium mb-4 block">
                              Service Areas
                            </span>
                            <div className="grid grid-cols-2 gap-1">
                              {serviceLocationPills.map((l) => (
                                <Link
                                  key={l.slug}
                                  to={`/services/interlocking-${l.slug}`}
                                  className="font-sans text-[12px] text-brand-bonewhite/85 hover:text-brand-gold-dark hover:bg-brand-nearblack/50 px-3 py-2 rounded-[2px] transition-all"
                                >
                                  {l.label}
                                </Link>
                              ))}
                            </div>
                            <div className="border-t border-brand-dim/30 mt-4 pt-3">
                              <Link
                                to="/services"
                                className="font-sans text-[10px] uppercase tracking-[0.2em] text-brand-gold-dark hover:text-brand-black font-medium"
                              >
                                View All Services →
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  
                </div>
              ) : link.hasDropdown ? (
                <div 
                  key={link.href}
                  className="relative"
                  ref={resourcesRef}
                  onMouseEnter={() => setResourcesOpen(true)}
                  onMouseLeave={() => setResourcesOpen(false)}
                >
                  <Link 
                    to={link.href} 
                    className={cn(
                      "font-sans text-[9px] 2xl:text-[10px] uppercase tracking-[0.12em] 2xl:tracking-[0.18em] transition-colors hover:text-brand-gold-dark font-medium whitespace-nowrap flex items-center gap-1",
                      location.pathname.startsWith('/resources') || location.pathname === '/buyers-guide' || location.pathname === '/cost-estimator' ? "text-brand-gold-dark" : "text-brand-bonewhite"
                    )}
                  >
                    {link.label}
                    <ChevronDown size={10} strokeWidth={2} className={cn("transition-transform", resourcesOpen && "rotate-180")} />
                  </Link>
                  
                    {resourcesOpen && (
                      <div className="absolute top-full left-1/2 -translate-x-1/2 pt-4 w-64">
                        <div className="bg-brand-surface border border-brand-dim/40 rounded-[2px] shadow-2xl py-2 overflow-hidden">
                          {resourceLinks.map((item) => (
                            <Link
                              key={item.href}
                              to={item.href}
                              className="block px-5 py-2.5 font-sans text-[11px] uppercase tracking-[0.15em] text-brand-bonewhite/85 hover:text-brand-gold-dark hover:bg-brand-nearblack/50 font-medium transition-all"
                            >
                              {item.label}
                            </Link>
                          ))}
                          <div className="border-t border-brand-dim/30 mt-1.5 pt-1.5">
                            <Link
                              to="/resources"
                              className="block px-5 py-2.5 font-sans text-[11px] uppercase tracking-[0.15em] text-brand-gold-dark hover:bg-brand-nearblack/50 font-medium transition-all"
                            >
                              View All Articles →
                            </Link>
                          </div>
                        </div>
                      </div>
                    )}
                  
                </div>
              ) : (
                <Link 
                  key={link.href} 
                  to={link.href} 
                  className={cn(
                    "font-sans text-[9px] 2xl:text-[10px] uppercase tracking-[0.12em] 2xl:tracking-[0.18em] transition-colors hover:text-brand-gold-dark font-medium whitespace-nowrap",
                    location.pathname === link.href ? "text-brand-gold-dark" : "text-brand-bonewhite"
                  )}
                >
                  {link.label}
                </Link>
              )
            ))}
          </nav>

          {/* Right Side CTA group */}
          <div className="hidden xl:flex items-center gap-3 2xl:gap-5 shrink-0 ml-3 pl-3 border-l border-brand-dim/50">
            <Link 
              to="/contact" 
              className={cn(
                "font-sans text-[9px] 2xl:text-[10px] uppercase tracking-[0.12em] 2xl:tracking-[0.18em] transition-colors hover:text-brand-gold-dark font-medium",
                location.pathname === "/contact" ? "text-brand-gold-dark" : "text-brand-bonewhite"
              )}
            >
              Contact
            </Link>
            
            <a href={`tel:${publicContact.phoneTel}`} onClick={() => trackCall('phone_call')} className="inline-flex items-center gap-2 font-sans text-[12px] 2xl:text-[13px] tabular-nums text-brand-bonewhite hover:text-brand-gold-dark whitespace-nowrap" aria-label={`Call ${publicContact.phoneDisplay}`}>
              <Phone size={14} strokeWidth={2} />
              <span>{publicContact.phoneDisplay}</span>
            </a>

            <Link to="/contact" onClick={() => trackEngagement('cta_click', 'get_estimate_nav')} className="btn-primary !py-2 !px-3 2xl:!py-2.5 2xl:!px-5 whitespace-nowrap !text-[9px] 2xl:!text-[10px]">
              <span className="2xl:hidden">Get estimate</span>
              <span className="hidden 2xl:inline">Get my estimate</span>
            </Link>
          </div>

          {/* Mobile Toggle */}
          <button
            aria-label={isMobileMenuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={isMobileMenuOpen}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="xl:hidden relative z-50 w-10 h-10 flex items-center justify-center text-brand-gold-dark"
          >
            <div className="relative w-6 h-5">
              <span
                className={cn(
                  'absolute top-0 left-0 w-full h-0.5 bg-brand-ink block rounded-full transition-transform duration-200',
                  isMobileMenuOpen && 'translate-y-2 rotate-45',
                )}
              />
              <span
                className={cn(
                  'absolute top-2.5 left-0 w-full h-0.5 bg-brand-ink block rounded-full transition-opacity duration-200',
                  isMobileMenuOpen && 'opacity-0',
                )}
              />
              <span
                className={cn(
                  'absolute bottom-0 left-0 w-full h-0.5 bg-brand-ink block rounded-full transition-transform duration-200',
                  isMobileMenuOpen && '-translate-y-2 -rotate-45',
                )}
              />
            </div>
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-40 bg-brand-burgundy/98 backdrop-blur-xl pt-40 px-8 pb-32 overflow-y-auto flex flex-col items-center text-center xl:hidden">
            <nav className="w-full max-w-sm flex flex-col gap-14">
              <div className="flex flex-col gap-6">
                {navLinks.map((link, idx) => (
                  <div key={link.href}>
                    <Link 
                      to={link.href} 
                      className={cn(
                        "font-display text-5xl font-light tracking-tight transition-colors",
                        location.pathname === link.href ? "text-brand-gold" : "text-brand-porcelain"
                      )}
                    >
                      {link.label}
                    </Link>
                  </div>
                ))}
              </div>

              <div className="w-12 h-px bg-brand-dim/30 mx-auto" />

              <div className="flex flex-col gap-6">
                <span className="font-sans text-[10px] uppercase tracking-[0.3em] text-brand-gold font-medium">Resources</span>
                <div className="grid grid-cols-1 gap-4">
                  <Link to="/library" className="font-sans text-sm text-brand-porcelain-soft hover:text-brand-gold transition-colors py-2 block">Construction Library</Link>
                  <Link to="/buyers-guide" className="font-sans text-sm text-brand-porcelain-soft hover:text-brand-gold transition-colors py-2 block">Buyer's Guide</Link>
                  <Link to="/cost-estimator" className="font-sans text-sm text-brand-porcelain-soft hover:text-brand-gold transition-colors py-2 block">Cost Estimator</Link>
                  <Link to="/resources" className="font-sans text-sm text-brand-gold hover:text-brand-gold-light transition-colors py-2 block">All Articles →</Link>
                </div>
              </div>

              <div className="w-12 h-px bg-brand-dim/30 mx-auto" />

              <div className="flex flex-col gap-6">
                <span className="font-sans text-[10px] uppercase tracking-[0.3em] text-brand-gold font-medium">Flagship Services</span>
                <div className="grid grid-cols-1 gap-4">
                  {SERVICE_LINKS.map((service, idx) => (
                    <div key={service.href}>
                      <Link 
                        to={service.href} 
                        className="font-sans text-sm text-brand-porcelain-soft hover:text-brand-gold transition-colors py-2 block"
                      >
                        {service.label}
                      </Link>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-center gap-10 pt-10 border-t border-brand-dim/10">
                {SOCIAL_LINKS.map((social, idx) => (
                  <a key={social.name} href={social.url} target="_blank" rel="noopener noreferrer" aria-label={`Golden Maple on ${social.name}`} onClick={() => trackEngagement('outbound_click', `nav_${social.name.toLowerCase()}`)} className="w-12 h-12 rounded-full border border-brand-dim/30 flex items-center justify-center text-brand-gold hover:border-brand-gold hover:bg-brand-gold/5 transition-all">
                    <social.Icon size={18} strokeWidth={1.5} aria-hidden="true" />
                  </a>
                ))}
              </div>
            </nav>
          </div>
        )}
      
    </>
  );
};

const Footer = () => {
  // The estimator page runs its own contextual sticky bar — the global dock
  // would cover it (z-50 vs z-40) and steal its taps.
  const { pathname } = useLocation();
  const hideDock = pathname.startsWith('/cost-estimator');
  return (
    <footer className="bg-brand-surface text-brand-bonewhite pt-32 pb-24 md:pb-12">
      <div className="container-custom">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8 xl:gap-16 mb-32">
          <div className="space-y-10">
            <Link to="/" className="flex flex-col">
              <span className="font-display text-4xl md:text-5xl leading-none tracking-tight text-brand-gold-dark">
                GOLDEN MAPLE
              </span>
              <span className="font-sans text-[12px] uppercase tracking-[0.4em] font-light text-brand-muted mt-2">
                Landscaping
              </span>
            </Link>
            <p className="font-sans font-light text-sm text-brand-muted leading-relaxed max-w-xs">
              Architectural outdoor construction serving Barrie, Simcoe County, and Cottage Country. Crafted for Canadian seasons. Designed to last a lifetime.
            </p>
            <div className="flex flex-col gap-4">
              {publicClaimCopy(BUSINESS.credentials.workmanshipWarranty, '') && (
                <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-brand-gold-dark font-normal">
                  <Shield size={14} strokeWidth={1.5} /> {publicClaimCopy(BUSINESS.credentials.workmanshipWarranty, '')}
                </div>
              )}
              {publicClaimCopy(BUSINESS.credentials.liabilityInsurance, '') && (
                <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-brand-gold-dark font-normal">
                  <Award size={14} strokeWidth={1.5} /> {publicClaimCopy(BUSINESS.credentials.liabilityInsurance, '')}
                </div>
              )}
              <Link to="/reviews" className="font-sans text-[11px] uppercase tracking-[0.18em] text-brand-gold-dark hover:text-brand-bonewhite">Read our Google reviews</Link>
            </div>
          </div>
          
          <div>
            <p className="font-sans text-[11px] uppercase tracking-[0.25em] text-brand-gold-dark mb-10">Navigation</p>
            <ul className="space-y-5 font-sans text-sm text-brand-muted font-light">
              <li><Link to="/services" className="hover:text-brand-gold-dark transition-colors">Services</Link></li>
              <li><Link to="/portfolio" className="hover:text-brand-gold-dark transition-colors">Portfolio</Link></li>
              <li><Link to="/about" className="hover:text-brand-gold-dark transition-colors">Our Story</Link></li>
              <li><Link to="/library" className="hover:text-brand-gold-dark transition-colors">Construction Library</Link></li>
              <li><Link to="/contact" className="hover:text-brand-gold-dark transition-colors">Contact</Link></li>
              <li><Link to="/reviews" className="hover:text-brand-gold-dark transition-colors">Google reviews</Link></li>
              <li><Link to="/service-areas" className="hover:text-brand-gold-dark transition-colors">Service Areas</Link></li>
            </ul>
          </div>

          <div>
            <p className="font-sans text-[11px] uppercase tracking-[0.25em] text-brand-gold-dark mb-10">Expertise</p>
            <ul className="space-y-5 font-sans text-[13px] text-brand-muted font-light">
              {SERVICE_LINKS.map((service) => (
                <li key={service.href}><Link to={service.href} className="hover:text-brand-gold-dark transition-colors">{service.label}</Link></li>
              ))}
            </ul>
          </div>

          <div className="min-w-0">
            <p className="font-sans text-[11px] uppercase tracking-[0.25em] text-brand-gold-dark mb-10">Connect</p>
            <ul className="space-y-6 font-sans text-[13px] text-brand-muted font-light">
              <li className="flex items-start gap-4">
                <MapPin size={18} strokeWidth={1.5} className="text-brand-gold-dark shrink-0" />
                <span>Barrie, Simcoe County & Cottage Country</span>
              </li>
              <li className="flex items-center gap-4">
                <Phone size={18} strokeWidth={1.5} className="text-brand-gold-dark shrink-0" />
                <a href={`tel:${publicContact.phoneTel}`} onClick={() => trackCall('footer_phone')} className="hover:text-brand-gold-dark transition-colors">{publicContact.phoneDisplay}</a>
              </li>
              <li className="flex items-center gap-4 min-w-0">
                <Mail size={18} strokeWidth={1.5} className="text-brand-gold-dark shrink-0" />
                <a href={`mailto:${publicContact.email}`} className="hover:text-brand-gold-dark transition-colors break-all min-w-0">{publicContact.email}</a>
              </li>
              <li className="flex items-center gap-3 pt-2">
                {SOCIAL_LINKS.map((social) => (
                  <a
                    key={social.name}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Golden Maple on ${social.name}`}
                    onClick={() => trackEngagement('outbound_click', `footer_${social.name.toLowerCase()}`)}
                    className="w-10 h-10 rounded-full border border-brand-dim flex items-center justify-center text-brand-gold-dark hover:border-brand-gold-dark hover:bg-brand-gold/5 transition-all"
                  >
                    <social.Icon size={16} strokeWidth={1.5} aria-hidden="true" />
                  </a>
                ))}
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-12 border-t border-brand-dim/40 flex flex-col md:flex-row justify-between items-center gap-8 text-[10px] uppercase tracking-[0.2em] text-brand-muted font-light">
          <p>© {new Date().getFullYear()} Golden Maple Landscaping. Architectural Precision.</p>
          <div className="flex gap-6 flex-wrap justify-end text-[9px] opacity-80">
            <Link to="/locations/barrie" className="hover:text-brand-gold-dark transition-colors">Barrie</Link>
            <Link to="/locations/innisfil" className="hover:text-brand-gold-dark transition-colors">Innisfil</Link>
            <Link to="/locations/oro-medonte" className="hover:text-brand-gold-dark transition-colors">Oro-Medonte</Link>
            <Link to="/locations/springwater" className="hover:text-brand-gold-dark transition-colors">Springwater</Link>
            <Link to="/patios-barrie" className="hover:text-brand-gold-dark transition-colors ml-2 border-l border-brand-dim/20 pl-4">Patios</Link>
            <Link to="/outdoor-living-barrie" className="hover:text-brand-gold-dark transition-colors">Outdoor Living</Link>
            <Link to="/premium-patio-rebuild-barrie" className="hover:text-brand-gold-dark transition-colors">Patio Rebuilds</Link>
            <Link to="/sloped-backyard-solutions-barrie" className="hover:text-brand-gold-dark transition-colors">Sloped Backyards</Link>
            <Link to="/full-backyard-transformations-barrie" className="hover:text-brand-gold-dark transition-colors">Full Transformations</Link>
            <Link to="/luxury-landscape-barrie" className="hover:text-brand-gold-dark transition-colors">Luxury Landscapes</Link>
            <Link to="/privacy" className="hover:text-brand-gold-dark transition-colors ml-2 border-l border-brand-dim/20 pl-4">Privacy</Link>
            <Link to="/terms" className="hover:text-brand-gold-dark transition-colors">Terms</Link>
          </div>
        </div>
      </div>

      {/* Mobile Split Action Dock */}
      {!hideDock && (
      <div className="xl:hidden fixed bottom-0 left-0 right-0 z-50 flex border-t border-brand-dim/20">
        <a 
          href={`tel:${publicContact.phoneTel}`} onClick={() => trackCall('sticky_call')}
          className="flex-1 bg-brand-surface text-brand-gold-dark font-sans text-[10px] uppercase tracking-[0.25em] py-5 flex items-center justify-center gap-3 border-r border-brand-dim/20"
        >
          <Phone size={16} strokeWidth={1.5} /> Call
        </a>
        <Link
          to="/contact"
          className="flex-[1.5] bg-brand-gold text-brand-black font-sans text-[10px] uppercase tracking-[0.25em] py-5 flex items-center justify-center gap-3"
        >
          Get my estimate
        </Link>
      </div>
      )}
    </footer>
  );
};

export default function Layout({ children }: { children: React.ReactNode }) {
  // Chat is absent from the prerender and stays out of the first paint.
  // It loads on the first input, or when the browser has been idle.
  const [chatReady, setChatReady] = useState(false);
  useEffect(() => onInteractOrIdle(() => setChatReady(true), 8000), []);

  return (
    <div className="bg-brand-nearblack min-h-screen selection:bg-brand-gold/20 selection:text-brand-gold-dark">
      <Navbar />
      <main className="flex-grow overflow-x-clip">{children}</main>
      <Footer />
      {chatReady && (
        <Suspense fallback={null}>
          <ChatWidget />
        </Suspense>
      )}
    </div>
  );
}
