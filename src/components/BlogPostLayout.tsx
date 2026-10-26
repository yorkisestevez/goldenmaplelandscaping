import { type ReactNode, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, Facebook, Twitter, Linkedin, Link as LinkIcon, Share2, Check } from 'lucide-react';
import SEO from './SEO';
import { breadcrumb, businessRef, canonicalUrl as toCanonical, founderRef, graph, isoDate } from '../utils/schema';
import { AUTHORED_BY_FOUNDER, reviewFor } from '../data/editorialReviews';
import { sectionFor } from '../data/library';
import { FOUNDER } from '../data/founder';

import { isOwnedPhoto } from '../data/portfolioImages';
import { BUSINESS, canPublish } from '../data/business';

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
  const origin = BUSINESS.canonicalUrl;
  const canonicalUrl = toCanonical(location.pathname);
  // Authorship and review come ONLY from src/data/editorialReviews.ts — most posts
  // are robot drafts, so neither is assumed.
  const slug = location.pathname.replace(/^\/resources\/|\/$/g, '');
  const founderPublishable = canPublish(BUSINESS.founder);
  const review = founderPublishable ? reviewFor(slug) : undefined;
  const writtenByFounder = founderPublishable && AUTHORED_BY_FOUNDER.has(slug);
  const librarySection = sectionFor(slug);
  // photoRights is confirmed ONLY for register-backed photos (owner-attested portfolio +
  // Instagram bake). Legacy blog heroes under /images/projects stay on the logo.
  const photoApproved = canPublish(BUSINESS.reviews.photoRights) && isOwnedPhoto(heroImage);
  const ogImageUrl = photoApproved ? (heroImage.startsWith('http') ? heroImage : `${origin}${heroImage}`) : `${origin}/images/og/default-1200x630.jpg`;

  // Article + BreadcrumbList (+ the post's own FAQPage/HowTo) in one @graph.
  // author/publisher reference root.tsx's #business rather than re-declaring an
  // Organization. Dates go through isoDate(): posts pass "March 15, 2026", which
  // is not valid schema.org Date and was being emitted verbatim until 2026-09.
  const published = isoDate(date);
  const articleSchema: Record<string, unknown> = {
    "@type": "Article",
    "@id": `${canonicalUrl}#article`,
    "headline": title,
    "description": seoDescription,
    "image": ogImageUrl,
    "datePublished": published,
    "dateModified": dateModified ? isoDate(dateModified) : published,
    "author": writtenByFounder ? founderRef : businessRef,
    "publisher": businessRef,
    "mainEntityOfPage": review
      ? { "@id": canonicalUrl }
      : { "@type": "WebPage", "@id": canonicalUrl },
    "articleSection": category,
    "inLanguage": "en-CA",
  };
  if (tldr) articleSchema.abstract = tldr;
  if (keywords) articleSchema.keywords = keywords;
  if (wordCount && wordCount > 0) articleSchema.wordCount = wordCount;

  // reviewedBy / lastReviewed are WebPage properties, not Article ones.
  const reviewedPage = review
    ? { "@type": "WebPage", "@id": canonicalUrl, url: canonicalUrl, reviewedBy: founderRef, lastReviewed: review.reviewedOn }
    : null;

  const combinedSchema = graph(
    articleSchema,
    reviewedPage,
    breadcrumb(librarySection
      ? [
          { name: 'Home', path: '/' },
          { name: 'Library', path: '/library/' },
          { name: librarySection.title, path: `/library/${librarySection.slug}/` },
          { name: title, path: location.pathname },
        ]
      : [
          { name: 'Home', path: '/' },
          { name: 'Resources', path: '/resources/' },
          { name: title, path: location.pathname },
        ]),
    schema as Record<string, unknown> | undefined,
  );

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
            <Link to="/resources" className="inline-flex items-center gap-3 font-sans text-[11px] uppercase tracking-[0.25em] text-brand-gold-dark hover:text-brand-bonewhite transition-colors mb-12 group">
              <ArrowLeft size={14} strokeWidth={2} className="group-hover:-translate-x-1 transition-transform" />
              Back to Resources
            </Link>

            <div>
              <span className="font-sans text-[11px] uppercase tracking-[0.3em] text-brand-gold-dark mb-6 block">
                {category}
                {librarySection && (
                  <>
                    <span aria-hidden="true"> · </span>
                    <Link to={`/library/${librarySection.slug}`} className="hover:text-brand-bonewhite transition-colors">
                      Part of the Library: {librarySection.title}
                    </Link>
                  </>
                )}
              </span>
              <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-light text-brand-bonewhite leading-[1.1] mb-10">{title}</h1>
              
              <div className="flex items-center gap-8 mb-16">
                <span className="flex items-center gap-2 font-sans text-[11px] uppercase tracking-[0.2em] text-brand-muted">
                  <Calendar size={14} strokeWidth={1.5} className="text-brand-gold-dark" /> {date}
                </span>
                <span className="flex items-center gap-2 font-sans text-[11px] uppercase tracking-[0.2em] text-brand-muted">
                  <Clock size={14} strokeWidth={1.5} className="text-brand-gold-dark" /> {readTime}
                </span>
              </div>
              {(writtenByFounder || review) && (
                <p className="-mt-10 mb-16 font-sans text-sm text-brand-muted">
                  {writtenByFounder ? 'Written' : 'Reviewed'} by{' '}
                  <Link to={FOUNDER.profilePath} className="text-brand-bonewhite underline decoration-brand-gold/50 underline-offset-4 hover:text-brand-gold-dark">
                    {FOUNDER.name}
                  </Link>
                  , {FOUNDER.role}
                  {review && <> · reviewed {review.reviewedOn}</>}
                </p>
              )}
            </div>

            {photoApproved && <div className="aspect-[21/9] rounded-[2px] overflow-hidden mb-20 border border-brand-dim/10">
              <img src={heroImage} alt={title} loading="lazy" decoding="async" className="w-full h-full object-cover" />
            </div>}

            <article className="prose-gold">
              {children}
            </article>

            {/* Social Share Section */}
            <div className="mt-16 pt-10 border-t border-brand-dim/10 flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-3 text-brand-bonewhite">
                <Share2 size={18} className="text-brand-gold-dark" />
                <span className="font-display text-lg font-light">Share this article</span>
              </div>
              <div className="flex items-center gap-4">
                <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`} target="_blank" rel="noopener noreferrer" aria-label="Share on Facebook" className="w-10 h-10 rounded-full border border-brand-dim/30 flex items-center justify-center text-brand-muted hover:text-brand-gold-dark hover:border-brand-gold hover:bg-brand-gold/5 transition-all">
                  <Facebook size={16} />
                </a>
                <a href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`} target="_blank" rel="noopener noreferrer" aria-label="Share on X (Twitter)" className="w-10 h-10 rounded-full border border-brand-dim/30 flex items-center justify-center text-brand-muted hover:text-brand-gold-dark hover:border-brand-gold hover:bg-brand-gold/5 transition-all">
                  <Twitter size={16} />
                </a>
                <a href={`https://www.linkedin.com/shareArticle?mini=true&url=${encodedUrl}&title=${encodedTitle}`} target="_blank" rel="noopener noreferrer" aria-label="Share on LinkedIn" className="w-10 h-10 rounded-full border border-brand-dim/30 flex items-center justify-center text-brand-muted hover:text-brand-gold-dark hover:border-brand-gold hover:bg-brand-gold/5 transition-all">
                  <Linkedin size={16} />
                </a>
                <button onClick={handleCopyLink} className="w-10 h-10 rounded-full border border-brand-dim/30 flex items-center justify-center text-brand-muted hover:text-brand-gold-dark hover:border-brand-gold hover:bg-brand-gold/5 transition-all" title="Copy Link" aria-label="Copy link">
                  {copied ? <Check size={16} className="text-brand-success" /> : <LinkIcon size={16} />}
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
