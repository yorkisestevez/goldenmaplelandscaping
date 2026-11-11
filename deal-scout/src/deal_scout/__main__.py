from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .agent import run_scan
from .config import load_config


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Scan allowed local listing feeds and score resale deals. Does not scrape Facebook."
    )
    parser.add_argument(
        "--config",
        default="config.json",
        help="Path to config.json (copy from config.example.json)",
    )
    parser.add_argument(
        "--root",
        default=".",
        help="Deal-scout root (inbox/ and out/ live here)",
    )
    args = parser.parse_args(argv)
    root = Path(args.root).resolve()
    config_path = Path(args.config)
    if not config_path.is_file():
        example = root / "config.example.json"
        if example.is_file():
            print(
                f"Missing {config_path}. Copy config.example.json to config.json and edit location/SKUs.",
                file=sys.stderr,
            )
        else:
            print(f"Missing {config_path}", file=sys.stderr)
        return 2
    load_config(config_path)  # fail fast on bad JSON
    result = run_scan(config_path, root)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
