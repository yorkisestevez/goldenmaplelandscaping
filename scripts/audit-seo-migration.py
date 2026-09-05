#!/usr/bin/env python3
"""Read-only SEO migration inventory.

Crawls an old-host sitemap (including nested sitemaps) plus the current-host
sitemap, then writes raw page evidence and a redirect-decision inventory.
No redirects, robots directives, publishing, authentication, GSC access, or
other mutations are performed.

Usage (from repository root):
  python scripts/audit-seo-migration.py
"""
from __future__ import annotations

import csv
import json
import re
import sys
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urljoin, urlparse, urlunparse
from urllib.request import Request, build_opener, HTTPRedirectHandler
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "seo-migration"
OLD_SITEMAP = "https://seo.goldenmaplelandscaping.ca/sitemap.xml"
MAIN_SITEMAP = "https://goldenmaplelandscaping.ca/sitemap.xml"
UA = "GoldenMapleSEOMigrationAudit/1.0 (+read-only; contact site owner)"
TIMEOUT = 30

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = ""; self.description = ""; self.canonical = ""
        self.robots_meta = []; self.h1s = []; self.links = []
        self.text = []; self._tag = None; self._h1 = False
    def handle_starttag(self, tag, attrs):
        a = dict(attrs); tag = tag.lower()
        if tag == "meta":
            name = a.get("name", "").lower(); prop = a.get("property", "").lower()
            if name == "description": self.description = a.get("content", "")
            if name == "robots" or prop == "robots": self.robots_meta.append(a.get("content", ""))
        elif tag == "link" and a.get("rel", "").lower() == "canonical": self.canonical = a.get("href", "")
        elif tag == "a" and a.get("href"): self.links.append(a["href"])
        elif tag in {"script", "style", "noscript", "svg"}: self._tag = tag
        elif tag == "h1": self._h1 = True
    def handle_endtag(self, tag):
        if tag.lower() == self._tag: self._tag = None
        if tag.lower() == "h1": self._h1 = False
    def handle_data(self, data):
        if self._tag: return
        clean = " ".join(data.split())
        if not clean: return
        if self._h1: self.h1s.append(clean)
        elif self.lasttag == "title": self.title += clean
        else: self.text.append(clean)
    def handle_startendtag(self, tag, attrs): self.handle_starttag(tag, attrs)

def get(url: str, follow: bool = True) -> tuple[int | None, str, dict[str, str], bytes, str | None]:
    opener = build_opener() if follow else build_opener(NoRedirect())
    req = Request(url, headers={"User-Agent": UA, "Accept": "text/html,application/xml;q=0.9,*/*;q=0.8"})
    try:
        with opener.open(req, timeout=TIMEOUT) as r:
            return r.status, r.geturl(), {k.lower(): v for k, v in r.headers.items()}, r.read(), None
    except HTTPError as e:
        return e.code, url, {k.lower(): v for k, v in e.headers.items()}, e.read(), str(e)
    except (URLError, TimeoutError, OSError) as e:
        return None, url, {}, b"", repr(e)

def norm(url: str) -> str:
    p = urlparse(url)
    path = unquote(p.path or "/")
    if path != "/": path = path.rstrip("/")
    return urlunparse((p.scheme.lower(), p.netloc.lower(), path, "", "", ""))

def sitemap_urls(sitemap: str, seen: set[str] | None = None) -> list[str]:
    seen = seen or set()
    if sitemap in seen: return []
    seen.add(sitemap)
    status, _, _, raw, err = get(sitemap)
    if status != 200:
        print(f"SITEMAP ERROR {sitemap}: {status} {err}", file=sys.stderr); return []
    try: root = ET.fromstring(raw)
    except ET.ParseError as e:
        print(f"SITEMAP XML ERROR {sitemap}: {e}", file=sys.stderr); return []
    locs = ["".join(x.itertext()).strip() for x in root.findall(".//{*}loc")]
    if root.tag.lower().endswith("sitemapindex"):
        result = []
        for loc in locs: result.extend(sitemap_urls(loc, seen))
        return result
    return locs

