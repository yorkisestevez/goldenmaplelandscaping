from __future__ import annotations

import json
from pathlib import Path

from ..models import Listing


def listing_from_dict(row: dict, source: str = "manual") -> Listing | None:
    title = str(row.get("title") or "").strip()
    url = str(row.get("url") or "").strip()
    try:
        price = float(row.get("price"))
    except (TypeError, ValueError):
        return None
    if not title or price <= 0:
        return None
    resale = row.get("typical_resale_cad", row.get("typical_resale"))
    try:
        typical = float(resale) if resale is not None else None
    except (TypeError, ValueError):
        typical = None
    return Listing(
        source=source,
        title=title,
        price=price,
        url=url or f"manual:{title}",
        query=str(row.get("query") or "manual"),
        typical_resale=typical,
        notes=str(row.get("notes") or "Pasted by you — not scraped"),
    )


def load_manual_listings(config: dict, inbox_dir: Path | None = None) -> list[Listing]:
    listings: list[Listing] = []
    for row in config.get("manual_listings") or []:
        if isinstance(row, dict):
            item = listing_from_dict(row)
            if item:
                listings.append(item)

    if inbox_dir and inbox_dir.is_dir():
        for path in sorted(inbox_dir.glob("*.json")):
            try:
                payload = json.loads(path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                continue
            rows = payload if isinstance(payload, list) else [payload]
            for row in rows:
                if isinstance(row, dict):
                    item = listing_from_dict(row, source="manual-inbox")
                    if item:
                        listings.append(item)
    return listings
