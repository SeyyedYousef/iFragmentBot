#!/usr/bin/env python3
"""
Bridge script that fetches Fragment username pages using Scrapling.
Outputs a JSON payload so the Node.js bot can consume dynamic HTML.
"""

from __future__ import annotations

import argparse
import json
import sys
import traceback


def emit_json(payload: dict, exit_code: int = 0) -> None:
    """Helper to serialize payloads consistently."""
    sys.stdout.write(json.dumps(payload))
    sys.exit(exit_code)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Fetch https://fragment.com pages with Scrapling.",
    )
    parser.add_argument("item", help="Fragment item (username or number), leading @ is optional.")
    parser.add_argument(
        "--type",
        choices=["username", "number"],
        default="username",
        help="Type of item to fetch",
    )
    parser.add_argument(
        "--proxy",
        help="Optional proxy string supported by Scrapling (e.g. socks5://user:pass@host:port).",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=45000,
        help="Timeout for Scrapling (milliseconds). Defaults to 45 seconds.",
    )
    parser.add_argument(
        "--headful",
        action="store_true",
        help="Run the Chrome instance in headful mode for debugging.",
    )
    args = parser.parse_args()

    item = (args.item or "").strip().lstrip("@").lower()
    if not item:
        emit_json({"error": "Item is required."}, exit_code=1)

    try:
        from scrapling.fetchers import StealthyFetcher
    except Exception as exc:  # pragma: no cover - surfaced via stdout
        emit_json(
            {
                "error": "Scrapling is not available.",
                "details": str(exc),
            },
            exit_code=2,
        )

    url = f"https://fragment.com/{args.type}/{item}"
    options = {
        "headless": not args.headful,
        "network_idle": True,
        "disable_resources": True,
        "timeout": args.timeout,
        "wait_selector": ".tm-section-header-status",
        "wait_selector_state": "attached",
        "solve_cloudflare": True,
        "google_search": False,
    }

    if args.proxy:
        options["proxy"] = args.proxy

    try:
        response = StealthyFetcher.fetch(url, **options)
        encoding = response.encoding or "utf-8"
        html = response.body.decode(encoding, errors="ignore")
        emit_json(
            {
                "url": url,
                "status": response.status,
                "reason": response.reason,
                "html": html,
                "headers": response.headers,
                "request_headers": response.request_headers,
                "meta": response.meta,
            }
        )
    except Exception as exc:  # pragma: no cover - surfaced to JS
        emit_json(
            {
                "error": "Scrapling fetch failed.",
                "details": str(exc),
                "trace": traceback.format_exc(limit=3),
            },
            exit_code=3,
        )


if __name__ == "__main__":
    main()
