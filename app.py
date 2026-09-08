"""VIKTOR RUNNER: small WSGI API, SQLite records and same-origin static files.

Production: gunicorn app:application --workers 1 --threads 8
Local development only: python app.py
No external service, registration, analytics or uploaded photos are required.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import mimetypes
import os
import re
import secrets
import sqlite3
import threading
import time
import unicodedata
from collections import defaultdict, deque
from contextlib import contextmanager
from http import HTTPStatus
from http.cookies import SimpleCookie
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parent
MAX_BODY = 4096
MAX_RUN_AGE = 24 * 3600
SCORE_VERSION = 2
COOKIE = 'viktor_player'
ORDER = 'score DESC, distance DESC, elapsed_ms ASC, submitted_at ASC, id ASC'
FIELDS = ('distance', 'coins', 'kills', 'sidejobs', 'bonuses', 'elapsed_ms')


class APIError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


def score_for(stats: dict) -> int:
    return (stats['distance'] + 25 * stats['coins'] + 100 * stats['kills']
            + 500 * stats['sidejobs'] + 1000 * stats['bonuses'])


def clean_name(value: object) -> str:
    if not isinstance(value, str):
        raise APIError(400, 'Введите ник от 2 до 24 символов.')
    name = unicodedata.normalize('NFKC', value).strip()
    if not 2 <= len(name) <= 24 or any(
        not (unicodedata.category(c)[0] in 'LMN' or c in ' _.-') for c in name
    ):
        raise APIError(400, 'Ник: 2–24 символа, буквы, цифры, пробел, _, . или -.')
    return name


class RunnerApp:
    def __init__(self, data_dir: str | Path | None = None, *, testing=False):
        self.data = Path(data_dir or os.getenv('DATA_DIR', str(ROOT / 'data')))
        self.data.mkdir(parents=True, exist_ok=True)
        self.db_path = self.data / 'leaderboard.sqlite3'
        self.static = ROOT / 'public'
        self.testing = testing
        self.secure_cookie = os.getenv('COOKIE_SECURE', '0') == '1'
        self.public_origin = os.getenv('APP_ORIGIN', '').rstrip('/')
        self._lock = threading.Lock()
        self._limits: dict[tuple, deque] = defaultdict(deque)
        self._last_cleanup = 0.0
        # The key lives beside the database, never in the repository or image.
        key_file = self.data / '.session-key'
        try:
            fd = os.open(key_file, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        except FileExistsError:
            pass
        else:
            with os.fdopen(fd, 'wb') as handle:
                handle.write(secrets.token_bytes(32))
        self.key = key_file.read_bytes()
        if len(self.key) != 32:
            raise RuntimeError('Invalid session key in DATA_DIR; restore it from backup.')
        with self.connect() as db:
            db.execute('PRAGMA journal_mode=WAL')
            db.executescript('''
                CREATE TABLE IF NOT EXISTS players (
                    id TEXT PRIMARY KEY, name TEXT NOT NULL,
                    created_at REAL NOT NULL, last_seen REAL NOT NULL
                );
                CREATE TABLE IF NOT EXISTS runs (
                    id TEXT PRIMARY KEY, player_id TEXT NOT NULL REFERENCES players(id),
                    seed INTEGER NOT NULL, started_at REAL NOT NULL,
                    submitted_at REAL, elapsed_ms INTEGER, distance INTEGER,
                    coins INTEGER, kills INTEGER, sidejobs INTEGER, bonuses INTEGER,
                    score INTEGER, payload_hash TEXT, score_version INTEGER NOT NULL DEFAULT 2
                );
                CREATE INDEX IF NOT EXISTS runs_rank ON runs(score DESC, distance DESC);
                CREATE INDEX IF NOT EXISTS runs_player ON runs(player_id, submitted_at);
                CREATE INDEX IF NOT EXISTS runs_time ON runs(submitted_at);
            ''')

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.db_path, timeout=10)
        db.row_factory = sqlite3.Row
        db.execute('PRAGMA foreign_keys=ON')
        db.execute('PRAGMA busy_timeout=10000')
        try:
            with db:
                yield db
        finally:
            db.close()

    def digest(self, text: str) -> str:
        return hmac.new(self.key, text.encode('ascii'), hashlib.sha256).hexdigest()

    def identity(self, environ: dict) -> tuple[str, str | None]:
        cookie = SimpleCookie()
        try:
            cookie.load(environ.get('HTTP_COOKIE', ''))
            raw = cookie[COOKIE].value if COOKIE in cookie else ''
        except Exception:
            raw = ''
        parts = raw.split('.')
        if (len(parts) == 2 and re.fullmatch(r'[a-f0-9]{32}', parts[0])
                and re.fullmatch(r'[a-f0-9]{64}', parts[1])
                and hmac.compare_digest(parts[1], self.digest(parts[0]))):
            return parts[0], None
        pid = secrets.token_hex(16)
        return pid, (f'{COOKIE}={pid}.{self.digest(pid)}; Path=/; Max-Age=31536000; '
                     f'HttpOnly; SameSite=Lax' + ('; Secure' if self.secure_cookie else ''))

    def limit(self, environ: dict, bucket: str, count: int, period=60):
        if self.testing:
            return
        # Do not trust user-supplied X-Forwarded-For. Behind a proxy this is an
        # aggregate limit; the proxy should additionally enforce per-client limits.
        key = (environ.get('REMOTE_ADDR', 'local'), bucket)
        now = time.monotonic()
        with self._lock:
            if now - self._last_cleanup > 60:
                self._limits = defaultdict(deque, {
                    k: v for k, v in self._limits.items() if v and v[-1] > now - 60
                })
                self._last_cleanup = now
            q = self._limits[key]
            while q and q[0] <= now - period:
                q.popleft()
            if len(q) >= count:
                raise APIError(429, 'Слишком много запросов. Подождите минуту.')
            q.append(now)

    def read_json(self, environ: dict, pid: str, new_cookie: str | None) -> dict:
        token = environ.get('HTTP_X_CSRF_TOKEN', '')
        if new_cookie or not re.fullmatch(r'[a-f0-9]{64}', token) or not hmac.compare_digest(
            token, self.digest('csrf:' + pid)
        ):
            raise APIError(403, 'Сессия истекла. Обновите страницу.')
        if environ.get('HTTP_SEC_FETCH_SITE') == 'cross-site':
            raise APIError(403, 'Запрос должен исходить со страницы игры.')
        origin = environ.get('HTTP_ORIGIN')
        if origin:
            try:
                source = urlsplit(origin)
                expected = (urlsplit(self.public_origin).netloc if self.public_origin
                            else environ.get('HTTP_HOST', ''))
                if (source.scheme not in ('http', 'https') or source.netloc != expected
                        or (self.public_origin and origin.rstrip('/') != self.public_origin)):
                    raise APIError(403, 'Недопустимый источник запроса.')
            except ValueError as exc:
                raise APIError(403, 'Недопустимый источник запроса.') from exc
        if environ.get('CONTENT_TYPE', '').split(';')[0].strip() != 'application/json':
            raise APIError(415, 'Ожидается application/json.')
        try:
            length = int(environ.get('CONTENT_LENGTH') or 0)
        except ValueError as exc:
            raise APIError(400, 'Некорректная длина запроса.') from exc
        if length <= 0 or length > MAX_BODY:
            raise APIError(413, 'Запрос слишком большой или пустой.')
        try:
            body = json.loads(environ['wsgi.input'].read(length))
        except (ValueError, UnicodeDecodeError) as exc:
            raise APIError(400, 'Некорректный JSON.') from exc
        if not isinstance(body, dict):
            raise APIError(400, 'Ожидается JSON-объект.')
        return body

    def board(self, pid: str, period: str, limit: int) -> dict:
        now = time.time()
        cutoff = {'all': 0, 'week': now - 7 * 86400, 'day': now - 86400}[period]
        # One best run per cookie identity, including ties and a rank outside top 50.
        query = f'''
            WITH per_player AS (
                SELECT *, ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY {ORDER}) AS personal
                FROM runs WHERE submitted_at >= ? AND score_version = ?
            ), ranked AS (
                SELECT *, ROW_NUMBER() OVER (ORDER BY {ORDER}) AS rank
                FROM per_player WHERE personal = 1
            )
            SELECT ranked.*, players.name FROM ranked
            JOIN players ON players.id = ranked.player_id
            WHERE rank <= ? OR player_id = ? ORDER BY rank
        '''
        with self.connect() as db:
            rows = db.execute(query, (cutoff, SCORE_VERSION, limit, pid)).fetchall()
            total = db.execute('''SELECT COUNT(DISTINCT player_id) FROM runs
                WHERE submitted_at >= ? AND score_version = ?''', (cutoff, SCORE_VERSION)).fetchone()[0]
        entries, me = [], None
        for r in rows:
            item = {k: r[k] for k in ('rank', 'name', 'score', 'distance', 'coins', 'kills',
                                     'sidejobs', 'bonuses', 'elapsed_ms', 'submitted_at')}
            item['mine'] = r['player_id'] == pid
            if item['mine']:
                me = item
            if item['rank'] <= limit:
                entries.append(item)
        return {'entries': entries, 'me': me, 'players': total, 'period': period,
                'score_version': SCORE_VERSION, 'server_time': now}

    def start_run(self, pid: str, body: dict) -> dict:
        name = clean_name(body.get('name'))
        now = time.time()
        rid, seed = secrets.token_hex(16), secrets.randbelow(2 ** 32 - 1) + 1
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            db.execute('DELETE FROM runs WHERE submitted_at IS NULL AND started_at < ?',
                       (now - MAX_RUN_AGE,))
            active = db.execute('SELECT COUNT(*) FROM runs WHERE player_id = ? AND submitted_at IS NULL',
                                (pid,)).fetchone()[0]
            if active >= 8:
                # Keep abandoned tabs bounded without touching completed scores.
                db.execute('''DELETE FROM runs WHERE id IN (
                    SELECT id FROM runs WHERE player_id = ? AND submitted_at IS NULL
                    ORDER BY started_at ASC LIMIT 1)''', (pid,))
            db.execute('''INSERT INTO players VALUES (?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET name=excluded.name, last_seen=excluded.last_seen''',
                       (pid, name, now, now))
            db.execute('INSERT INTO runs(id,player_id,seed,started_at) VALUES (?,?,?,?)',
                       (rid, pid, seed, now))
        return {'run_id': rid, 'seed': seed, 'name': name, 'score_version': SCORE_VERSION}

    def submit_run(self, pid: str, body: dict) -> dict:
        rid = body.get('run_id')
        if not isinstance(rid, str) or not re.fullmatch(r'[a-f0-9]{32}', rid):
            raise APIError(400, 'Некорректный идентификатор забега.')
        stats = {}
        for field in FIELDS:
            value = body.get(field)
            if type(value) is not int or not 0 <= value <= 10_000_000:
                raise APIError(400, f'Некорректное поле: {field}.')
            stats[field] = value
        elapsed = stats['elapsed_ms'] / 1000
        if elapsed < .1 or elapsed > 7200:
            raise APIError(422, 'Продолжительность забега вне допустимого диапазона.')
        limits = {'distance': elapsed * 58 + 120, 'coins': elapsed * 12 + 50,
                  'kills': elapsed * 6 + 10, 'sidejobs': elapsed * .8 + 5,
                  'bonuses': elapsed * .8 + 5}
        if any(stats[k] > limit for k, limit in limits.items()):
            raise APIError(422, 'Результат не прошёл проверку правдоподобия.')
        payload_hash = hashlib.sha256(json.dumps(stats, sort_keys=True).encode()).hexdigest()
        now = time.time()
        value = score_for(stats)  # Never accept a client-supplied final score.
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            run = db.execute('SELECT * FROM runs WHERE id=? AND player_id=?', (rid, pid)).fetchone()
            if run is None:
                raise APIError(404, 'Забег не найден. Начните новую смену.')
            if run['submitted_at'] is not None:
                if run['payload_hash'] != payload_hash:
                    raise APIError(409, 'Этот забег уже сохранён с другим результатом.')
                return {'score': run['score'], 'saved': True, 'duplicate': True}
            age = now - run['started_at']
            if age > MAX_RUN_AGE:
                raise APIError(410, 'Срок сохранения забега истёк (24 часа).')
            if elapsed > age * 1.10 + 2:
                raise APIError(422, 'Время забега не совпадает с серверным.')
            db.execute('''UPDATE runs SET submitted_at=?, elapsed_ms=?, distance=?, coins=?,
                kills=?, sidejobs=?, bonuses=?, score=?, payload_hash=? WHERE id=?''',
                       (now, stats['elapsed_ms'], stats['distance'], stats['coins'], stats['kills'],
                        stats['sidejobs'], stats['bonuses'], value, payload_hash, rid))
        return {'score': value, 'saved': True, 'duplicate': False}

    def route(self, env: dict, pid: str, new_cookie: str | None):
        path, method = env.get('PATH_INFO', '/'), env['REQUEST_METHOD']
        if path == '/api/health' and method in ('GET', 'HEAD'):
            with self.connect() as db:
                db.execute('SELECT 1 FROM runs LIMIT 1')
            return 200, {'ok': True, 'version': '2.0.0'}, []
        if path == '/api/session' and method == 'GET':
            self.limit(env, 'session', 180)
            with self.connect() as db:
                row = db.execute('SELECT name FROM players WHERE id=?', (pid,)).fetchone()
            return 200, {'csrf_token': self.digest('csrf:' + pid),
                         'name': row['name'] if row else None}, []
        if path == '/api/leaderboard' and method == 'GET':
            self.limit(env, 'board', 360)
            args = parse_qs(env.get('QUERY_STRING', ''))
            period = args.get('period', ['all'])[0]
            try:
                limit = int(args.get('limit', ['20'])[0])
            except ValueError as exc:
                raise APIError(400, 'Некорректный лимит.') from exc
            if period not in ('all', 'week', 'day') or not 1 <= limit <= 50:
                raise APIError(400, 'Некорректные параметры таблицы.')
            return 200, self.board(pid, period, limit), []
        if path in ('/api/runs/start', '/api/runs/finish') and method == 'POST':
            self.limit(env, 'write', 180)
            body = self.read_json(env, pid, new_cookie)
            data = self.start_run(pid, body) if path.endswith('/start') else self.submit_run(pid, body)
            return 200, data, []
        if path.startswith('/api/'):
            raise APIError(404 if method == 'GET' else 405, 'Метод API не найден.')
        if method not in ('GET', 'HEAD'):
            raise APIError(405, 'Метод не поддерживается.')
        relative = 'index.html' if path == '/' else path.lstrip('/')
        target = (self.static / relative).resolve()
        if not target.is_relative_to(self.static) or not target.is_file() or any(
            piece.startswith('.') for piece in Path(relative).parts
        ):
            raise APIError(404, 'Файл не найден.')
        data = target.read_bytes()
        content_type = mimetypes.guess_type(target.name)[0] or 'application/octet-stream'
        if content_type.startswith('text/') or target.suffix == '.js':
            content_type += '; charset=utf-8'
        etag = '"' + hashlib.sha256(data).hexdigest()[:24] + '"'
        headers = [('Content-Type', content_type), ('ETag', etag), ('Cache-Control', 'no-cache')]
        if env.get('HTTP_IF_NONE_MATCH') == etag:
            return 304, b'', headers
        return 200, data, headers

    def __call__(self, env: dict, start_response):
        pid, cookie = self.identity(env)
        path = env.get('PATH_INFO', '/')
        try:
            status, body, headers = self.route(env, pid, cookie)
        except APIError as exc:
            status, body, headers = exc.status, {'error': str(exc)}, []
            if status == 429:
                headers.append(('Retry-After', '60'))
        except sqlite3.Error:
            logging.exception('Database request failed')
            status, body, headers = 503, {'error': 'Таблица временно недоступна. Попробуйте ещё раз.'}, []
        except Exception:
            logging.exception('Unhandled request failure')
            status, body, headers = 500, {'error': 'Внутренняя ошибка сервера.'}, []
        if isinstance(body, dict):
            body = json.dumps(body, ensure_ascii=False, allow_nan=False).encode('utf-8')
            headers += [('Content-Type', 'application/json; charset=utf-8'), ('Cache-Control', 'no-store')]
        headers += [
            ('X-Content-Type-Options', 'nosniff'), ('X-Frame-Options', 'SAMEORIGIN'),
            ('Referrer-Policy', 'same-origin'),
            ('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'"),
            ('Permissions-Policy', 'camera=(), microphone=(), geolocation=()'),
        ]
        # Only the session endpoint creates an identity. Asset/health requests
        # cannot race it and overwrite a newly assigned cookie.
        if cookie and path == '/api/session' and status == 200:
            headers.append(('Set-Cookie', cookie))
        if status != 304:
            headers.append(('Content-Length', str(len(body))))
        start_response(f'{status} {HTTPStatus(status).phrase}', headers)
        return [b'' if env['REQUEST_METHOD'] == 'HEAD' or status == 304 else body]


# Lazy initialization avoids creating a database when importing helpers in tests.
_instance = None
_instance_lock = threading.Lock()


def application(environ, start_response):
    global _instance
    if _instance is None:
        with _instance_lock:
            if _instance is None:
                _instance = RunnerApp()
    return _instance(environ, start_response)


if __name__ == '__main__':
    from socketserver import ThreadingMixIn
    from wsgiref.simple_server import WSGIServer, make_server

    class DevServer(ThreadingMixIn, WSGIServer):
        daemon_threads = True

    port = int(os.getenv('PORT', '8080'))
    print(f'Local development only: http://127.0.0.1:{port}', flush=True)
    with make_server('127.0.0.1', port, application, server_class=DevServer) as server:
        server.serve_forever()