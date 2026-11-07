"""Postbuild: the AI-search (AiO) signals stay on the pages that carry them.

Each rule maps to a point of the 2026-11 AiO audit:
  * /faq/ exists, answers the identity questions, and carries FAQPage + BreadcrumbList.
  * The four hand-built service pages carry a HowTo whose step count equals the
    visible process cards, plus the founder block, "Last updated" and availability lines.
  * The maintenance page shows its update date without a construction booking or reviewer claim.
  * Offers carry a CAD price range only where the page publishes one.
  * The Unilock vs Techo-Bloc vs Permacon guide has its at-a-glance table; the
    contractor guide has its comparison checklist table.
  * /faq/ is in the generated sitemap with a lastmod.
Runs after generate-sitemap.py. Fails the build on any miss.
"""
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CLIENT = ROOT / 'build/client'
ORIGIN = 'https://goldenmaplelandscaping.ca'
AVAILABILITY = 'Now booking Spring 2027 projects. A site visit is booked once scope and budget are confirmed.'
IDENTITY_QUESTIONS = [
    'Who is Golden Maple Landscaping?',
    'What does Golden Maple Landscaping do?',
    'Why choose Golden Maple Landscaping?',
    'When is Golden Maple Landscaping booking projects?',
]
# path -> expected Offer (min, max) or None when the page publishes no range.
SERVICE_PAGES = {
    '/services/interlocking-barrie/': (40, 45),
    '/services/retaining-walls-barrie/': (330, 670),
    '/services/landscape-design-barrie/': (5000, None),
    '/services/composite-decking-barrie/': None,
}
TEMPLATE_PAGES = ['/services/interlocking-driveways-barrie/', '/services/interlocking-innisfil/']
MISSING: list = []
LAST_UPDATED = re.compile(r'Last updated:\s*(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}')


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_ld = self.in_script = False
        self.parts, self.blocks, self.text = [], [], []

    def handle_starttag(self, tag, attrs):
        if tag == 'script':
            self.in_script = True
            if dict(attrs).get('type') == 'application/ld+json':
                self.in_ld, self.parts = True, []

    def handle_endtag(self, tag):
        if tag == 'script':
            if self.in_ld:
                self.blocks.append(json.loads(''.join(self.parts)))
            self.in_ld = self.in_script = False

    def handle_data(self, data):
        if self.in_ld:
            self.parts.append(data)
        elif not self.in_script:
            self.text.append(data)


def load(path: str) -> Page:
    file = CLIENT / path.strip('/') / 'index.html'
    page = Page()
    if not file.exists():
        page.body = ''
        MISSING.append(f'{path}: page not prerendered')
        return page
    page.feed(file.read_text(encoding='utf-8'))
    page.body = re.sub(r'\s+', ' ', ' '.join(page.text))
    return page


def nodes(value):
    if isinstance(value, dict):
        yield value
        for v in value.values():
            yield from nodes(v)
    elif isinstance(value, list):
        for v in value:
            yield from nodes(v)


def typed(page: Page, type_name: str):
    out = []
    for block in page.blocks:
        for n in nodes(block):
            t = n.get('@type')
            if t == type_name or (isinstance(t, list) and type_name in t):
                out.append(n)
    return out


def check_signals(page: Page, path: str, problems: list):
    if not LAST_UPDATED.search(page.body):
        problems.append(f'{path}: no visible "Last updated: <Month D, YYYY>" line')
    if AVAILABILITY not in page.body:
        problems.append(f'{path}: availability line missing')


