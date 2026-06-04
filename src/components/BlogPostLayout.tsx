import { type ReactNode, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, Facebook, Twitter, Linkedin, Link as LinkIcon, Share2, Check } from 'lucide-react';
import SEO from './SEO';

interface BlogPostLayoutProps {
  title: string;
  seoTitle: string;
  seoDescription: string;
  category: string;
  date: string;
  /** Optional ISO date — defaults to `date` if not provided. Tracks content updates separately. */
  dateModified?: string;
  readTime: string;
  heroImage: string;
  /** Optional structured data injected as a second JSON-LD block (e.g. FAQPage, HowTo). */
  schema?: object;
  /** Optional TL;DR string for the Article schema's `abstract` property. Featured-snippet target. */
  tldr?: string;
  /** Optional keyword string for the Article schema's `keywords` property. */
  keywords?: string;
  /** Optional word count for the Article schema's `wordCount` property. */
  wordCount?: number;
  children: ReactNode;
}

export default function BlogPostLayout({ title, seoTitle, seoDescription, category, date, dateModified, readTime, heroImage, schema, tldr, keywords, wordCount, children }: BlogPostLayoutProps) {
  const [copied, setCopied] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');
  const location = useLocation();

  useEffect(() => {
    setCurrentUrl(window.location.href);
  }, []);

  const encodedUrl = encodeURIComponent(currentUrl);
  const encodedTitle = encodeURIComponent(title);

  // Build canonical from the route — server-side and crawlers see this even before JS runs.
  const canonicalUrl = `https://goldenmaplelandscaping.ca${location.pathname}`;
  const ogImageUrl = heroImage.startsWith('http') ? heroImage : `https://goldenmaplelandscaping.ca${heroImage}`;

  // BreadcrumbList helps Google render the page hierarchy in search results.
  const breadcrumbSchema = {
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://goldenmaplelandscaping.ca/" },
      { "@type": "ListItem", "position": 2, "name": "Resources", "item": "https://goldenmaplelandscaping.ca/resources" },
      { "@type": "ListItem", "position": 3, "name": title, "item": canonicalUrl },
    ],
  };

  // Article schema for E-E-A-T signals — Google + AI assistants use this for citation/snippet.
  // Enhanced 2026-06-04 with abstract (from tldr), keywords, wordCount, dateModified.
  const articleSchema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": title,
    "description": seoDescription,
    "image": ogImageUrl,
    "datePublished": date,
    "dateModified": dateModified || date,
    "author": {
      "@type": "Person",
      "name": "Yorkis Estevez",
      "jobTitle": "Founder, Golden Maple Landscaping",
      "url": "https://goldenmaplelandscaping.ca/about",
      "sameAs": ["https://goldenmaplelandscaping.ca/about"],
    },
    "publisher": {
      "@type": "Organization",
      "name": "Golden Maple Landscaping",
      "url": "https://goldenmaplelandscaping.ca",
      "logo": {
        "@type": "ImageObject",
        "url": "https://goldenmaplelandscaping.ca/logo.svg",
      },
      "areaServed": ["Barrie", "Innisfil", "Oro-Medonte", "Springwater", "Orillia", "Wasaga Beach", "Midland", "Collingwood", "Simcoe County", "Ontario"],
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": canonicalUrl,
    },
    "articleSection": category,
    "inLanguage": "en-CA",
  };
  if (tldr) articleSchema.abstract = tldr;
  if (keywords) articleSchema.keywords = keywords;
  if (wordCount && wordCount > 0) articleSchema.wordCount = wordCount;

  // Combine Article + Breadcrumb + (optional) FAQPage/HowTo into a single @graph block
  // so a single SEO component emits everything in one JSON-LD payload.
  const graph: unknown[] = [articleSchema, breadcrumbSchema];
  if (schema) graph.push(schema);
  const combinedSchema = { "@context": "https://schema.org", "@graph": graph };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-brand-nearblack min-h-screen">
      <SEO
        title={seoTitle}
        description={seoDescription}
        canonical={canonicalUrl}
        image={ogImageUrl}
        schema={combinedSchema}
      />
      
      <section className="section-padding pt-40 md:pt-48">
        <div className="container-custom">
          <div className="max-w-4xl mx-auto">
            <Link to="/resources" className="inline-flex items-center gap-3 font-sans text-[11px] uppercase tracking-[0.25em] text-brand-gold hover:text-brand-bonewhite transition-colors mb-12 group">
              <ArrowLeft size={14} strokeWidth={2} className="group-hover:-translate-x-1 transition-transform" />
              Back to Resources
            </Link>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold mb-6 block">{category}</span>
              <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-light text-brand-bonewhite leading-[1.1] mb-10">{title}</h1>
              
              <div className="flex items-center gap-8 mb-16">
                <span className="flex items-center gap-2 font-sans text-[11px] uppercase tracking-[0.2em] text-brand-muted">
                  <Calendar size={14} strokeWidth={1.5} className="text-brand-gold" /> {date}
                </span>
                <span className="flex items-center gap-2 font-sans text-[11px] uppercase tracking-[0.2em] text-brand-muted">
                  <Clock size={14} strokeWidth={1.5} className="text-brand-gold" /> {readTime}
                </span>
              </div>
            </motion.div>

            <div className="aspect-[21/9] rounded-[2px] overflow-hidden mb-20 border border-brand-dim/10">
              <img src={heroImage} alt={title} loading="lazy" decoding="async" className="w-full h-full object-cover" />
            </div>

            <article className="prose-gold">
              {children}
            </article>

            {/* Social Share Section */}
            <div className="mt-16 pt-10 border-t border-brand-dim/10 flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-3 text-brand-bonewhite">
                <Share2 size={18} className="text-brand-gold" />
                <span className="font-display text-lg font-light">Share this article</span>
              </div>
              <div className="flex items-center gap-4">
                <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`} target="_blank" rel="noopener noreferrer" aria-label="Share on Facebook" className="w-10 h-10 rounded-full border border-brand-dim/30 flex items-center justify-center text-brand-muted hover:text-brand-gold hover:border-brand-gold hover:bg-brand-gold/5 transition-all">
                  <Facebook size={16} />
                </a>
                <a href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`} target="_blank" rel="noopener noreferrer" aria-label="Share on X (Twitter)" className="w-10 h-10 rounded-full border border-brand-dim/30 flex items-center justify-center text-brand-muted hover:text-brand-gold hover:border-brand-gold hover:bg-brand-gold/5 transition-all">
                  <Twitter size={16} />
                </a>
                <a href={`https://www.linkedin.com/shareArticle?mini=true&url=${encodedUrl}&title=${encodedTitle}`} target="_blank" rel="noopener noreferrer" aria-label="Share on LinkedIn" className="w-10 h-10 rounded-full border border-brand-dim/30 flex items-center justify-center text-brand-muted hover:text-brand-gold hover:border-brand-gold hover:bg-brand-gold/5 transition-all">
                  <Linkedin size={16} />
                </a>
                <button onClick={handleCopyLink} className="w-10 h-10 rounded-full border border-brand-dim/30 flex items-center justify-center text-brand-muted hover:text-brand-gold hover:border-brand-gold hover:bg-brand-gold/5 transition-all" title="Copy Link" aria-label="Copy link">
                  {copied ? <Check size={16} className="text-green-500" /> : <LinkIcon size={16} />}
                </button>
              </div>
            </div>

            <div className="mt-20 pt-16 border-t border-brand-dim/10">
              <div className="bg-brand-surface p-12 rounded-[2px] border border-brand-dim/10 text-center">
                <h3 className="font-display text-3xl font-light text-brand-bonewhite mb-6">Ready to start your project?</h3>
                <p className="font-sans text-brand-muted mb-10 font-light max-w-xl mx-auto">Every great backyard starts with a single conversation. Tell us what you're dreaming about — we'll tell you exactly what it takes.</p>
                <Link to="/contact" className="btn-primary px-16 py-5">Let's Talk About Your Property</Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
