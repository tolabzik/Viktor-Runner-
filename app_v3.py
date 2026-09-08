"""VIKTOR RUNNER 3.1 frontend bundle over the existing leaderboard/API backend."""
from __future__ import annotations

import base64
import gzip
import hashlib
from pathlib import Path

import app as legacy

ROOT = Path(__file__).resolve().parent
PARTS = tuple(sorted((ROOT / "public" / "v3").glob("game.js.gz.part*")))
if len(PARTS) != 4:
    raise RuntimeError("Incomplete VIKTOR RUNNER v3 bundle")

_SOURCE = gzip.decompress(b"".join(path.read_bytes() for path in PARTS))
if b"VIKTOR RUNNER 3.0" not in _SOURCE:
    raise RuntimeError("Invalid VIKTOR RUNNER v3 bundle")
for _token in (b"function generateChunk", b"function update(", b"function drawEnemy", b"boot();"):
    if _token not in _SOURCE:
        raise RuntimeError(f"V3 bundle is incompatible with support-boss patch: {_token!r}")

_BOSS_PATCH = (ROOT / "public" / "v3" / "support-boss.js").read_bytes()
if b"SUPPORT BOSS PATCH" not in _BOSS_PATCH:
    raise RuntimeError("Invalid support-boss patch")
_BOSS_IMAGE = base64.b64decode((ROOT / "public" / "assets" / "support-boss.b64.txt").read_text().strip(), validate=True)
if not (_BOSS_IMAGE.startswith(b"RIFF") and _BOSS_IMAGE[8:12] == b"WEBP"):
    raise RuntimeError("Invalid support-boss image")
_BOSS_ETAG = chr(34) + hashlib.sha256(_BOSS_IMAGE).hexdigest()[:24] + chr(34)

_boot = _SOURCE.rfind(b"boot();")
if _boot < 0:
    raise RuntimeError("Unable to locate VIKTOR RUNNER boot sequence")
GAME_JS = _SOURCE[:_boot] + b"\n" + _BOSS_PATCH + b"\n" + _SOURCE[_boot:]
GAME_ETAG = '"' + hashlib.sha256(GAME_JS).hexdigest()[:24] + '"'


def application(environ, start_response):
    path = environ.get("PATH_INFO", "/")
    method = environ.get("REQUEST_METHOD", "GET")
    if path == "/assets/support-boss.webp" and method in ("GET", "HEAD"):
        if environ.get("HTTP_IF_NONE_MATCH") == _BOSS_ETAG:
            start_response("304 Not Modified", [("ETag", _BOSS_ETAG), ("Cache-Control", "public, max-age=86400"), ("X-Content-Type-Options", "nosniff")])
            return [b""]
        headers = [("Content-Type", "image/webp"), ("Content-Length", str(len(_BOSS_IMAGE))), ("ETag", _BOSS_ETAG), ("Cache-Control", "public, max-age=86400"), ("X-Content-Type-Options", "nosniff")]
        start_response("200 OK", headers)
        return [b"" if method == "HEAD" else _BOSS_IMAGE]
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
