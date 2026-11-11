from __future__ import annotations

import json
from pathlib import Path
from typing import Any


DEFAULTS: dict[str, Any] = {
    "location": {
        "city": "barrie",
        "region_label": "Barrie / Simcoe County",
        "kijiji_location_id": "1700078",
        "kijiji_location_slug": "barrie",
        "homedepot_host": "www.homedepot.ca",
        "currency": "CAD",
    },
    "economics": {
        "local_fee_rate": 0.0,
        "ebay_fee_rate": 0.1325,
        "gas_and_pickup_cad": 15.0,
        "hours_per_deal": 1.5,
        "hourly_opportunity_cad": 25.0,
        "min_net_profit_cad": 40.0,
        "min_roi": 0.35,
        "min_ask_cad": 20.0,
        "max_ask_cad": 2500.0,
    },
    "sources": {
        "craigslist": True,
        "kijiji": True,
        "homedepot_watchlist": True,
        "ebay_comps": False,
    },
    "search_queries": ["dewalt", "generator", "snowblower"],
    "homedepot_watchlist": [],
    "manual_listings": [],
    "alert_webhook": "",
}


def _deep_merge(base: dict[str, Any], overlay: dict[str, Any]) -> dict[str, Any]:
    out = dict(base)
    for key, value in overlay.items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = _deep_merge(out[key], value)
        else:
            out[key] = value
    return out


def load_config(path: str | Path | None) -> dict[str, Any]:
    cfg = json.loads(json.dumps(DEFAULTS))
    if path is None:
        return cfg
    raw = Path(path).read_text(encoding="utf-8")
    overlay = json.loads(raw)
    if not isinstance(overlay, dict):
        raise ValueError("config must be a JSON object")
    return _deep_merge(cfg, overlay)
