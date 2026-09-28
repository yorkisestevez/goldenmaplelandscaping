"""Postbuild: generate build/client/sitemap.xml from the prerendered pages.

Replaces the hand-maintained public/sitemap.xml (deleted 2026-09-27), which had to
be edited for every new route and drifted (trailing-slash 301s, orphaned posts).
A page is listed when it is indexable (no robots noindex) AND self-canonical: its
<link rel=canonical> equals its own trailing-slash URL. That automatically leaves
out the Google Ads aliases (canonical -> /services/*) and the noindex thank-you
page. lastmod comes from the page's Article dateModified when present.

Fails the build when an indexable page has no canonical, or when the URL count
drops below MIN_URLS (a truncated build must not ship a truncated sitemap).
"""
import json
from datetime import date
from html.parser import HTMLParser
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[1]
CLIENT = ROOT / 'build/client'
ORIGIN = 'https://goldenmaplelandscaping.ca'
MIN_URLS = 130


class Head(HTMLParser):
    def __init__(self):
        super().__init__()
        self.canonical = None
        self.robots = ''
        self.in_ld = False
        self.ld_parts = []
        self.schemas = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'link' and (a.get('rel') or '').lower() == 'canonical':
            self.canonical = a.get('href')
        if tag == 'meta' and (a.get('name') or '').lower() == 'robots':
            self.robots = (a.get('content') or '').lower()
        if tag == 'script' and a.get('type') == 'application/ld+json':
            self.in_ld, self.ld_parts = True, []

    def handle_endtag(self, tag):
        if tag == 'script' and self.in_ld:
            self.in_ld = False
            try:
                self.schemas.append(json.loads(''.join(self.ld_parts)))
            except json.JSONDecodeError:
                pass

    def handle_data(self, data):
        if self.in_ld:
            self.ld_parts.append(data)


def nodes(schema):
    if isinstance(schema, list):
        for s in schema:
            yield from nodes(s)
    elif isinstance(schema, dict):
        yield schema
        for key in ('@graph',):
            if key in schema:
                yield from nodes(schema[key])


def page_url(index_html: Path) -> str:
    rel = index_html.parent.relative_to(CLIENT).as_posix()
    return f'{ORIGIN}/' if rel == '.' else f'{ORIGIN}/{rel}/'


def lastmod_for(head: Head):
    for schema in head.schemas:
        for node in nodes(schema):
            t = node.get('@type')
            if t == 'Article' or (isinstance(t, list) and 'Article' in t):
                value = node.get('dateModified') or node.get('datePublished')
                if isinstance(value, str):
                    try:
                        return date.fromisoformat(value[:10]).isoformat()
                    except ValueError:
                        return None
    return None


def main():
    pages = sorted(CLIENT.rglob('index.html'))
    entries, excluded, missing_canonical = [], [], []
    for path in pages:
        head = Head()
        head.feed(path.read_text(encoding='utf-8'))
        url = page_url(path)
        if 'noindex' in head.robots:
            excluded.append((url, 'noindex'))
            continue
        if not head.canonical:
            missing_canonical.append(url)
            continue
        if head.canonical != url:
            excluded.append((url, f'canonical -> {head.canonical}'))
            continue
        entries.append((url, lastmod_for(head)))

    assert not missing_canonical, f'indexable pages without a canonical: {missing_canonical}'
    assert len(entries) >= MIN_URLS, f'sitemap would list only {len(entries)} URLs (< {MIN_URLS}); refusing a truncated build'

    lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for url, lastmod in sorted(entries, key=lambda e: (e[0] != f'{ORIGIN}/', e[0])):
        lines.append(f'  <url><loc>{escape(url)}</loc>' + (f'<lastmod>{lastmod}</lastmod>' if lastmod else '') + '</url>')
    lines.append('</urlset>')
    (CLIENT / 'sitemap.xml').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(json.dumps({'sitemap_urls': len(entries), 'excluded': len(excluded), 'excluded_examples': excluded[:8]}, indent=2))


if __name__ == '__main__':
    main()
