from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass(frozen=True)
class Listing:
    source: str
    title: str
    price: float
    url: str
    query: str = ""
    typical_resale: float | None = None
    notes: str = ""
    extra: dict[str, Any] = field(default_factory=dict)

    def key(self) -> str:
        return f"{self.source}|{self.url}|{self.price:.2f}"


@dataclass(frozen=True)
class ScoredDeal:
    listing: Listing
    resale_estimate: float
    fees: float
    pickup_cost: float
    time_cost: float
    net_profit: float
    roi: float
    grade: str
    reasons: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["listing"] = asdict(self.listing)
        payload["reasons"] = list(self.reasons)
        return payload
