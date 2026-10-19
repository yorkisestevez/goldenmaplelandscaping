from __future__ import annotations

from .models import Listing, ScoredDeal


def estimate_resale(listing: Listing, fallback: float | None = None) -> float:
    if listing.typical_resale and listing.typical_resale > 0:
        return float(listing.typical_resale)
    if fallback and fallback > 0:
        return float(fallback)
    # Conservative default: assume you can only get 70% of a "too cheap" ask * 1.8
    # if we have no comps. This keeps unknown items from looking like free money.
    return max(listing.price * 1.15, listing.price + 10)


def score_listing(listing: Listing, economics: dict, resale_override: float | None = None) -> ScoredDeal:
    ask = float(listing.price)
    resale = estimate_resale(listing, resale_override)
    fee_rate = float(economics.get("local_fee_rate") or 0)
    fees = resale * fee_rate
    pickup = float(economics.get("gas_and_pickup_cad") or 0)
    time_cost = float(economics.get("hours_per_deal") or 0) * float(
        economics.get("hourly_opportunity_cad") or 0
    )
    total_cost = ask + fees + pickup + time_cost
    net = resale - total_cost
    roi = (net / ask) if ask else 0.0

    min_profit = float(economics.get("min_net_profit_cad") or 0)
    min_roi = float(economics.get("min_roi") or 0)
    min_ask = float(economics.get("min_ask_cad") or 0)
    max_ask = float(economics.get("max_ask_cad") or 10**9)

    reasons: list[str] = []
    if ask < min_ask:
        reasons.append("ask below min — often junk or shipping-only")
    if ask > max_ask:
        reasons.append("ask above max — capital / risk too high")
    if listing.typical_resale is None and resale_override is None:
        reasons.append("no sold-comp — resale is a conservative guess")
    if net >= min_profit * 2 and roi >= min_roi * 1.5:
        grade = "A"
        reasons.append("fat spread after gas, time, and fees")
    elif net >= min_profit and roi >= min_roi:
        grade = "B"
        reasons.append("clears profit and ROI floors")
    elif net >= min_profit * 0.5:
        grade = "C"
        reasons.append("marginal — only if pickup is already on your route")
    else:
        grade = "F"
        reasons.append("does not clear costs")

    return ScoredDeal(
        listing=listing,
        resale_estimate=round(resale, 2),
        fees=round(fees, 2),
        pickup_cost=round(pickup, 2),
        time_cost=round(time_cost, 2),
        net_profit=round(net, 2),
        roi=round(roi, 4),
        grade=grade,
        reasons=tuple(reasons),
    )


def is_actionable(deal: ScoredDeal) -> bool:
    return deal.grade in {"A", "B"}
