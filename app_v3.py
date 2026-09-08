"""VIKTOR RUNNER v3 frontend bundle over the existing leaderboard/API backend."""
from __future__ import annotations

import gzip
import hashlib
from pathlib import Path

import app as legacy

ROOT = Path(__file__).resolve().parent
PARTS = tuple(sorted((ROOT / "public" / "v3").glob("game.js.gz.part*")))
if len(PARTS) != 4:
    raise RuntimeError("Incomplete VIKTOR RUNNER v3 bundle")

GAME_JS = gzip.decompress(b"".join(path.read_bytes() for path in PARTS))
if b"VIKTOR RUNNER 3.0" not in GAME_JS:
    raise RuntimeError("Invalid VIKTOR RUNNER v3 bundle")
GAME_ETAG = '"' + hashlib.sha256(GAME_JS).hexdigest()[:24] + '"'


def application(environ, start_response):
    path = environ.get("PATH_INFO", "/")
    method = environ.get("REQUEST_METHOD", "GET")
    if path == "/game.js" and method in ("GET", "HEAD"):
        if environ.get("HTTP_IF_NONE_MATCH") == GAME_ETAG:
            start_response("304 Not Modified", [
                ("ETag", GAME_ETAG),
                ("Cache-Control", "no-cache"),
                ("X-Content-Type-Options", "nosniff"),
            ])
            return [b""]
        headers = [
            ("Content-Type", "text/javascript; charset=utf-8"),
            ("Content-Length", str(len(GAME_JS))),
            ("ETag", GAME_ETAG),
            ("Cache-Control", "no-cache"),
            ("X-Content-Type-Options", "nosniff"),
            ("Referrer-Policy", "same-origin"),
        ]
        start_response("200 OK", headers)
        return [b"" if method == "HEAD" else GAME_JS]
    return legacy.application(environ, start_response)
