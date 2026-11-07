import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import SEO from '../../components/SEO';

const inquiryHref = '/contact?service=Porcelain%20Patio%20%2F%20Pavers';

const decisionPoints = [
  {
    title: 'Compare the actual products',
    body: 'Review the selected porcelain paver’s format, finish, availability, care guidance, and manufacturer documentation alongside the alternatives for your project.',
  },
  {
    title: 'Match the choice to the space',
    body: 'Share where the surface will be used, how you expect to use it, and what look you want. Suitability and project details need to be confirmed for the specific site and product.',
  },
  {
    title: 'Get the scope in writing',
    body: 'Ask for the proposed materials, preparation, installation responsibilities, schedule assumptions, and applicable product and workmanship terms in the project documents.',
  },
];

const faqs = [
  {
    question: 'Is porcelain the same as a concrete patio paver?',
    answer: 'No. Porcelain paving and concrete patio pavers are different material categories. Compare the exact products, intended use, appearance, care guidance, availability, and written terms before choosing.',
  },
  {
    question: 'Can I see a completed Golden Maple porcelain patio?',
    answer: 'This page does not present a porcelain installation as a completed Golden Maple project. General patio photographs are not evidence that the surface shown is porcelain. Ask us directly about project-specific examples and available product samples before relying on a visual reference.',
  },
  {
    question: 'How much does a porcelain patio cost?',
    answer: 'Pricing depends on the selected product and project scope. We do not publish a porcelain-specific price on this page; request a written, project-specific estimate after discussing the site and material options.',
  },
  {
    question: 'What should I confirm before choosing a product?',
    answer: 'Ask about the specific product’s intended applications, manufacturer documentation, care requirements, current availability, and how the proposed installation and responsibilities will be described in writing.',
  },
];

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map(({ question, answer }) => ({
    '@type': 'Question',
    name: question,
    acceptedAnswer: { '@type': 'Answer', text: answer },
  })),
};

export default function PorcelainPatiosBarrie() {
  return (
    <main className="bg-brand-nearblack min-h-screen text-brand-bonewhite">
      <SEO
        title="Porcelain Patios in Barrie | Golden Maple Landscaping"
        description="Planning a porcelain patio in Barrie or Simcoe County? Compare product options, site fit, project scope, and written terms before choosing. Start a porcelain project inquiry."
        canonical="https://goldenmaplelandscaping.ca/services/porcelain-patios-barrie"
        schema={faqSchema}
      />

      <section className="section-padding pt-40 md:pt-48 pb-24">
        <div className="container-custom max-w-5xl">
          <p className="font-sans text-xs uppercase tracking-[0.25em] text-brand-gold-dark mb-6">Porcelain patio planning · Barrie &amp; Simcoe County</p>
          <h1 className="font-display text-4xl md:text-7xl font-light leading-tight mb-8">
            Considering a <span className="italic text-brand-gold-dark">porcelain patio?</span>
          </h1>
          <p className="font-sans text-lg md:text-xl text-brand-muted leading-relaxed font-light max-w-3xl mb-10">
            Compare the specific product, the needs of your space, and the written project scope before you decide. Tell us what you are planning and we can discuss whether the current options fit your project.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link to={inquiryHref} className="btn-primary min-h-12 px-7 inline-flex items-center justify-center gap-3">
              Ask about a porcelain project <ArrowRight size={16} />
            </Link>
            <Link to="/services/interlocking-barrie" className="min-h-12 px-5 inline-flex items-center justify-center text-sm text-brand-muted hover:text-brand-gold-dark transition-colors">
              Compare interlocking patios
            </Link>
          </div>
          <p className="mt-10 border-l border-brand-gold/50 pl-5 text-sm md:text-base leading-relaxed text-brand-muted max-w-3xl">
            Portfolio clarity: general patio photographs on this website are not identified as porcelain installations. No porcelain project photo or completed porcelain case study is presented here as proof of our work.
          </p>
        </div>
      </section>

      <section className="border-y border-brand-dim/20 bg-brand-surface/30 section-padding">
        <div className="container-custom max-w-5xl">
          <p className="font-sans text-xs uppercase tracking-[0.25em] text-brand-gold-dark mb-5">A useful comparison starts with your project</p>
          <h2 className="font-display text-3xl md:text-5xl font-light leading-tight mb-12">Three things to clarify before requesting a quote</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {decisionPoints.map((point) => (
              <article key={point.title} className="border-t border-brand-gold/30 pt-6">
                <Check size={18} className="text-brand-gold-dark mb-5" aria-hidden="true" />
                <h3 className="font-display text-2xl font-light mb-4">{point.title}</h3>
                <p className="font-sans text-base text-brand-muted leading-relaxed font-light">{point.body}</p>
              </article>
            ))}
          </div>
          <div className="mt-14 flex flex-col sm:flex-row gap-6 border-t border-brand-dim/20 pt-8">
            <Link to="/resources/pool-deck-materials-ontario" className="text-brand-gold-dark hover:underline underline-offset-4">Read the pool-deck material comparison <ArrowRight size={14} className="inline ml-1" /></Link>
            <Link to="/resources/natural-stone-vs-pavers-barrie" className="text-brand-gold-dark hover:underline underline-offset-4">Compare natural stone and pavers <ArrowRight size={14} className="inline ml-1" /></Link>
          </div>
        </div>
      </section>

      <section className="section-padding">
        <div className="container-custom max-w-4xl">
          <p className="font-sans text-xs uppercase tracking-[0.25em] text-brand-gold-dark mb-5">Common questions</p>
          <h2 className="font-display text-3xl md:text-5xl font-light mb-10">Before you choose porcelain paving</h2>
          <div className="space-y-4">
            {faqs.map(({ question, answer }) => (
              <details key={question} className="group border border-brand-dim/30 p-5 md:p-7">
                <summary className="cursor-pointer list-none font-display text-xl md:text-2xl font-light flex justify-between gap-5">
                  {question}<span className="text-brand-gold-dark" aria-hidden="true">+</span>
                </summary>
                <p className="font-sans text-base text-brand-muted leading-relaxed mt-5">{answer}</p>
              </details>
            ))}
          </div>
          <div className="mt-12">
            <Link to={inquiryHref} className="btn-primary min-h-12 px-7 inline-flex items-center justify-center gap-3">
              Start a porcelain project inquiry <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
