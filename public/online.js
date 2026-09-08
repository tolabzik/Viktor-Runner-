/* Shared records. Gameplay remains available when the API is unreachable. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const storage = {
    get(key, fallback = '') { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* Private browsing. */ } }
  };
  const format = n => Number(n || 0).toLocaleString('ru-RU');
  let session = null, initializing = null, period = 'all', boardRequest = 0;
  let restoreFocus = null, pending = null;
  const input = $('playerName');
  const nickname = storage.get('viktor.nickname') || `Сотрудник ${Math.floor(Math.random() * 900 + 100)}`;
  input.value = nickname;

  class RequestError extends Error {
    constructor(message, status = 0) { super(message); this.status = status; }
  }
  async function request(path, body, timeout = 6000) {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeout);
    try {
      const response = await fetch(path, {
        method: body ? 'POST' : 'GET', credentials: 'same-origin', signal: abort.signal,
        cache: 'no-store',
        headers: body ? { 'Content-Type': 'application/json', 'X-CSRF-Token': session?.csrf_token || '' } : {},
        ...(body ? { body: JSON.stringify(body) } : {})
      });
      let data;
      try { data = await response.json(); } catch { throw new RequestError('Сервер таблицы не отвечает.', response.status); }
      if (!response.ok) throw new RequestError(data.error || 'Ошибка сервера.', response.status);
      return data;
    } catch (error) {
      if (error instanceof RequestError) throw error;
      throw new RequestError('Нет связи с таблицей лидеров. Игра доступна локально.');
    } finally { clearTimeout(timer); }
  }
  function network(online) {
    $('networkBadge').textContent = online ? 'ОБЩИЕ РЕКОРДЫ' : 'ЛОКАЛЬНАЯ ИГРА';
    $('networkBadge').classList.toggle('offline', !online);
  }
  async function init(force = false) {
    if (session && !force) return session;
    if (initializing) return initializing;
    initializing = (async () => {
      try {
        if (!/^https?:$/.test(location.protocol)) throw new RequestError('Для общей таблицы запустите игру через Docker.');
        session = await request('/api/session');
        if (!session.csrf_token) throw new RequestError('Некорректный ответ API.');
        if (session.name && !storage.get('viktor.nickname') && input.value === nickname) input.value = session.name;
        network(true);
        return session;
      } catch (error) { network(false); session = null; throw error; }
      finally { initializing = null; }
    })();
    return initializing;
  }
  async function begin() {
    $('nameError').textContent = '';
    const name = input.value.normalize('NFKC').trim();
    if (!/^[\p{L}\p{M}\p{N} _.-]{2,24}$/u.test(name)) {
      $('nameError').textContent = 'Ник: 2–24 символа, буквы, цифры, пробел, _, . или -.';
      input.focus();
      return { invalid: true };
    }
    storage.set('viktor.nickname', name);
    try {
      await init();
      const result = await request('/api/runs/start', { name });
      network(true);
      return result;
    } catch (error) {
      if (error.status && error.status < 500) {
        $('nameError').textContent = error.message;
        if (error.status === 403) { session = null; init(true).catch(() => {}); }
        return { invalid: true };
      }
      network(false);
      return null;
    }
  }
  function scoreFor(g) { return Math.floor(g.dist) + g.coins * 25 + g.kills * 100 + g.sidejobs * 500 + g.bonuses * 1000; }
  function snapshot(g) {
    return { run_id: g.ticket?.run_id, distance: Math.max(0, Math.floor(g.dist)),
      coins: g.coins, kills: g.kills, sidejobs: g.sidejobs, bonuses: g.bonuses,
      elapsed_ms: Math.max(100, Math.round(g.elapsed * 1000)) };
  }
  async function save(body, current) {
    $('saveStatus').textContent = 'Сохраняем результат…';
    $('retrySaveButton').hidden = true;
    try {
      await init();
      const result = await request('/api/runs/finish', body);
      if (pending !== current) return;
      pending = null;
      $('saveStatus').textContent = `Результат сохранён: ${format(result.score)} очков. Проверь доску почёта.`;
      $('saveStatus').classList.remove('error');
      network(true);
      loadBoard().catch(() => {});
    } catch (error) {
      if (pending !== current) return;
      $('saveStatus').textContent = error.message;
      $('saveStatus').classList.add('error');
      $('retrySaveButton').hidden = [404,409,410,422].includes(error.status);
      if (error.status === 403) session = null;
      if (!error.status || error.status >= 500) network(false);
    }
  }
  function finish(g) {
    const total = scoreFor(g);
    const personal = Number(storage.get('viktor.bestScore', '0')) || 0;
    if (total > personal) storage.set('viktor.bestScore', String(total));
    $('finalScore').textContent = format(total);
    $('finalMoney').textContent = `Шабашки: ${g.sidejobs} · Премии: ${g.bonuses}`;
    $('saveStatus').classList.remove('error');
    $('retrySaveButton').hidden = true;
    pending = null;
    if (!g.ticket) {
      $('saveStatus').textContent = 'Локальный забег. Рекорд сохранён в этом браузере, но не в общей таблице.';
      return;
    }
    const body = snapshot(g);
    const current = { body };
    pending = current;
    save(body, current);
  }
  async function loadBoard() {
    const id = ++boardRequest;
    $('boardStatus').textContent = 'Загружаем доску почёта…';
    $('boardRows').replaceChildren();
    $('myRank').textContent = '';
    try {
      await init();
      const result = await request(`/api/leaderboard?period=${period}&limit=20`);
      if (id !== boardRequest) return;
      for (const row of result.entries) {
        const tr = document.createElement('tr');
        tr.classList.toggle('mine', row.mine);
        tr.classList.toggle('podium', row.rank <= 3);
        const name = row.name + (row.mine ? ' · ты' : '');
        for (const value of [String(row.rank).padStart(2, '0'), name, format(row.score), `${format(row.distance)} м`]) {
          const td = document.createElement('td');
          td.textContent = value;
          tr.append(td);
        }
        $('boardRows').append(tr);
      }
      $('boardStatus').textContent = result.entries.length
        ? `${format(result.players)} сотрудников в рейтинге. Один лучший забег на игрока.`
        : 'Доска пока пуста. Стань сотрудником месяца первым.';
      $('myRank').textContent = result.me
        ? `ТВОЁ МЕСТО: #${result.me.rank} · ${format(result.me.score)} ОЧКОВ · ${format(result.me.distance)} М`
        : 'Заверши онлайн-забег, чтобы попасть в рейтинг.';
      network(true);
    } catch (error) {
      if (id !== boardRequest) return;
      $('boardStatus').textContent = error.message;
      $('myRank').textContent = `Личный рекорд в этом браузере: ${format(storage.get('viktor.bestScore', '0'))} очков.`;
    }
  }
  async function open() {
    if (document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch { /* Fullscreen can be unavailable. */ }
    }
    window.dispatchEvent(new Event('viktor:board-open'));
    restoreFocus = document.activeElement;
    $('leaderboardDialog').hidden = false;
    $('closeBoardButton').focus();
    loadBoard();
  }
  function close() {
    $('leaderboardDialog').hidden = true;
    restoreFocus?.focus?.();
  }
  document.querySelectorAll('[data-open-board]').forEach(b => b.addEventListener('click', open));
  $('closeBoardButton').addEventListener('click', close);
  $('refreshBoardButton').addEventListener('click', () => loadBoard());
  $('retrySaveButton').addEventListener('click', () => { if (pending) save(pending.body, pending); });
  document.querySelectorAll('[data-period]').forEach(b => b.addEventListener('click', () => {
    period = b.dataset.period;
    document.querySelectorAll('[data-period]').forEach(tab => {
      tab.classList.toggle('active', tab === b);
      tab.setAttribute('aria-selected', String(tab === b));
    });
    loadBoard();
  }));
  $('leaderboardDialog').addEventListener('click', e => { if (e.target === $('leaderboardDialog')) close(); });
  document.addEventListener('keydown', e => {
    if ($('leaderboardDialog').hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); }
    if (e.key === 'Tab') {
      const buttons = [...$('leaderboardDialog').querySelectorAll('button:not(:disabled)')];
      const first = buttons[0], last = buttons.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }, true);
  window.addEventListener('online', () => init(true).catch(() => {}));
  window.RunnerOnline = { begin, finish, scoreFor, open, isOpen: () => !$('leaderboardDialog').hidden };
  init().catch(() => {});
})();