import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import ResponsiveImage from '../../ResponsiveImage';
import { LANDSCAPE_MAINTENANCE } from '../../../data/business';
import { getProject, projectCover } from '../../../data/projects';

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
              <div className="overflow-hidden rounded-2xl mb-6"><ResponsiveImage image={service.image} sizes="(min-width: 768px) 33vw, 100vw" aspect="fill" whenVisible className="home-service-photo transition-transform duration-500 motion-safe:group-hover:scale-[1.03]" /></div>
              <div className="flex items-center justify-between gap-4 mb-3"><h3 className="font-display text-3xl">{service.title}</h3><ArrowRight size={18} className="text-brand-gold-dark shrink-0" aria-hidden="true" /></div>
              <p className="text-sm leading-relaxed text-brand-muted max-w-sm">{service.desc}</p>
            </Link>
          ))}
        </div>
        <Link
          to={LANDSCAPE_MAINTENANCE.path}
          className="group mt-10 flex flex-wrap items-center justify-between gap-6 rounded-2xl border border-brand-dim bg-brand-surface px-6 py-7 transition-colors hover:border-brand-gold-dark md:px-9"
        >
          <div>
            <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.22em] text-brand-gold-dark">New for 2027</p>
            <h3 className="mb-2 font-display text-3xl text-brand-ink">Landscape maintenance</h3>
            <p className="text-sm leading-relaxed text-brand-muted">Regular mowing and lawn care for homes and commercial properties.</p>
          </div>
          <span className="home-project-link">Explore maintenance <ArrowRight size={15} aria-hidden="true" /></span>
        </Link>
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

export default ServicesGrid;