def main():
    problems = []

    faq = load('/faq/')
    asked = [q.get('name') for n in typed(faq, 'FAQPage') for q in n.get('mainEntity', [])]
    for q in IDENTITY_QUESTIONS:
        if q not in asked:
            problems.append(f'/faq/: FAQPage missing "{q}"')
        if q not in faq.body:
            problems.append(f'/faq/: question not visible "{q}"')
    if len(asked) < len(IDENTITY_QUESTIONS) + 4:
        problems.append(f'/faq/: expected identity + homepage questions, FAQPage has {len(asked)}')
    if not typed(faq, 'BreadcrumbList'):
        problems.append('/faq/: no BreadcrumbList')
    if AVAILABILITY not in faq.body:
        problems.append('/faq/: availability line missing')

    for path, offer in SERVICE_PAGES.items():
        page = load(path)
        howtos = typed(page, 'HowTo')
        if len(howtos) != 1:
            problems.append(f'{path}: expected 1 HowTo, found {len(howtos)}')
        else:
            steps = howtos[0].get('step', [])
            visible = [s.get('name') for s in steps if s.get('name') and s['name'] in page.body]
            if len(steps) < 3 or len(visible) != len(steps):
                problems.append(f'{path}: HowTo steps {len(steps)}, visible {len(visible)}')
        check_signals(page, path, problems)
        if 'Reviewed by Yorkis Estevez' not in page.body:
            problems.append(f'{path}: "Reviewed by Yorkis Estevez" line missing')
        if 'About Yorkis Estevez' not in page.body:
            problems.append(f'{path}: founder block missing')
        specs = [s for n in typed(page, 'Service') for s in nodes(n.get('offers', {})) if 'priceCurrency' in s]
        if offer is None:
            if any('minPrice' in s or 'price' in s for s in specs):
                problems.append(f'{path}: publishes no range but its Offer has a price')
            continue
        lo, hi = offer
        if f'${lo:,}' not in page.body:
            problems.append(f'{path}: Offer minPrice {lo} is not a figure the page shows')
        match = [s for s in specs if s.get('priceCurrency') == 'CAD' and s.get('minPrice') == lo and s.get('maxPrice') == hi
                 and s.get('valueAddedTaxIncluded') is False]
        if not match:
            problems.append(f'{path}: no CAD Offer min={lo} max={hi} (tax excluded); found {specs}')

    for path in TEMPLATE_PAGES:
        page = load(path)
        check_signals(page, path, problems)
        if 'About Yorkis Estevez' not in page.body:
            problems.append(f'{path}: founder block missing')
        # No review is recorded for template pages (src/data/pageUpdates.ts) — never stamp one.
        if 'Reviewed by' in page.body or 'reviewedBy' in json.dumps(page.blocks):
            problems.append(f'{path}: template page claims a review that is not recorded')

    maintenance_path = '/services/landscape-maintenance-barrie/'
    maintenance = load(maintenance_path)
    if not LAST_UPDATED.search(maintenance.body):
        problems.append(f'{maintenance_path}: update date missing')
    if 'Now booking Spring 2027' in maintenance.body or 'scope and budget are confirmed' in maintenance.body:
        problems.append(f'{maintenance_path}: construction booking language is visible')
    if 'Reviewed by' in maintenance.body or 'reviewed the scope' in maintenance.body or any('reviewedBy' in node for node in typed(maintenance, 'WebPage')):
        problems.append(f'{maintenance_path}: claims a review that is not recorded')

    brands = load('/resources/unilock-vs-techo-bloc-vs-permacon/')
    if 'The Three Brands at a Glance' not in brands.body or 'Price position' not in brands.body:
        problems.append('paver guide: at-a-glance table missing')
    if not LAST_UPDATED.search(brands.body):
        problems.append('paver guide: no visible Last updated line')
    contractor = load('/resources/how-to-choose-landscaping-contractor-barrie/')
    if 'How to compare Barrie landscaping contractors' not in contractor.body or 'What Golden Maple publishes' not in contractor.body:
        problems.append('contractor guide: comparison checklist table missing')
    html = (CLIENT / 'resources/how-to-choose-landscaping-contractor-barrie/index.html').read_text(encoding='utf-8') if contractor.body else ''
    if re.search(r'<td[^>]*>\s*</td>', html):
        problems.append('contractor guide: comparison table has an empty cell')

    problems[:0] = MISSING
    sitemap = (CLIENT / 'sitemap.xml').read_text(encoding='utf-8')
    if not re.search(rf'<loc>{re.escape(ORIGIN)}/faq/</loc><lastmod>\d{{4}}-\d{{2}}-\d{{2}}</lastmod>', sitemap):
        problems.append('sitemap: /faq/ missing or has no lastmod')

    print(json.dumps({'passed': not problems, 'problems': problems}, indent=2))
    sys.exit(1 if problems else 0)


if __name__ == '__main__':
    main()
