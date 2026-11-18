import { HOME_FAQS } from '../../../data/homeFaqs';

const HomeFaq = () => (
      <section className="section-padding bg-brand-nearblack border-t border-brand-dim/5">
      <div className="container-custom">
        <div className="max-w-3xl mx-auto mb-10 md:mb-20 text-center">
          <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-6 block">Common Questions</span>
          <h2 className="font-display text-4xl md:text-6xl font-light text-brand-bonewhite">Before you ask for a quote.</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 max-w-5xl mx-auto">
          {HOME_FAQS.map((faq) => (
            <div key={faq.q} className="bg-brand-surface p-7 md:p-10 border border-brand-dim/10 rounded-2xl">
              <h3 className="font-display text-2xl font-light text-brand-gold-dark mb-4 md:mb-6 leading-tight">{faq.q}</h3>
              <p className="font-sans text-base text-brand-muted leading-relaxed font-light">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
);

export default HomeFaq;
