"""Postbuild: the structured-data entity graph must stay coherent on every page.

Rules (per prerendered page, across all its JSON-LD blocks):
  1. Exactly one TYPED #business node (root.tsx). Everything else only references
     it by {"@id": ...}. Before 2026-09 each page declared the business 2-3 times
     under different types (LocalBusiness, LandscapeService, a per-town
     LocalBusiness), which splits the entity.
  2. No other LocalBusiness-family node on any page.
  3. The founder Person (#yorkis-estevez) is declared at most once, and only
     referenced on pages that declare it (it is gated on the register).
  4. Date properties are ISO 8601.
  5. On-site URLs in url/item/@id use the trailing-slash form Netlify serves
     (files like /logo.svg and #fragments excepted).
  6. At most one FAQPage per page.
"""
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CLIENT = ROOT / 'build/client'
ORIGIN = 'https://goldenmaplelandscaping.ca'
BUSINESS_ID = f'{ORIGIN}/#business'
FOUNDER_ID = f'{ORIGIN}/#yorkis-estevez'
BUSINESS_TYPES = {'LocalBusiness', 'HomeAndConstructionBusiness', 'GeneralContractor', 'LandscapeService', 'ProfessionalService', 'Organization'}
DATE_KEYS = {'datePublished', 'dateModified', 'lastReviewed', 'foundingDate', 'uploadDate'}
URL_KEYS = {'url', 'item', '@id'}
ISO = re.compile(r'^\d{4}(-\d{2}(-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?)?)?$')


class LD(HTMLParser):
    def __init__(self):
        super().__init__()
        self.active, self.parts, self.blocks, self.errors = False, [], [], []

    def handle_starttag(self, tag, attrs):
        if tag == 'script' and dict(attrs).get('type') == 'application/ld+json':
            self.active, self.parts = True, []

    def handle_endtag(self, tag):
        if tag == 'script' and self.active:
            self.active = False
            raw = ''.join(self.parts)
            try:
                self.blocks.append(json.loads(raw))
            except json.JSONDecodeError as e:
                self.errors.append(f'invalid JSON-LD: {e}')

    def handle_data(self, data):
        if self.active:
            self.parts.append(data)


def walk(value, key=None):
    """Yield (key, dict) for every dict and (key, scalar) for every scalar, recursively."""
    if isinstance(value, dict):
        yield key, value
        for k, v in value.items():
            yield from walk(v, k)
    elif isinstance(value, list):
        for v in value:
            yield from walk(v, key)
    else:
        yield key, value


def types_of(node):
    t = node.get('@type')
    return set(t) if isinstance(t, list) else ({t} if t else set())


def check_page(path: Path):
    ld = LD()
    ld.feed(path.read_text(encoding='utf-8'))
    problems = list(ld.errors)
    typed_business = typed_founder = faq_pages = 0
    founder_refs = 0
    for block in ld.blocks:
        for key, item in walk(block):
            if isinstance(item, dict):
                types = types_of(item)
                node_id = item.get('@id')
                if node_id == BUSINESS_ID and types:
                    typed_business += 1
                elif types & BUSINESS_TYPES and 'Organization' not in types:
                    problems.append(f'extra business node {sorted(types)} @id={node_id!r}')
                if node_id == FOUNDER_ID:
                    if types:
                        typed_founder += 1
                    else:
                        founder_refs += 1
                if 'FAQPage' in types:
                    faq_pages += 1
                continue
            if key in DATE_KEYS and isinstance(item, str) and not ISO.match(item):
                problems.append(f'non-ISO {key}: {item!r}')
            if key in URL_KEYS and isinstance(item, str) and item.startswith(ORIGIN):
                base = re.split(r'[?#]', item, maxsplit=1)[0]
                tail = base[len(ORIGIN):]
                if tail and not tail.endswith('/') and not re.search(r'\.[a-z0-9]{2,5}$', tail, re.I):
                    problems.append(f'{key} missing trailing slash: {item}')
    if typed_business != 1:
        problems.append(f'expected exactly 1 typed #business node, found {typed_business}')
    if typed_founder > 1:
        problems.append(f'#yorkis-estevez declared {typed_founder} times')
    if founder_refs and not typed_founder:
        problems.append('#yorkis-estevez referenced but not declared on this page')
    if faq_pages > 1:
        problems.append(f'{faq_pages} FAQPage nodes (max 1)')
    return problems, typed_founder


def main():
    pages = sorted(CLIENT.rglob('index.html'))
    assert len(pages) > 80, 'Missing/truncated build is not a pass'
    failures, with_founder = {}, 0
    for path in pages:
        problems, founder = check_page(path)
        with_founder += bool(founder)
        if problems:
            route = '/' + path.parent.relative_to(CLIENT).as_posix().strip('.')
            failures[route] = problems
    print(json.dumps({'passed': not failures, 'pages_checked': len(pages), 'pages_declaring_founder': with_founder,
                      'failing_pages': len(failures), 'first_failures': dict(list(failures.items())[:8])}, indent=2))
    sys.exit(1 if failures else 0)


if __name__ == '__main__':
    main()