def extract_page(url: str) -> dict[str, Any]:
    direct_status, _, direct_headers, _, _ = get(url, follow=False)
    status, final_url, headers, raw, error = get(url, follow=True)
    content_type = headers.get("content-type", "")
    body = raw.decode("utf-8", "replace")
    p = PageParser()
    if "html" in content_type or "<html" in body.lower():
        try: p.feed(body)
        except Exception: pass
    parsed = urlparse(final_url if final_url else url)
    internal = sorted({norm(urljoin(final_url or url, x)) for x in p.links if urlparse(urljoin(final_url or url, x)).netloc.lower() == parsed.netloc.lower()})
    text = " ".join(p.text)
    robot = " | ".join(p.robots_meta)
    xrobot = headers.get("x-robots-tag", "")
    blocked = any(x in (robot + " " + xrobot).lower() for x in ("noindex", "none"))
    return {"source_url": url, "direct_status": direct_status, "status": status, "final_url": final_url,
      "content_type": content_type, "error": error, "canonical": urljoin(final_url or url, p.canonical) if p.canonical else "",
      "x_robots_tag": xrobot, "meta_robots": robot, "indexability": "NOINDEX" if blocked else ("INDEXABLE" if status == 200 else "UNKNOWN"),
      "title": p.title.strip(), "h1": " | ".join(p.h1s), "description": p.description.strip(),
      "word_count": len(re.findall(r"\b[\w’'-]+\b", text)), "internal_link_count": len(internal), "internal_link_urls": internal,
      "fetch_utc": datetime.now(timezone.utc).isoformat()}

def tokens(url: str) -> set[str]:
    stop = {"www", "https", "http", "goldenmaplelandscaping", "seo", "ca", "com", "the", "and", "for", "with", "of", "in", "to", "a"}
    return {x for x in re.split(r"[^a-z0-9]+", unquote(urlparse(url).path).lower()) if len(x) > 2 and x not in stop}

