from __future__ import annotations

import json
import ssl
import time
import urllib.error
import urllib.request
from typing import Any

USER_AGENT = "LocalDealScout/0.1 (+personal research; contact via repo README)"
MIN_INTERVAL_SEC = 2.0

_last_fetch_at = 0.0


def fetch_text(url: str, timeout: int = 25) -> str:
    global _last_fetch_at
    wait = MIN_INTERVAL_SEC - (time.monotonic() - _last_fetch_at)
    if wait > 0:
        time.sleep(wait)
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/rss+xml, application/xml, text/xml, application/json, text/html;q=0.8",
        },
        method="GET",
    )
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            raw = resp.read()
            charset = resp.headers.get_content_charset() or "utf-8"
            _last_fetch_at = time.monotonic()
            return raw.decode(charset, errors="replace")
    except urllib.error.HTTPError as exc:
        _last_fetch_at = time.monotonic()
        raise RuntimeError(f"HTTP {exc.code} for {url}") from exc
    except urllib.error.URLError as exc:
        _last_fetch_at = time.monotonic()
        raise RuntimeError(f"network error for {url}: {exc.reason}") from exc


def fetch_json(url: str, timeout: int = 25) -> Any:
    text = fetch_text(url, timeout=timeout)
    return json.loads(text)
