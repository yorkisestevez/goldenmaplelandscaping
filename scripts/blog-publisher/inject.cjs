// scripts/blog-publisher/inject.cjs
// Writes the 4 user-facing files (.tsx + routes.ts + Resources.tsx + sitemap.xml)
// inside the repo. Called in-process from cli.cjs workflow-run.

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
// RR7 framework mode (migration d9a66cf, 2026-07): src/App.tsx is gone — the
// route tree now lives in src/routes.ts and each blog page is its own route
// module. ssr:false + prerender({getStaticPaths}) means a new static route is
// prerendered automatically with no extra wiring.
const ROUTES_TS = path.join(REPO_ROOT, 'src/routes.ts');
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
  // Emitted as a component so the founder photo lives in ONE place
  // (src/data/founder.ts). This block used to inline the <img> path, which is
  // how 18 posts ended up hardcoding it. bio={"..."} not bio="..." because a
  // JSX attribute cannot carry backslash escapes.
  const bioJsx = draft.author_bio
    ? `      <AuthorBio bio={${JSON.stringify(draft.author_bio)}} />\n\n`
    : '';
  const bioImport = draft.author_bio
    ? `\nimport AuthorBio from '../../components/AuthorBio';`
    : '';

  return `import BlogPostLayout from '../../components/BlogPostLayout';${bioImport}

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

function injectIntoRoutes(draft) {
  const compName = slugToComponent(draft.slug);
  const routeLine = `  route('resources/${draft.slug}', 'pages/blog/${compName}.tsx'),`;

  let src = fs.readFileSync(ROUTES_TS, 'utf8');
  if (src.includes(`'pages/blog/${compName}.tsx'`)) throw new Error(`routes.ts already routes ${compName}`);
  if (src.includes(`route('resources/${draft.slug}'`)) throw new Error(`routes.ts already routes /resources/${draft.slug}`);

  // Anchor on the LAST blog route so new posts append to the bottom of that
  // block. \r?\n so the regex works on both LF (Linux CI runners) AND CRLF
  // (Windows local checkouts) — caught 2026-06-15 when the Claude routine ran
  // the injector from a Windows working tree and every regex match failed.
  const routeAnchor = src.match(/([ \t]*route\('resources\/[^']+', 'pages\/blog\/[^']+'\),\r?\n)(?![\s\S]*route\('resources\/[^']+', 'pages\/blog\/)/);
  if (!routeAnchor) throw new Error('Could not locate blog route block in routes.ts');
  // Use the same line ending the file already uses, so we don't mix CRLF/LF.
  const eol = routeAnchor[0].endsWith('\r\n') ? '\r\n' : '\n';
  src = src.replace(routeAnchor[0], routeAnchor[0] + routeLine + eol);

  fs.writeFileSync(ROUTES_TS, src);
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
  const url = `https://goldenmaplelandscaping.ca/resources/${draft.slug}/`;
  const alreadyListed = src.includes(url) || src.includes(`https://goldenmaplelandscaping.ca/resources/${draft.slug}</loc>`);
  if (alreadyListed) throw new Error(`sitemap.xml already lists ${url}`);
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

  // All-or-nothing. The four writes are not atomic, so if a later step throws
  // (2026-08-01: routes.ts injection died on the stale App.tsx path) we roll the
  // earlier ones back. Otherwise the half-written post orphans a .tsx that makes
  // EVERY retry fail on the `already exists` guard above — one crash silently
  // ends the publishing cadence until a human notices.
  const rollback = [];
  const snapshot = (p) => rollback.push({ path: p, before: fs.readFileSync(p, 'utf8') });
  try {
    fs.writeFileSync(newTsxPath, buildTsx(draft));
    rollback.push({ path: newTsxPath, before: null });

    snapshot(ROUTES_TS);
    injectIntoRoutes(draft);

    snapshot(RESOURCES_TSX);
    injectIntoResources(draft);

    snapshot(SITEMAP_XML);
    injectIntoSitemap(draft);
  } catch (err) {
    for (const { path: p, before } of rollback.reverse()) {
      try {
        if (before === null) fs.unlinkSync(p);
        else fs.writeFileSync(p, before);
      } catch { /* best-effort — never mask the original error */ }
    }
    throw err;
  }

  const relTsx = path.relative(REPO_ROOT, newTsxPath).replace(/\\/g, '/');
  return {
    slug: draft.slug,
    compName,
    route: `/resources/${draft.slug}`,
    filesChanged: [relTsx, 'src/routes.ts', 'src/pages/Resources.tsx', 'public/sitemap.xml']
  };
}

module.exports = { injectDraft, slugToComponent, buildTsx };
