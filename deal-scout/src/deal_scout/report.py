from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from .models import ScoredDeal


def save_report(deals: list[ScoredDeal], out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = out_dir / f"deals-{stamp}.json"
    payload = {
        "generated_at": stamp,
        "count": len(deals),
        "deals": [deal.to_dict() for deal in deals],
    }
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    latest = out_dir / "latest.json"
    latest.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    html = out_dir / "latest.html"
    html.write_text(render_html(deals, stamp), encoding="utf-8")
    return path


def render_html(deals: list[ScoredDeal], stamp: str) -> str:
    rows = []
    for deal in deals:
        listing = deal.listing
        rows.append(
            "<tr>"
            f"<td>{deal.grade}</td>"
            f"<td>{_esc(listing.source)}</td>"
            f"<td><a href=\"{_esc(listing.url)}\">{_esc(listing.title)}</a></td>"
            f"<td>{listing.price:.2f}</td>"
            f"<td>{deal.resale_estimate:.2f}</td>"
            f"<td>{deal.net_profit:.2f}</td>"
            f"<td>{deal.roi * 100:.0f}%</td>"
            f"<td>{_esc('; '.join(deal.reasons))}</td>"
            "</tr>"
        )
    body = "\n".join(rows) or "<tr><td colspan=8>No deals this scan.</td></tr>"
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Deal scout {stamp}</title>
<style>
body {{ font-family: system-ui, sans-serif; margin: 24px; background: #0f1410; color: #e8efe6; }}
table {{ border-collapse: collapse; width: 100%; }}
th, td {{ border-bottom: 1px solid #2a3a2e; padding: 8px 10px; text-align: left; font-size: 14px; }}
a {{ color: #8fd19e; }}
.grade-A {{ background: #14351c; }}
</style></head>
<body>
<h1>Local deal scout</h1>
<p>Generated {stamp}. Grades A/B are actionable after gas, time, and fees. Facebook listings only appear if you pasted them.</p>
<table>
<thead><tr><th>Grade</th><th>Source</th><th>Title</th><th>Ask</th><th>Resale</th><th>Net</th><th>ROI</th><th>Why</th></tr></thead>
<tbody>
{body}
</tbody></table>
</body></html>
"""


def _esc(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )
