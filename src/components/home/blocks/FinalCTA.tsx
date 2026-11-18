import { Link } from 'react-router-dom';
import Reveal from '../../Reveal';
import ResponsiveImage from '../../ResponsiveImage';
import { getProject, projectCoverFull } from '../../../data/projects';

const FinalCTA = () => {
  return (
    <section className="section-padding bg-brand-burgundy relative overflow-hidden">
      <div className="absolute inset-0 opacity-40">
          <ResponsiveImage image={projectCoverFull(getProject('barrie-diamond-inlay-patio')!)} sizes="100vw" aspect="fill" whenVisible className="w-full h-full object-cover" />
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

export default FinalCTA;
