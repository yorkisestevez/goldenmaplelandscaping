from __future__ import annotations

import json
import os
import urllib.request
from pathlib import Path

from .config import load_config
from .ebay_comps import attach_ebay_comps
from .models import Listing, ScoredDeal
from .report import save_report
from .scoring import is_actionable, score_listing
from .sources.craigslist import fetch_craigslist
from .sources.homedepot import fetch_homedepot_sku
from .sources.kijiji import fetch_kijiji
from .sources.manual import load_manual_listings


def collect_listings(config: dict, inbox_dir: Path, errors: list[str]) -> list[Listing]:
    listings: list[Listing] = []
    loc = config["location"]
    queries = [str(q) for q in (config.get("search_queries") or []) if str(q).strip()]
    sources = config.get("sources") or {}

    if sources.get("craigslist"):
        for query in queries:
            try:
                listings.extend(fetch_craigslist(loc["city"], query))
            except RuntimeError as exc:
                errors.append(str(exc))

    if sources.get("kijiji"):
        for query in queries:
            try:
                listings.extend(
                    fetch_kijiji(loc["kijiji_location_slug"], loc["kijiji_location_id"], query)
                )
            except RuntimeError as exc:
                errors.append(str(exc))

    if sources.get("homedepot_watchlist"):
        host = loc.get("homedepot_host") or "www.homedepot.ca"
        for row in config.get("homedepot_watchlist") or []:
            if not isinstance(row, dict):
                continue
            sku = str(row.get("sku") or "").strip()
            if not sku:
                continue
            name = str(row.get("name") or sku)
            resale = row.get("typical_resale_cad", row.get("typical_resale"))
            try:
                typical = float(resale) if resale is not None else None
            except (TypeError, ValueError):
                typical = None
            try:
                item = fetch_homedepot_sku(host, sku, name, typical)
            except RuntimeError as exc:
                errors.append(str(exc))
                continue
            if item:
                listings.append(item)
            else:
                errors.append(f"Home Depot SKU {sku}: no public price found")

    listings.extend(load_manual_listings(config, inbox_dir))

    if sources.get("ebay_comps"):
        app_id = os.environ.get("EBAY_APP_ID", "")
        listings = attach_ebay_comps(listings, app_id)

    return _dedupe(listings)


def _dedupe(listings: list[Listing]) -> list[Listing]:
    seen: set[str] = set()
    unique: list[Listing] = []
    for listing in listings:
        key = listing.key()
        if key in seen:
            continue
        seen.add(key)
        unique.append(listing)
    return unique


def score_all(listings: list[Listing], economics: dict) -> list[ScoredDeal]:
    deals = [score_listing(item, economics) for item in listings]
    deals.sort(key=lambda d: (d.grade, d.net_profit), reverse=True)
    grade_rank = {"A": 3, "B": 2, "C": 1, "F": 0}
    deals.sort(key=lambda d: (grade_rank.get(d.grade, 0), d.net_profit), reverse=True)
    return deals


def maybe_webhook(url: str, deals: list[ScoredDeal]) -> None:
    if not url:
        return
    actionable = [d.to_dict() for d in deals if is_actionable(d)]
    if not actionable:
        return
    body = json.dumps({"text": f"{len(actionable)} actionable local deals", "deals": actionable}).encode()
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15):
        pass


def run_scan(config_path: Path, root: Path) -> dict:
    config = load_config(config_path)
    errors: list[str] = []
    inbox = root / "inbox"
    listings = collect_listings(config, inbox, errors)
    deals = score_all(listings, config["economics"])
    actionable = [d for d in deals if is_actionable(d)]
    report_path = save_report(deals, root / "out")
    try:
        maybe_webhook(str(config.get("alert_webhook") or ""), actionable)
    except Exception as exc:  # noqa: BLE001 — alert failure should not kill the scan
        errors.append(f"webhook: {exc}")
    return {
        "listings": len(listings),
        "deals": len(deals),
        "actionable": len(actionable),
        "report": str(report_path),
        "html": str(root / "out" / "latest.html"),
        "errors": errors,
        "top": [d.to_dict() for d in actionable[:10]],
    }
