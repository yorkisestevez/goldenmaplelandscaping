from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from urllib.parse import quote_plus

from .http import fetch_json
from .models import Listing

BROWSE_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search"


def median(values: list[float]) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    mid = len(ordered) // 2
    if len(ordered) % 2:
        return ordered[mid]
    return (ordered[mid - 1] + ordered[mid]) / 2


def sold_comp_for(title: str, app_id: str, limit: int = 10) -> float | None:
    """eBay Browse API median price. Requires EBAY_APP_ID; does nothing without it."""
    if not app_id:
        return None
    q = quote_plus(title[:80])
    url = f"{BROWSE_URL}?q={q}&limit={limit}&filter=conditions:{{USED|NEW}}"
    try:
        payload: dict[str, Any] = fetch_json(url)
    except RuntimeError:
        return None
    prices: list[float] = []
    for item in payload.get("itemSummaries") or []:
        price = (item.get("price") or {}).get("value")
        try:
            if price is not None:
                prices.append(float(price))
        except (TypeError, ValueError):
            continue
    return median(prices)


def attach_ebay_comps(listings: list[Listing], app_id: str) -> list[Listing]:
    enriched: list[Listing] = []
    for listing in listings:
        if listing.typical_resale:
            enriched.append(listing)
            continue
        comp = sold_comp_for(listing.title, app_id)
        if not comp:
            enriched.append(listing)
            continue
        enriched.append(
            Listing(
                source=listing.source,
                title=listing.title,
                price=listing.price,
                url=listing.url,
                query=listing.query,
                typical_resale=comp,
                notes=listing.notes,
                extra={**listing.extra, "ebay_comp": comp},
            )
        )
    return enriched


def write_empty_token_hint(path: Path) -> None:
    path.write_text(
        json.dumps({"error": "Set EBAY_APP_ID to enable Browse API comps"}, indent=2),
        encoding="utf-8",
    )
