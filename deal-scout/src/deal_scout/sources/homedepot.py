from __future__ import annotations

import json
import re
from typing import Any

from ..http import fetch_text
from ..models import Listing

JSON_LD_RE = re.compile(
    r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
    re.I | re.S,
)
PRICE_RE = re.compile(r'"price"\s*:\s*"?([0-9]+(?:\.[0-9]+)?)')


def product_url(host: str, sku: str) -> str:
    host = host.replace("https://", "").replace("http://", "").strip("/")
    return f"https://{host}/product/{sku}"


def _walk_ld(node: Any, found: list[dict[str, Any]]) -> None:
    if isinstance(node, dict):
        types = node.get("@type")
        type_list = types if isinstance(types, list) else [types]
        if any(str(t).lower() == "product" for t in type_list if t):
            found.append(node)
        for value in node.values():
            _walk_ld(value, found)
    elif isinstance(node, list):
        for item in node:
            _walk_ld(item, found)


def parse_homedepot_product(html: str, sku: str, name: str, typical_resale: float | None) -> Listing | None:
    products: list[dict[str, Any]] = []
    for match in JSON_LD_RE.finditer(html):
        raw = match.group(1).strip()
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        _walk_ld(data, products)

    title = name
    price: float | None = None
    url = ""
    for product in products:
        title = str(product.get("name") or title)
        url = str(product.get("url") or url)
        offers = product.get("offers") or {}
        if isinstance(offers, list) and offers:
            offers = offers[0]
        if isinstance(offers, dict):
            raw_price = offers.get("price") or offers.get("lowPrice")
            try:
                if raw_price is not None:
                    price = float(raw_price)
            except (TypeError, ValueError):
                pass

    if price is None:
        hit = PRICE_RE.search(html)
        if hit:
            price = float(hit.group(1))
    if price is None:
        return None

    return Listing(
        source="homedepot",
        title=title or f"Home Depot {sku}",
        price=price,
        url=url or f"sku:{sku}",
        query=sku,
        typical_resale=typical_resale,
        notes="Watchlist SKU — retail price vs your typical local resale",
        extra={"sku": sku},
    )


def fetch_homedepot_sku(host: str, sku: str, name: str, typical_resale: float | None) -> Listing | None:
    html = fetch_text(product_url(host, sku))
    listing = parse_homedepot_product(html, sku, name, typical_resale)
    if listing and listing.url.startswith("sku:"):
        return Listing(
            source=listing.source,
            title=listing.title,
            price=listing.price,
            url=product_url(host, sku),
            query=listing.query,
            typical_resale=listing.typical_resale,
            notes=listing.notes,
            extra=listing.extra,
        )
    return listing
