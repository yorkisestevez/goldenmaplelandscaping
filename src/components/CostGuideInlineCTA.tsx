import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, FileText } from 'lucide-react';

export default function CostGuideInlineCTA() {
  return (
    <motion.aside
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7 }}
      className="my-20 bg-brand-surface border-l-2 border-brand-gold rounded-[2px] p-10 md:p-12 not-prose"
    >
      <div className="flex flex-col md:flex-row items-start md:items-center gap-8 md:gap-12">
        <div className="shrink-0 bg-brand-gold/5 border border-brand-gold/20 w-16 h-16 flex items-center justify-center rounded-[2px]">
          <FileText size={28} className="text-brand-gold" strokeWidth={1.5} />
        </div>
        <div className="flex-1">
          <span className="font-sans text-[10px] uppercase tracking-[0.3em] text-brand-gold mb-3 block">
            Free Download · 2026 Edition
          </span>
          <h3 className="font-display text-2xl md:text-3xl font-light text-brand-bonewhite leading-tight mb-4">
            Get the full 12-page <span className="italic text-brand-gold">Simcoe County Cost Guide</span>
          </h3>
          <p className="font-sans text-sm md:text-base text-brand-muted leading-relaxed font-light mb-2">
            Real numbers from 42 completed jobs, the 5 hidden upcharges, and 4 questions to ask cheap contractors before you sign.
          </p>
        </div>
        <Link
          to="/cost-guide"
          className="btn-primary py-4 px-8 inline-flex items-center justify-center gap-3 group whitespace-nowrap shrink-0"
        >
          Get The Guide
          <ArrowRight size={14} strokeWidth={1.5} className="transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </motion.aside>
  );
}
