// scripts/blog-publisher/inject.cjs
// Writes the 4 user-facing files (.tsx + App.tsx + Resources.tsx + sitemap.xml)
// inside the repo. Called in-process from cli.cjs workflow-run.

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const APP_TSX = path.join(REPO_ROOT, 'src/App.tsx');
const RESOURCES_TSX = path.join(REPO_ROOT, 'src/pages/Resources.tsx');
const SITEMAP_XML = path.join(REPO_ROOT, 'public/sitemap.xml');
const BLOG_DIR = path.join(REPO_ROOT, 'src/pages/blog');

function slugToComponent(slug) {
  return slug.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}
function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
function formatIsoDate(iso) {
  return new Date(iso).toISOString().slice(0, 10);
}

// Defensive normalization — Gemini sometimes returns readTime as a bare
// integer instead of a string. generate.cjs normalizes once after parse,
// but this fallback ensures inject can't crash even if a draft was generated
// before that fix (replay scenarios, hand-loaded test fixtures, etc.).
function normalizeReadTime(rt, suffix) {
  const str = typeof rt === 'number' ? `${rt} min` : (typeof rt === 'string' ? rt : '8 min');
  return str.includes('min') ? str : str + suffix;
}

function buildTsx(draft) {
  const compName = slugToComponent(draft.slug);
  const faqMainEntity = (draft.faqs || []).map(f => ({
    "@type": "Question",
    "name": f.question,
    "acceptedAnswer": { "@type": "Answer", "text": f.answer }
  }));
  const faqSchemaLiteral = JSON.stringify({
    "@type": "FAQPage",
    "mainEntity": faqMainEntity
  }, null, 4).split('\n').map((l, i) => i === 0 ? l : '  ' + l).join('\n');

  const introHtml = JSON.stringify(draft.intro);
  const sectionsJsx = (draft.sections || []).map((s) => {
    const headingEscaped = s.heading.replace(/"/g, '\\"');
    const htmlLiteral = JSON.stringify(s.html);
    return `      <h2>${headingEscaped}</h2>\n      <div dangerouslySetInnerHTML={{ __html: ${htmlLiteral} }} />\n`;
  }).join('\n');

  const faqsJsx = (draft.faqs || []).map((f) => {
    const qEscaped = f.question.replace(/"/g, '\\"');
    const aLiteral = JSON.stringify(`<p>${f.answer}</p>`);
    return `        <div className="mb-8">\n          <h3 className="font-display text-2xl text-brand-bonewhite mb-3">${qEscaped}</h3>\n          <div dangerouslySetInnerHTML={{ __html: ${aLiteral} }} />\n        </div>`;
  }).join('\n');

  const ctaLiteral = JSON.stringify(`<p>${draft.cta_paragraph}</p>`);

  // TLDR — rendered as a "Quick Answer" box at the very top. Featured-snippet target.
  const tldrJsx = draft.tldr
    ? `      <div className="not-prose mb-12 p-7 rounded-2xl border border-brand-gold/30 bg-gradient-to-b from-brand-gold/[0.08] to-transparent">\n        <div className="font-sans text-[10px] uppercase tracking-[0.3em] text-brand-gold mb-3">Quick Answer</div>\n        <p className="font-sans text-base text-brand-bonewhite font-light leading-relaxed mb-0">${draft.tldr.replace(/"/g, '\\"').replace(/'/g, "\\'")}</p>\n      </div>\n\n`
    : '';

  // Comparison table — rendered if the topic warranted one
  const tableJsx = (draft.comparison_table?.include && draft.comparison_table?.html)
    ? `      <div className="not-prose my-10 overflow-x-auto">\n        ${draft.comparison_table.caption ? `<p className="font-sans text-[11px] uppercase tracking-widest text-brand-gold mb-3">${draft.comparison_table.caption.replace(/"/g, '\\"')}</p>\n        ` : ''}<div dangerouslySetInnerHTML={{ __html: ${JSON.stringify(draft.comparison_table.html)} }} />\n      </div>\n\n`
    : '';

  // Author bio — closes the article. E-E-A-T signal for Google + AI engines.
  const bioJsx = draft.author_bio
    ? `      <div className="not-prose mt-16 mb-8 p-6 rounded-2xl border border-brand-gold/20 bg-brand-surface/40">\n        <div className="flex items-start gap-4">\n          <img src="/images/projects/Yorkis Estevez.jpg" alt="Yorkis Estevez, Founder of Golden Maple Landscaping" loading="lazy" decoding="async" className="w-16 h-16 rounded-full object-cover border border-brand-gold/30 shrink-0" />\n          <div>\n            <div className="font-sans text-[10px] uppercase tracking-[0.3em] text-brand-gold mb-2">About the Author</div>\n            <p className="font-sans text-sm text-brand-bonewhite font-light leading-relaxed mb-0">${draft.author_bio.replace(/"/g, '\\"').replace(/'/g, "\\'")}</p>\n          </div>\n        </div>\n      </div>\n\n`
    : '';

  return `import BlogPostLayout from '../../components/BlogPostLayout';

export default function ${compName}() {
  const faqSchema = ${faqSchemaLiteral};

  return (
    <BlogPostLayout
      title=${JSON.stringify(draft.title)}
      seoTitle=${JSON.stringify(draft.seoTitle)}
      seoDescription=${JSON.stringify(draft.seoDescription)}
      category=${JSON.stringify(draft.category)}
      date=${JSON.stringify(formatDate(draft.generatedAt))}
      readTime=${JSON.stringify(normalizeReadTime(draft.readTime, ' min read'))}
      heroImage=${JSON.stringify(draft.heroImage)}
      schema={faqSchema}
      tldr=${JSON.stringify(draft.tldr || '')}
      keywords=${JSON.stringify(draft.seoTitle || draft.title)}
      wordCount={${draft.validation?.wordCount || 0}}
    >
${tldrJsx}      <div dangerouslySetInnerHTML={{ __html: ${introHtml} }} />

${sectionsJsx}
${tableJsx}      <h2>Frequently Asked Questions</h2>
      <div className="mt-8">
${faqsJsx}
      </div>

${bioJsx}      <div dangerouslySetInnerHTML={{ __html: ${ctaLiteral} }} />
    </BlogPostLayout>
  );
}
`;
}

function injectIntoAppTsx(draft) {
  const compName = slugToComponent(draft.slug);
  const importLine = `const ${compName} = lazy(() => import('./pages/blog/${compName}'));`;
  const routeLine = `              <Route path="/resources/${draft.slug}" element={<${compName} />} />`;

  let src = fs.readFileSync(APP_TSX, 'utf8');
  if (src.includes(`./pages/blog/${compName}`)) throw new Error(`App.tsx already imports ${compName}`);

  // \r?\n so the regex works on both LF (Linux CI runners) AND CRLF (Windows
  // local checkouts) — caught 2026-06-15 when the Claude routine ran the
  // injector from a Windows working tree and every regex match failed.
  const importAnchor = src.match(/(const \w+ = lazy\(\(\) => import\('\.\/pages\/blog\/[^']+'\)\);\r?\n)(?![\s\S]*const \w+ = lazy\(\(\) => import\('\.\/pages\/blog\/)/);
  if (!importAnchor) throw new Error('Could not locate blog import block in App.tsx');
  // Use the same line ending the file already uses, so we don't mix CRLF/LF.
  const eol = importAnchor[0].endsWith('\r\n') ? '\r\n' : '\n';
  src = src.replace(importAnchor[0], importAnchor[0] + importLine + eol);

  const routeAnchor = src.match(/(\s+<Route path="\/resources\/[^"]+" element=\{<\w+ \/>\} \/>\r?\n)(?![\s\S]*<Route path="\/resources\/)/);
  if (!routeAnchor) throw new Error('Could not locate blog route block in App.tsx');
  const routeEol = routeAnchor[0].endsWith('\r\n') ? '\r\n' : '\n';
  src = src.replace(routeAnchor[0], routeAnchor[0] + routeLine + routeEol);

  fs.writeFileSync(APP_TSX, src);
}

function injectIntoResources(draft) {
  let src = fs.readFileSync(RESOURCES_TSX, 'utf8');
  if (src.includes(`slug: '${draft.slug}'`)) throw new Error(`Resources.tsx already lists slug '${draft.slug}'`);

  const arrayStart = src.indexOf('const BLOG_POSTS = [');
  if (arrayStart === -1) throw new Error('Could not locate BLOG_POSTS in Resources.tsx');
  const firstBrace = src.indexOf('{', arrayStart);
  if (firstBrace === -1) throw new Error('Could not locate first BLOG_POSTS entry');

  const newEntry = `  {
    slug: ${JSON.stringify(draft.slug)},
    title: ${JSON.stringify(draft.title)},
    excerpt: ${JSON.stringify(draft.seoDescription)},
    category: ${JSON.stringify(draft.category)},
    readTime: ${JSON.stringify(normalizeReadTime(draft.readTime, ' min'))},
    image: ${JSON.stringify(draft.heroImage)},
  },
`;

  src = src.slice(0, firstBrace) + newEntry + '  ' + src.slice(firstBrace);
  fs.writeFileSync(RESOURCES_TSX, src);
}

function injectIntoSitemap(draft) {
  let src = fs.readFileSync(SITEMAP_XML, 'utf8');
  const url = `https://goldenmaplelandscaping.ca/resources/${draft.slug}`;
  if (src.includes(url)) throw new Error(`sitemap.xml already lists ${url}`);
  const today = formatIsoDate(draft.generatedAt);
  const newUrl = `  <url><loc>${url}</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>\n`;
  src = src.replace('</urlset>', newUrl + '</urlset>');
  fs.writeFileSync(SITEMAP_XML, src);
}

function injectDraft(draft) {
  if (!draft) throw new Error('injectDraft requires a draft object');
  const compName = slugToComponent(draft.slug);
  const newTsxPath = path.join(BLOG_DIR, `${compName}.tsx`);
  if (fs.existsSync(newTsxPath)) throw new Error(`${newTsxPath} already exists`);

  fs.writeFileSync(newTsxPath, buildTsx(draft));
  injectIntoAppTsx(draft);
  injectIntoResources(draft);
  injectIntoSitemap(draft);

  const relTsx = path.relative(REPO_ROOT, newTsxPath).replace(/\\/g, '/');
  return {
    slug: draft.slug,
    compName,
    route: `/resources/${draft.slug}`,
    filesChanged: [relTsx, 'src/App.tsx', 'src/pages/Resources.tsx', 'public/sitemap.xml']
  };
}

module.exports = { injectDraft, slugToComponent, buildTsx };
