"""Stream a consistent SQLite database + session key backup to stdout.

Usage: docker compose exec -T game python tools/backup.py > backup.tar.gz
"""
import os
import sqlite3
import sys
import tarfile
import tempfile
from pathlib import Path

data = Path(os.getenv('DATA_DIR', '/data'))
if not (data / 'leaderboard.sqlite3').is_file() or not (data / '.session-key').is_file():
    raise SystemExit('Database/session key not found. Start the game first.')
with tempfile.TemporaryDirectory() as directory:
    snapshot = Path(directory) / 'leaderboard.sqlite3'
    source = sqlite3.connect(f'file:{data / "leaderboard.sqlite3"}?mode=ro', uri=True)
    target = sqlite3.connect(snapshot)
    try:
        source.backup(target)
    finally:
        target.close()
        source.close()
    with tarfile.open(fileobj=sys.stdout.buffer, mode='w|gz') as archive:
        archive.add(snapshot, arcname='leaderboard.sqlite3')
        archive.add(data / '.session-key', arcname='.session-key')
