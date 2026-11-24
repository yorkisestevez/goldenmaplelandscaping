from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from html import unescape

from ..models import Listing

PRICE_RE = re.compile(
    r"(?:CAD|C\$|\$|USD)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)",
    re.I,
)


def parse_price(*chunks: str) -> float | None:
    for chunk in chunks:
        if not chunk:
            continue
        text = unescape(chunk).replace("\xa0", " ")
        match = PRICE_RE.search(text)
        if not match:
            continue
        try:
            return float(match.group(1).replace(",", ""))
        except ValueError:
            continue
    return None


def _local(tag: str) -> str:
    if "}" in tag:
        return tag.rsplit("}", 1)[-1]
    return tag


def parse_rss(xml_text: str, source: str, query: str) -> list[Listing]:
    listings: list[Listing] = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return listings

    items = list(root.iter())
    for node in items:
        if _local(node.tag).lower() != "item":
            continue
        title = ""
        link = ""
        desc = ""
        for child in list(node):
            name = _local(child.tag).lower()
            text = (child.text or "").strip()
            if name == "title":
                title = unescape(text)
            elif name in {"link", "guid"}:
                if text.startswith("http"):
                    link = text
            elif name in {"description", "summary"}:
                desc = unescape(re.sub(r"<[^>]+>", " ", text))
        if not title or not link:
            continue
        price = parse_price(title, desc)
        if price is None:
            continue
        listings.append(
            Listing(
                source=source,
                title=title.strip(),
                price=price,
                url=link.strip(),
                query=query,
                notes=desc[:280],
            )
        )
    return listings
