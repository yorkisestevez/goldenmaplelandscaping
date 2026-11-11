from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from deal_scout.agent import run_scan
from deal_scout.sources.homedepot import parse_homedepot_product
from deal_scout.sources.manual import load_manual_listings


HD_HTML = """
<html><head>
<script type="application/ld+json">
{"@type":"Product","name":"Test Blower","url":"https://www.homedepot.ca/product/1001",
 "offers":{"@type":"Offer","price":"49.00","priceCurrency":"CAD"}}
</script>
</head></html>
"""


class ManualAndHdTests(unittest.TestCase):
    def test_inbox_and_config_manual_rows(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            inbox = Path(tmp)
            (inbox / "one.json").write_text(
                json.dumps(
                    {
                        "title": "Pasted FB item",
                        "price": 50,
                        "url": "https://example.local/fb",
                        "typical_resale_cad": 120,
                    }
                ),
                encoding="utf-8",
            )
            listings = load_manual_listings(
                {
                    "manual_listings": [
                        {"title": "Config row", "price": 30, "typical_resale_cad": 90}
                    ]
                },
                inbox,
            )
            titles = {item.title for item in listings}
            self.assertEqual(titles, {"Pasted FB item", "Config row"})

    def test_homedepot_json_ld(self) -> None:
        listing = parse_homedepot_product(HD_HTML, "1001", "fallback", 80.0)
        assert listing is not None
        self.assertEqual(listing.price, 49.0)
        self.assertEqual(listing.typical_resale, 80.0)
        self.assertEqual(listing.title, "Test Blower")

    def test_scan_with_inbox_only(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "inbox").mkdir()
            (root / "inbox" / "hit.json").write_text(
                json.dumps(
                    {
                        "title": "Milwaukee impact",
                        "price": 70,
                        "url": "https://example.local/m18",
                        "typical_resale_cad": 200,
                    }
                ),
                encoding="utf-8",
            )
            config = {
                "sources": {
                    "craigslist": False,
                    "kijiji": False,
                    "homedepot_watchlist": False,
                    "ebay_comps": False,
                },
                "search_queries": [],
                "homedepot_watchlist": [],
                "manual_listings": [],
            }
            cfg = root / "config.json"
            cfg.write_text(json.dumps(config), encoding="utf-8")
            result = run_scan(cfg, root)
            self.assertEqual(result["listings"], 1)
            self.assertEqual(result["actionable"], 1)
            self.assertTrue((root / "out" / "latest.html").is_file())


if __name__ == "__main__":
    unittest.main()
