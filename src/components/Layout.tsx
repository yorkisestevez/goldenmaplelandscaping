import { Link, useLocation } from 'react-router-dom';
import React, { useRef, useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Menu, X, Phone, MapPin, Mail, Shield, CheckCircle, Award, ChevronDown } from 'lucide-react';
import { trackEngagement } from '../utils/analytics';
import ChatWidget from './ChatWidget';
import { cn } from '../utils/cn';


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

  const services = [
    { href: "/services/interlocking-barrie", label: "Interlocking Stone" },
    { href: "/services/composite-decking-barrie", label: "Composite Decking" },
    { href: "/services/retaining-walls-barrie", label: "Retaining Walls" },
    { href: "/services/landscape-design-barrie", label: "Landscape Design" },
  ];

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
          isScrolled || isMobileMenuOpen
            ? 'bg-brand-nearblack/95 backdrop-blur-md border-b border-brand-dim/20 py-3'
            : 'bg-brand-nearblack/70 backdrop-blur-md border-b border-brand-dim/10 py-6'
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
              src="/logo-mark.png"
              alt="Golden Maple Landscaping"
              className="h-9 md:h-11 w-auto"
            />
            <span className="flex flex-col">
              <span className="font-display text-xl md:text-3xl leading-none tracking-tight text-brand-bonewhite group-hover:text-brand-gold transition-colors duration-500">
                GOLDEN MAPLE
              </span>
              <span className="font-sans text-[10px] md:text-[12px] uppercase tracking-[0.45em] font-light text-brand-gold mt-1.5">
                Landscaping
              </span>
            </span>
          </Link>

          {/* Desktop Nav - centered */}
          <nav className="hidden xl:flex items-center gap-7 mx-auto">
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
                      "font-sans text-[10px] uppercase tracking-[0.2em] transition-colors hover:text-brand-gold font-medium whitespace-nowrap flex items-center gap-1",
                      location.pathname.startsWith('/services') ? "text-brand-gold" : "text-brand-bonewhite"
                    )}
                  >
                    {link.label}
                    <ChevronDown size={10} strokeWidth={2} className={cn("transition-transform", servicesOpen && "rotate-180")} />
                  </Link>
                  <AnimatePresence>
                    {servicesOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-full left-1/2 -translate-x-1/2 pt-4 w-[640px]"
                      >
                        <div className="bg-brand-surface border border-brand-dim/40 rounded-[2px] shadow-2xl p-8 grid grid-cols-2 gap-x-8 gap-y-2">
                          <div>
                            <span className="font-sans text-[11px] uppercase tracking-[0.2em] text-brand-gold font-medium mb-4 block">
                              Flagship Services
                            </span>
                            <div className="space-y-1">
                              {flagshipServices.map((s) => (
                                <Link
                                  key={s.href}
                                  to={s.href}
                                  className="group block px-3 py-2.5 hover:bg-brand-nearblack/50 rounded-[2px] transition-all"
                                >
                                  <div className="font-sans text-[13px] text-brand-bonewhite group-hover:text-brand-gold font-medium transition-colors">
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
                            <span className="font-sans text-[11px] uppercase tracking-[0.2em] text-brand-gold font-medium mb-4 block">
                              Service Areas
                            </span>
                            <div className="grid grid-cols-2 gap-1">
                              {serviceLocationPills.map((l) => (
                                <Link
                                  key={l.slug}
                                  to={`/services/interlocking-${l.slug}`}
                                  className="font-sans text-[12px] text-brand-bonewhite/85 hover:text-brand-gold hover:bg-brand-nearblack/50 px-3 py-2 rounded-[2px] transition-all"
                                >
                                  {l.label}
                                </Link>
                              ))}
                            </div>
                            <div className="border-t border-brand-dim/30 mt-4 pt-3">
                              <Link
                                to="/services"
                                className="font-sans text-[10px] uppercase tracking-[0.2em] text-brand-gold hover:text-brand-gold-light font-medium"
                              >
                                View All Services →
                              </Link>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
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
                      "font-sans text-[10px] uppercase tracking-[0.2em] transition-colors hover:text-brand-gold font-medium whitespace-nowrap flex items-center gap-1",
                      location.pathname.startsWith('/resources') || location.pathname === '/buyers-guide' || location.pathname === '/cost-estimator' ? "text-brand-gold" : "text-brand-bonewhite"
                    )}
                  >
                    {link.label}
                    <ChevronDown size={10} strokeWidth={2} className={cn("transition-transform", resourcesOpen && "rotate-180")} />
                  </Link>
                  <AnimatePresence>
                    {resourcesOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-full left-1/2 -translate-x-1/2 pt-4 w-64"
                      >
                        <div className="bg-brand-surface border border-brand-dim/40 rounded-[2px] shadow-2xl py-2 overflow-hidden">
                          {resourceLinks.map((item) => (
                            <Link
                              key={item.href}
                              to={item.href}
                              className="block px-5 py-2.5 font-sans text-[11px] uppercase tracking-[0.15em] text-brand-bonewhite/85 hover:text-brand-gold hover:bg-brand-nearblack/50 font-medium transition-all"
                            >
                              {item.label}
                            </Link>
                          ))}
                          <div className="border-t border-brand-dim/30 mt-1.5 pt-1.5">
                            <Link
                              to="/resources"
                              className="block px-5 py-2.5 font-sans text-[11px] uppercase tracking-[0.15em] text-brand-gold hover:bg-brand-nearblack/50 font-medium transition-all"
                            >
                              View All Articles →
                            </Link>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <Link 
                  key={link.href} 
                  to={link.href} 
                  className={cn(
                    "font-sans text-[10px] uppercase tracking-[0.2em] transition-colors hover:text-brand-gold font-medium whitespace-nowrap",
                    location.pathname === link.href ? "text-brand-gold" : "text-brand-bonewhite"
                  )}
                >
                  {link.label}
                </Link>
              )
            ))}
          </nav>

          {/* Right Side CTA group */}
          <div className="hidden xl:flex items-center gap-5 shrink-0">
            <Link 
              to="/contact" 
              className={cn(
                "font-sans text-[10px] uppercase tracking-[0.2em] transition-colors hover:text-brand-gold font-medium",
                location.pathname === "/contact" ? "text-brand-gold" : "text-brand-bonewhite"
              )}
            >
              Contact
            </Link>
            
            <a href="tel:7055003581" onClick={() => trackEngagement('cta_click', 'phone_call')} className="w-10 h-10 flex items-center justify-center rounded-full border border-brand-gold text-brand-gold bg-brand-gold/5 hover:bg-brand-gold hover:text-brand-nearblack hover:shadow-[0_0_16px_rgba(212,175,99,0.25)] transition-all group" aria-label="Call Us">
              <Phone size={16} strokeWidth={2} className="group-hover:scale-110 transition-transform" />
            </a>

            <Link to="/contact" onClick={() => trackEngagement('cta_click', 'get_estimate_nav')} className="btn-primary py-2.5 px-6 whitespace-nowrap">
              Get My Estimate
            </Link>
          </div>

          {/* Mobile Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="xl:hidden relative z-50 w-10 h-10 flex items-center justify-center text-brand-gold"
          >
            <div className="relative w-6 h-5">
              <motion.span 
                animate={isMobileMenuOpen ? { rotate: 45, y: 8 } : { rotate: 0, y: 0 }}
                className="absolute top-0 left-0 w-full h-0.5 bg-brand-gold block rounded-full"
              />
              <motion.span 
                animate={isMobileMenuOpen ? { opacity: 0 } : { opacity: 1 }}
                className="absolute top-2.5 left-0 w-full h-0.5 bg-brand-gold block rounded-full"
              />
              <motion.span 
                animate={isMobileMenuOpen ? { rotate: -45, y: -8 } : { rotate: 0, y: 0 }}
                className="absolute bottom-0 left-0 w-full h-0.5 bg-brand-gold block rounded-full"
              />
            </div>
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 bg-brand-nearblack/98 backdrop-blur-xl pt-40 px-8 pb-32 overflow-y-auto flex flex-col items-center text-center xl:hidden"
          >
            <nav className="w-full max-w-sm flex flex-col gap-14">
              <div className="flex flex-col gap-6">
                {navLinks.map((link, idx) => (
                  <motion.div
                    key={link.href}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + idx * 0.05 }}
                  >
                    <Link 
                      to={link.href} 
                      className={cn(
                        "font-display text-5xl font-light tracking-tight transition-colors",
                        location.pathname === link.href ? "text-brand-gold" : "text-brand-bonewhite"
                      )}
                    >
                      {link.label}
                    </Link>
                  </motion.div>
                ))}
              </div>

              <div className="w-12 h-px bg-brand-dim/30 mx-auto" />

              <div className="flex flex-col gap-6">
                <span className="font-sans text-[10px] uppercase tracking-[0.3em] text-brand-gold font-medium">Resources</span>
                <div className="grid grid-cols-1 gap-4">
                  <Link to="/buyers-guide" className="font-sans text-sm text-brand-muted hover:text-brand-gold transition-colors py-2 block">Buyer's Guide</Link>
                  <Link to="/cost-estimator" className="font-sans text-sm text-brand-muted hover:text-brand-gold transition-colors py-2 block">Cost Estimator</Link>
                  <Link to="/resources" className="font-sans text-sm text-brand-gold hover:text-brand-gold-light transition-colors py-2 block">All Articles →</Link>
                </div>
              </div>

              <div className="w-12 h-px bg-brand-dim/30 mx-auto" />

              <div className="flex flex-col gap-6">
                <span className="font-sans text-[10px] uppercase tracking-[0.3em] text-brand-gold font-medium">Flagship Services</span>
                <div className="grid grid-cols-1 gap-4">
                  {services.map((service, idx) => (
                    <motion.div
                      key={service.href}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + idx * 0.05 }}
                    >
                      <Link 
                        to={service.href} 
                        className="font-sans text-sm text-brand-muted hover:text-brand-gold transition-colors py-2 block"
                      >
                        {service.label}
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="flex justify-center gap-10 pt-10 border-t border-brand-dim/10">
                {[
                  { name: 'Facebook', icon: 'FB', url: 'https://facebook.com/goldenmaple' },
                  { name: 'Instagram', icon: 'IG', url: 'https://instagram.com/goldenmaple' },
                  { name: 'Google', icon: 'G', url: 'https://google.com/search?q=golden+maple+landscaping' }
                ].map((social, idx) => (
                  <motion.a
                    key={social.name}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.7 + idx * 0.1 }}
                    className="w-12 h-12 rounded-full border border-brand-dim/30 flex items-center justify-center text-brand-gold hover:border-brand-gold hover:bg-brand-gold/5 transition-all"
                  >
                    <span className="font-sans text-xs font-bold">{social.icon}</span>
                  </motion.a>
                ))}
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-20 mb-32">
          <div className="space-y-10">
            <Link to="/" className="flex flex-col">
              <span className="font-display text-4xl md:text-5xl leading-none tracking-tight text-brand-gold">
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
              <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-brand-gold font-normal">
                <Shield size={14} strokeWidth={1.5} /> 5-Year Sink & Settlement Warranty
              </div>
              <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-brand-gold font-normal">
                <Award size={14} strokeWidth={1.5} /> $5M Liability Coverage
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="font-sans text-[11px] uppercase tracking-[0.25em] text-brand-gold mb-10">Navigation</h4>
            <ul className="space-y-5 font-sans text-sm text-brand-muted font-light">
              <li><Link to="/services" className="hover:text-brand-gold transition-colors">Services</Link></li>
              <li><Link to="/portfolio" className="hover:text-brand-gold transition-colors">Portfolio</Link></li>
              <li><Link to="/about" className="hover:text-brand-gold transition-colors">Our Story</Link></li>
              <li><Link to="/contact" className="hover:text-brand-gold transition-colors">Contact</Link></li>
              <li><Link to="/service-areas" className="hover:text-brand-gold transition-colors">Service Areas</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-sans text-[11px] uppercase tracking-[0.25em] text-brand-gold mb-10">Expertise</h4>
            <ul className="space-y-5 font-sans text-[13px] text-brand-muted font-light">
              <li>Interlocking & Hardscape</li>
              <li>Composite Decking</li>
              <li>Natural Stone & Flagstone</li>
              <li>Porcelain Installation</li>
              <li>Retaining Walls</li>
            </ul>
          </div>

          <div>
            <h4 className="font-sans text-[11px] uppercase tracking-[0.25em] text-brand-gold mb-10">Connect</h4>
            <ul className="space-y-6 font-sans text-[13px] text-brand-muted font-light">
              <li className="flex items-start gap-4">
                <MapPin size={18} strokeWidth={1.5} className="text-brand-gold shrink-0" />
                <span>Barrie, Simcoe County & Cottage Country</span>
              </li>
              <li className="flex items-center gap-4">
                <Phone size={18} strokeWidth={1.5} className="text-brand-gold shrink-0" />
                <a href="tel:7055003581" className="hover:text-brand-gold transition-colors">705.500.3581</a>
              </li>
              <li className="flex items-center gap-4">
                <Mail size={18} strokeWidth={1.5} className="text-brand-gold shrink-0" />
                <a href="mailto:yorkis@goldenmaplelandscaping.ca" className="hover:text-brand-gold transition-colors">yorkis@goldenmaplelandscaping.ca</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-12 border-t border-brand-dim/40 flex flex-col md:flex-row justify-between items-center gap-8 text-[10px] uppercase tracking-[0.2em] text-brand-muted font-light">
          <p>© {new Date().getFullYear()} Golden Maple Landscaping. Architectural Precision.</p>
          <div className="flex gap-6 flex-wrap justify-end text-[9px] opacity-80">
            <Link to="/locations/barrie" className="hover:text-brand-gold transition-colors">Barrie</Link>
            <Link to="/locations/innisfil" className="hover:text-brand-gold transition-colors">Innisfil</Link>
            <Link to="/locations/oro-medonte" className="hover:text-brand-gold transition-colors">Oro-Medonte</Link>
            <Link to="/locations/springwater" className="hover:text-brand-gold transition-colors">Springwater</Link>
            <Link to="/privacy" className="hover:text-brand-gold transition-colors ml-2 border-l border-brand-dim/20 pl-4">Privacy</Link>
            <Link to="/terms" className="hover:text-brand-gold transition-colors">Terms</Link>
          </div>
        </div>
      </div>

      {/* Mobile Split Action Dock */}
      {!hideDock && (
      <div className="xl:hidden fixed bottom-0 left-0 right-0 z-50 flex border-t border-brand-dim/20">
        <a 
          href="tel:7055003581" 
          className="flex-1 bg-brand-surface text-brand-gold font-sans text-[10px] uppercase tracking-[0.25em] py-5 flex items-center justify-center gap-3 border-r border-brand-dim/20"
        >
          <Phone size={16} strokeWidth={1.5} /> Call
        </a>
        <Link
          to="/contact"
          className="flex-[1.5] bg-brand-gold text-brand-nearblack font-sans text-[10px] uppercase tracking-[0.25em] py-5 flex items-center justify-center gap-3"
        >
          Get My Estimate
        </Link>
      </div>
      )}
    </footer>
  );
};

export default function Layout({ children }: { children: React.ReactNode }) {
  // Client-only interactive widgets — gated so they never render during the
  // build-time prerender (avoids any window/document access at SSR).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="bg-brand-nearblack min-h-screen selection:bg-brand-gold/20 selection:text-brand-gold">
      <Navbar />
      <main className="flex-grow overflow-x-hidden">{children}</main>
      <Footer />
      {mounted && <ChatWidget />}
    </div>
  );
}
