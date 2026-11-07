import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const page = read('../src/pages/services/PorcelainPatiosBarrie.tsx');
const routes = read('../src/routes.ts');
const contact = read('../src/pages/Contact.tsx');
const forms = read('../public/__forms.html');
const services = read('../src/pages/Services.tsx');

assert.match(routes, /route\('services\/porcelain-patios-barrie', 'pages\/services\/PorcelainPatiosBarrie\.tsx'\)/,
  'the porcelain page has an explicit service route');
assert.match(page, /title="Porcelain Patios in Barrie \| Golden Maple Landscaping"/,
  'the page sets a concise, unique porcelain + Barrie title');
assert.match(page, /description="Planning a porcelain patio in Barrie or Simcoe County\?/,
  'the page has a unique local decision-focused meta description');
assert.match(page, /canonical="https:\/\/goldenmaplelandscaping\.ca\/services\/porcelain-patios-barrie"/,
  'the page canonical matches its route');
assert.match(page, /general patio photographs[\s\S]*?not identified as porcelain installations/i,
  'generic patio imagery is explicitly not represented as porcelain proof');
assert.match(page, /No porcelain project photo or completed porcelain case study is presented here as proof/i,
  'the page does not imply unverified porcelain portfolio proof');
assert.doesNotMatch(page, /<img\b|<ResponsiveImage\b|<video\b/i,
  'the page does not add unsupported project imagery');
assert.match(page, /Compare the actual products[\s\S]*Match the choice to the space[\s\S]*Get the scope in writing/,
  'decision utility covers product, fit, and written scope');
assert.match(page, /\/resources\/pool-deck-materials-ontario/,
  'the page links to a relevant pool-deck material comparison');
assert.match(page, /\/resources\/natural-stone-vs-pavers-barrie/,
  'the page links to a relevant paver/material comparison');
assert.match(services, /Porcelain Patio Planning[\s\S]*?\/services\/porcelain-patios-barrie/,
  'the existing Services hub links to the porcelain page');

const backendValue = 'Porcelain Patio / Pavers';
assert.match(contact, new RegExp(`<option>${backendValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</option>`),
  'porcelain is an option in the existing contact service field');
assert.match(contact, /const requestedService = searchParams\.get\('service'\)/,
  'the existing contact service can be preselected from the page CTA');
assert.match(contact, /serviceOptions\.includes\(requestedService\)/,
  'URL service values are allowlisted against existing choices');
assert.match(page, /contact\?service=Porcelain%20Patio%20%2F%20Pavers/,
  'porcelain CTA routes to the allowlisted contact selection');
assert.match(forms, /<form name="contact"[^>]*>[\s\S]*?<input type="text" name="service" \/>/,
  'the existing Netlify contact schema already supports the service field');
assert.match(contact, /'form-name': 'contact',[\s\S]*\.\.\.form,[\s\S]*details: enrichedDetails/,
  'the service value is sent through the existing contact payload and repeated in CRM details');

console.log('PASS porcelain service route, unique SEO metadata/canonical, decision content, honest image provenance, relevant links, allowlisted contact preselection, and existing backend field compatibility');
