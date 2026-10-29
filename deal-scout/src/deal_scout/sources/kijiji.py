from __future__ import annotations

from urllib.parse import quote

from ..http import fetch_text
from ..models import Listing
from .rss import parse_rss


def kijiji_rss_url(location_slug: str, location_id: str, query: str) -> str:
    slug = location_slug.strip("/").strip()
    loc = location_id.strip()
    q = quote(query)
    # Official Kijiji RSS search. Location id is the `l########` suffix from a search URL.
    return f"https://www.kijiji.ca/rss-srp-buy-sell/{slug}/{q}/k0l{loc}"


def fetch_kijiji(location_slug: str, location_id: str, query: str) -> list[Listing]:
    url = kijiji_rss_url(location_slug, location_id, query)
    xml_text = fetch_text(url)
    return parse_rss(xml_text, source="kijiji", query=query)
