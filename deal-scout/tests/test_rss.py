from __future__ import annotations

import unittest

from deal_scout.sources.craigslist import craigslist_rss_url
from deal_scout.sources.kijiji import kijiji_rss_url
from deal_scout.sources.rss import parse_price, parse_rss


RSS = """<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <title>DeWalt drill - $80</title>
      <link>https://example.local/cl/1</link>
      <description>Works great</description>
    </item>
    <item>
      <title>Free junk</title>
      <link>https://example.local/cl/2</link>
      <description>no price here</description>
    </item>
  </channel>
</rss>
"""


class RssTests(unittest.TestCase):
    def test_parse_rss_keeps_priced_items_only(self) -> None:
        listings = parse_rss(RSS, source="craigslist", query="dewalt")
        self.assertEqual(len(listings), 1)
        self.assertEqual(listings[0].price, 80.0)
        self.assertEqual(listings[0].url, "https://example.local/cl/1")

    def test_parse_price_cad(self) -> None:
        self.assertEqual(parse_price("C$1,299.00 OBO"), 1299.0)

    def test_feed_urls(self) -> None:
        cl = craigslist_rss_url("Barrie", "pressure washer")
        self.assertIn("barrie.craigslist.org", cl)
        self.assertIn("format=rss", cl)
        kj = kijiji_rss_url("barrie", "1700078", "dewalt")
        self.assertEqual(
            kj,
            "https://www.kijiji.ca/rss-srp-buy-sell/barrie/dewalt/k0l1700078",
        )


if __name__ == "__main__":
    unittest.main()
