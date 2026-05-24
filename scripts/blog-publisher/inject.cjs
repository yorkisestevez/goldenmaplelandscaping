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
      readTime=${JSON.stringify(draft.readTime.includes('min') ? draft.readTime : draft.readTime + ' min read')}
      heroImage=${JSON.stringify(draft.heroImage)}
      schema={faqSchema}
    >
      <div dangerouslySetInnerHTML={{ __html: ${introHtml} }} />

${sectionsJsx}

      <h2>Frequently Asked Questions</h2>
      <div className="mt-8">
${faqsJsx}
      </div>

      <div dangerouslySetInnerHTML={{ __html: ${ctaLiteral} }} />
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

  const importAnchor = src.match(/(const \w+ = lazy\(\(\) => import\('\.\/pages\/blog\/[^']+'\)\);\n)(?![\s\S]*const \w+ = lazy\(\(\) => import\('\.\/pages\/blog\/)/);
  if (!importAnchor) throw new Error('Could not locate blog import block in App.tsx');
  src = src.replace(importAnchor[0], importAnchor[0] + importLine + '\n');

  const routeAnchor = src.match(/(\s+<Route path="\/resources\/[^"]+" element=\{<\w+ \/>\} \/>\n)(?![\s\S]*<Route path="\/resources\/)/);
  if (!routeAnchor) throw new Error('Could not locate blog route block in App.tsx');
  src = src.replace(routeAnchor[0], routeAnchor[0] + routeLine + '\n');

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
    readTime: ${JSON.stringify(draft.readTime.includes('min') ? draft.readTime : draft.readTime + ' min')},
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
