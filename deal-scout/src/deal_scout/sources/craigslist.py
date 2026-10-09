from __future__ import annotations

from urllib.parse import quote_plus

from ..http import fetch_text
from ..models import Listing
from .rss import parse_rss


def craigslist_rss_url(city: str, query: str) -> str:
    city = city.strip().lower().replace(" ", "")
    q = quote_plus(query)
    return f"https://{city}.craigslist.org/search/sss?format=rss&query={q}"


def fetch_craigslist(city: str, query: str) -> list[Listing]:
    url = craigslist_rss_url(city, query)
    xml_text = fetch_text(url)
    return parse_rss(xml_text, source="craigslist", query=query)