def candidate(old: dict[str, Any], mains: list[dict[str, Any]]) -> tuple[str, str, str]:
    oldpath = norm(old["source_url"])
    pathmatch = [m for m in mains if norm(m["source_url"]).replace("https://goldenmaplelandscaping.ca", "") == oldpath.replace("https://seo.goldenmaplelandscaping.ca", "")]
    if pathmatch:
        m = pathmatch[0]
        return m["source_url"], "EXACT_PATH_IN_CURRENT_SITEMAP", (
            "Exact old URL path appears in current sitemap. "
            f"Old on-page claim: title={old['title']!r}; H1={old['h1']!r}. "
            f"Current on-page evidence: title={m['title']!r}; H1={m['h1']!r}. "
            "This does not independently verify the current service × municipality offering."
        )
    ot = tokens(old["source_url"])
    scored = []
    for m in mains:
        score = len(ot & tokens(m["source_url"]))
        if score: scored.append((score, m))
    scored.sort(key=lambda x: (-x[0], x[1]["source_url"]))
    if scored:
        score, m = scored[0]
        evidence = (
            f"Automated lexical candidate (token overlap={score}): old={sorted(ot)}, candidate={sorted(tokens(m['source_url']))}. "
            f"Old on-page claim: title={old['title']!r}; H1={old['h1']!r}. "
            f"Candidate on-page evidence: title={m['title']!r}; H1={m['h1']!r}. "
            "Lexical similarity and sitemap presence are not evidence that the business currently offers the service × municipality combination; owner confirmation required."
        )
        return m["source_url"], "LEXICAL_CANDIDATE", evidence
    return "", "NO_CANDIDATE", "No current-sitemap path token overlap; sitemap alone cannot establish whether this service/location is offered."

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    old_urls = list(dict.fromkeys(sitemap_urls(OLD_SITEMAP)))
    main_urls = list(dict.fromkeys(sitemap_urls(MAIN_SITEMAP)))
    # robots is raw host evidence, captured separately, not used to infer offering.
    robots = {}
    for host in ("https://seo.goldenmaplelandscaping.ca/robots.txt", "https://goldenmaplelandscaping.ca/robots.txt"):
        st, final, headers, raw, err = get(host)
        robots[host] = {"status": st, "final_url": final, "body": raw.decode("utf-8", "replace"), "error": err, "headers": headers}
    old = [extract_page(u) for u in old_urls]
    mains = [extract_page(u) for u in main_urls]
    backlinks = Counter()
    for p in old:
        for link in p["internal_link_urls"]: backlinks[norm(link)] += 1
    inventory = []
    for p in old:
        proposed, match_type, evidence = candidate(p, mains)
        # Conservative default: neither redirects nor 410s are executable without truthful offering confirmation.
        disposition = "OWNER_CONFIRMATION_REQUIRED"
        inventory.append({
          **p, "backlinks_within_old_sitemap": backlinks[norm(p["source_url"])],
          "main_domain_equivalent": proposed, "match_type": match_type,
          "service_municipality_offering_evidence": evidence,
          "gsc_clicks": "NOT_ACCESSIBLE_NO_CREDENTIALS", "gsc_impressions": "NOT_ACCESSIBLE_NO_CREDENTIALS",
          "recommended_disposition": disposition,
          "proposed_destination": proposed,
          "confirmed_executable_redirect": "", 
          "decision_rationale": "Read-only crawl found no authenticated owner/GSC offering decision. Do not implement redirect or 410 until owner validates the offering and target; proposed destination is not executable configuration."
        })
    raw = {"generated_utc": datetime.now(timezone.utc).isoformat(), "audit_scope": "read-only", "old_sitemap": OLD_SITEMAP, "main_sitemap": MAIN_SITEMAP, "robots": robots, "old_sitemap_urls": old_urls, "main_sitemap_urls": main_urls, "old_pages": old, "main_pages": mains}
    (OUT / "raw-crawl-evidence.json").write_text(json.dumps(raw, indent=2, ensure_ascii=False), encoding="utf-8")
    (OUT / "redirect-inventory.json").write_text(json.dumps(inventory, indent=2, ensure_ascii=False), encoding="utf-8")
    fields = ["source_url", "direct_status", "status", "final_url", "canonical", "indexability", "x_robots_tag", "meta_robots", "title", "h1", "description", "word_count", "internal_link_count", "backlinks_within_old_sitemap", "main_domain_equivalent", "match_type", "service_municipality_offering_evidence", "gsc_clicks", "gsc_impressions", "recommended_disposition", "proposed_destination", "confirmed_executable_redirect", "decision_rationale", "error"]
    with (OUT / "redirect-inventory.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore"); w.writeheader(); w.writerows(inventory)
    counts = Counter(x["recommended_disposition"] for x in inventory)
    summary = f"""# SEO migration crawl and redirect-decision inventory

**Generated:** {raw['generated_utc']}  
**Scope:** Read-only crawl only. No redirects, deletes, deployment, provider spend, authentication, GSC access, or CMS changes were performed.

## Coverage

- Old sitemap: `{OLD_SITEMAP}`
- Current sitemap: `{MAIN_SITEMAP}`
- Old sitemap URLs discovered: **{len(old_urls)}**
- Old page records written: **{len(old)}**
- Current sitemap URLs discovered: **{len(main_urls)}**
- Old sitemap URLs represented in redirect inventory: **{len(inventory)}**
- Coverage assertion (`old URL set == inventory source URL set`): **{set(old_urls) == set(x['source_url'] for x in inventory)}**

## Decision safety

All **{len(inventory)}** URLs are classified `OWNER_CONFIRMATION_REQUIRED`. This is deliberate: crawl/sitemap evidence can identify a candidate current-domain URL but cannot truthfully establish that the business currently offers an old service × municipality combination, nor authorize an executable redirect. No page is marked `410_NOT_OFFERED_OR_NO_VALUE` solely because it lacks a candidate. `proposed_destination` is explicitly separate from `confirmed_executable_redirect` (blank for every record).

Available taxonomy values are: `301_TO_EXACT_EQUIVALENT`, `301_TO_CLOSEST_RELEVANT_PAGE`, `KEEP_TEMPORARILY_FOR_REBUILD`, `410_NOT_OFFERED_OR_NO_VALUE`, `OWNER_CONFIRMATION_REQUIRED`.

## Files

- `raw-crawl-evidence.json` — robots responses, sitemap URL lists, and raw page-level crawl evidence including headers/direct+final status/canonical/indexability/on-page fields/internal links.
- `redirect-inventory.csv` and `redirect-inventory.json` — one decision record per old sitemap URL.
- `../scripts/audit-seo-migration.py` — reproducible read-only crawl command.

## Metrics unavailable by design

GSC clicks/impressions and off-site backlink data were **not accessible**: no credentials or third-party SEO data source were used. `NOT_ACCESSIBLE_NO_CREDENTIALS` means unknown, not zero.

## Required owner validation before any routing implementation

For each row: validate current service × municipality offering, correct market/phone/price/base/excavation claims, whether an exact/current target is actually appropriate, and only then fill `confirmed_executable_redirect` and choose a non-default disposition. Avoid homepage catch-alls; priority is exact combo → service → location → service-area. Use 410 only with evidence that the offering is not available and no honest relevant page exists.
"""
    (OUT / "README.md").write_text(summary, encoding="utf-8")
    print(json.dumps({"old_urls": len(old_urls), "old_records": len(old), "main_urls": len(main_urls), "inventory": len(inventory), "coverage": set(old_urls) == set(x['source_url'] for x in inventory), "decisions": counts}, default=dict))
if __name__ == "__main__": main()
