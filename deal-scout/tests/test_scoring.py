from __future__ import annotations

import unittest

from deal_scout.models import Listing
from deal_scout.scoring import is_actionable, score_listing


ECON = {
    "local_fee_rate": 0.0,
    "gas_and_pickup_cad": 15,
    "hours_per_deal": 1.5,
    "hourly_opportunity_cad": 25,
    "min_net_profit_cad": 40,
    "min_roi": 0.35,
    "min_ask_cad": 20,
    "max_ask_cad": 2500,
}


class ScoringTests(unittest.TestCase):
    def test_fat_spread_is_grade_a(self) -> None:
        listing = Listing(
            source="manual",
            title="Dewalt kit",
            price=75,
            url="https://example.local/a",
            typical_resale=220,
        )
        deal = score_listing(listing, ECON)
        self.assertEqual(deal.grade, "A")
        self.assertTrue(is_actionable(deal))
        self.assertGreater(deal.net_profit, 40)

    def test_no_spread_is_fail(self) -> None:
        listing = Listing(
            source="kijiji",
            title="Broken mower",
            price=400,
            url="https://example.local/b",
            typical_resale=410,
        )
        deal = score_listing(listing, ECON)
        self.assertEqual(deal.grade, "F")
        self.assertFalse(is_actionable(deal))

    def test_unknown_comp_is_conservative(self) -> None:
        listing = Listing(
            source="craigslist",
            title="Mystery item",
            price=100,
            url="https://example.local/c",
        )
        deal = score_listing(listing, ECON)
        self.assertEqual(deal.resale_estimate, 115.0)
        self.assertIn("no sold-comp", " ".join(deal.reasons))
        self.assertEqual(deal.grade, "F")


if __name__ == "__main__":
    unittest.main()
