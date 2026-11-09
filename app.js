/* DFW After Dark
   Reads data/events.json and data/places.json (schema unchanged) and renders a rolling 7-day guide.
   Add ?preview=YYYY-MM-DD (or YYYY-MM-DDTHH:mm) to the URL to see the page as of another date. */
(() => {
  'use strict';

  const TZ = 'America/Chicago';
  const SAVE_KEY = 'dfw-after-dark-saves';
  const WINDOW_DAYS = 7;
  const DEFAULT_DURATION_MS = 3 * 60 * 60 * 1000;

  const CATEGORY_COLORS = {
    'Music & Jazz': 'pink',
    'Art & Culture': 'amber',
    'Books & Shops': 'mint',
    'Pets & Animals': 'sky',
    'Markets & Festivals': 'coral',
    'Games & Play': 'violet'
  };
  const COLOR_ORDER = ['pink', 'amber', 'mint', 'sky', 'violet', 'coral'];

  const state = {
    events: [], places: [],
    day: 'all', category: 'all', area: 'all', q: '', savedOnly: false,
    saved: loadSaves()
  };

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name) => `<svg class="ico" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const isHttps = (u) => typeof u === 'string' && /^https:\/\//i.test(u);

  /* ---------- storage ---------- */
  function loadSaves() {
    try { return new Set(JSON.parse(localStorage.getItem(SAVE_KEY) || '[]')); } catch { return new Set(); }
  }
  function persistSaves() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify([...state.saved])); } catch { /* private mode: saves last for this visit */ }
  }

  /* ---------- time ---------- */
  const fmt = (opts, locale = 'en-US') => new Intl.DateTimeFormat(locale, { timeZone: TZ, ...opts });
  const F = {
    parts: fmt({ year: 'numeric', month: '2-digit', day: '2-digit' }),
    time: fmt({ hour: 'numeric', minute: '2-digit' }),
    wdShort: fmt({ weekday: 'short' }),
    wdLong: fmt({ weekday: 'long' }),
    monShort: fmt({ month: 'short' }),
    monLong: fmt({ month: 'long' }),
    dayNum: fmt({ day: 'numeric' })
  };

  function previewNow() {
    const p = new URLSearchParams(location.search).get('preview');
    if (!p) return null;
    const d = new Date(/T/.test(p) ? `${p}:00-06:00` : `${p}T09:00:00-06:00`);
    return Number.isNaN(+d) ? null : d;
  }
  const PREVIEW = previewNow();
  const now = () => PREVIEW || new Date();

  const keyOf = (date) => {
    const p = Object.fromEntries(F.parts.formatToParts(date).map((x) => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}`;
  };
  const keyToDate = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d, 18)); };
  const addDays = (key, n) => { const d = keyToDate(key); d.setUTCDate(d.getUTCDate() + n); return keyOf(d); };
  const windowKeys = () => { const t = keyOf(now()); return Array.from({ length: WINDOW_DAYS }, (_, i) => addDays(t, i)); };

  function eventKeys(e) {
    const s = keyOf(new Date(e.start));
    const end = keyOf(new Date(e.end || e.start));
    const out = [];
    for (let k = s; k <= end && out.length < 62; k = addDays(k, 1)) out.push(k);
    return out;
  }

  function timeLabel(e) {
    if (e.timeTBD) return 'Hours: See organizer';
    const s = new Date(e.start);
    if (Number.isNaN(+s)) return 'Check organizer';
    const hasEnd = e.end && !Number.isNaN(+new Date(e.end));
    if (!hasEnd) return F.time.format(s);
    const en = new Date(e.end);
    if (keyOf(s) === keyOf(en)) {
      try { return F.time.formatRange(s, en); } catch { return `${F.time.format(s)} – ${F.time.format(en)}`; }
    }
    return `${F.wdShort.format(s)} ${F.time.format(s)} – ${F.wdShort.format(en)} ${F.time.format(en)}`;
  }

  function dayTitle(key) {
    const t = keyOf(now());
    const d = keyToDate(key);
    const name = `${F.wdLong.format(d)}, ${F.monLong.format(d)} ${F.dayNum.format(d)}`;
    if (key === t) return { title: 'Today', sub: name };
    if (key === addDays(t, 1)) return { title: 'Tomorrow', sub: name };
    return { title: F.wdLong.format(d), sub: `${F.monLong.format(d)} ${F.dayNum.format(d)}` };
  }

  /* ---------- data prep ---------- */
  function prepare(raw) {
    const keys = windowKeys();
    const today = keys[0];
    const t = now();
    return raw.map((e) => {
      const start = new Date(e.start);
      const end = e.end ? new Date(e.end) : new Date(+start + DEFAULT_DURATION_MS);
      return { ...e, _start: start, _end: end, _keys: eventKeys(e), _today: today };
    }).filter((e) => !Number.isNaN(+e._start) && e._end >= t && e._keys.some((k) => keys.includes(k)))
      .map((e) => ({ ...e, _first: e._keys.find((k) => k >= today) || e._keys[0], _multi: e._keys.length > 1 }))
      .sort((a, b) => a._start - b._start);
  }

  const catColor = (cat) => `var(--c-${CATEGORY_COLORS[cat] || COLOR_ORDER[hash(cat) % COLOR_ORDER.length]})`;
  function hash(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }

  function matches(e, skip) {
    if (skip !== 'day' && state.day !== 'all' && !e._keys.includes(state.day)) return false;
    if (skip !== 'category' && state.category !== 'all' && e.category !== state.category) return false;
    if (state.area !== 'all' && e.area !== state.area) return false;
    if (state.savedOnly && !state.saved.has(e.id)) return false;
    if (state.q && ![e.title, e.venue, e.area, e.description, e.category].join(' ').toLowerCase().includes(state.q)) return false;
    return true;
  }
  const filtered = (skip) => state.events.filter((e) => matches(e, skip));

  /* ---------- hero ---------- */
  function renderHero() {
    const el = $('heroNext');
    const next = state.events[0];
    const n = state.events.length;
    $('pulse').textContent = n
      ? `${n} verified ${n === 1 ? 'plan' : 'plans'} in the next seven days.`
      : 'New plans are on the way.';
    if (!next) {
      el.innerHTML = `<div class="quiet"><strong>The calendar is quiet right now.</strong><p>Check back soon, or start with the <a href="#anytime-title">spots that are open any day</a>.</p></div>`;
      return;
    }
    const today = keyOf(now());
    const live = next._start <= now();
    let when;
    if (live) when = 'Happening now';
    else if (next._first === today) when = `Today at ${F.time.format(next._start)}`;
    else if (next._first === addDays(today, 1)) when = `Tomorrow at ${F.time.format(next._start)}`;
    else when = `${F.wdLong.format(next._start)} at ${F.time.format(next._start)}`;
    el.innerHTML = `<div class="nexthead"><strong>Next up</strong><span>${esc(when)}</span></div>${ticket(next, true)}`;
  }

  /* ---------- day bar ---------- */
  function renderDays() {
    const keys = windowKeys();
    const base = filtered('day');
    const first = keyToDate(keys[0]);
    const last = keyToDate(keys[WINDOW_DAYS - 1]);
    $('period').textContent = `${F.monShort.format(first)} ${F.dayNum.format(first)} to ${F.monShort.format(last)} ${F.dayNum.format(last)}`;
    const dots = (n) => n === 0 ? '<span class="none" aria-hidden="true">·</span>'
      : n <= 4 ? '<span class="dots" aria-hidden="true">' + '<i></i>'.repeat(n) + '</span>'
      : `<span class="dots" aria-hidden="true"><i></i><em>${n}</em></span>`;
    const allBtn = `<button type="button" class="day all" data-day="all" aria-pressed="${state.day === 'all'}" aria-label="All seven days, ${base.length} events"><span class="dow">Week</span><span class="num">All</span><span class="dots" aria-hidden="true"><em>${base.length}</em></span></button>`;
    $('days').innerHTML = allBtn + keys.map((k, i) => {
      const d = keyToDate(k);
      const n = base.filter((e) => e._keys.includes(k)).length;
      const dow = i === 0 ? 'Today' : F.wdShort.format(d);
      return `<button type="button" class="day${n ? '' : ' empty-day'}" data-day="${k}" aria-pressed="${state.day === k}" aria-label="${esc(F.wdLong.format(d))} ${esc(F.monLong.format(d))} ${esc(F.dayNum.format(d))}, ${n} ${n === 1 ? 'event' : 'events'}"><span class="dow">${esc(dow)}</span><span class="num">${esc(F.dayNum.format(d))}</span>${dots(n)}</button>`;
    }).join('');
  }

  /* ---------- filters ---------- */
  function renderChips() {
    const base = filtered('category');
    const cats = [...new Set(state.events.map((e) => e.category))].sort();
    const chip = (value, label, n, color) => `<button type="button" class="chip" data-cat="${esc(value)}" aria-pressed="${state.category === value}" style="${color ? `--dot:${color}` : ''}">${color ? '<i></i>' : ''}${esc(label)} <small>${n}</small></button>`;
    $('chips').innerHTML = chip('all', 'Everything', base.length, '') +
      cats.map((c) => chip(c, c, base.filter((e) => e.category === c).length, catColor(c))).join('');
  }

  function buildAreaOptions() {
    const sel = $('area');
    const areas = [...new Set(state.events.map((e) => e.area).filter(Boolean))].sort();
    sel.innerHTML = '<option value="all">All of DFW</option>' + areas.map((a) => `<option value="${esc(a)}">${esc(a)}</option>`).join('');
    if (!areas.includes(state.area)) state.area = 'all';
    sel.value = state.area;
  }

  function renderSavedBadge() {
    const n = state.events.filter((e) => state.saved.has(e.id)).length;
    const b = $('savedCount');
    b.hidden = n === 0;
    b.textContent = n;
    const t = $('savedToggle');
    t.setAttribute('aria-pressed', String(state.savedOnly));
  }

  /* ---------- ticket ---------- */
  function stubFor(e) {
    const today = keyOf(now());
    const startKey = e._keys[0];
    if (startKey < today) {
      const end = e._end;
      return `<span class="thru">Through</span><span class="dnum">${esc(F.dayNum.format(end))}</span><span class="wd">${esc(F.wdShort.format(end))}</span>`;
    }
    const s = e._start;
    return `<span class="mon">${esc(F.monShort.format(s))}</span><span class="dnum">${esc(F.dayNum.format(s))}</span><span class="wd">${esc(e._multi ? `${F.wdShort.format(s)}–${F.wdShort.format(e._end)}` : F.wdShort.format(s))}</span>`;
  }

  function ticket(e, big = false) {
    const saved = state.saved.has(e.id);
    const details = isHttps(e.url) ? `<a class="btn primary" href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">Details &amp; tickets ${icon('out')}</a>` : '';
    const directions = e.address ? `<a class="btn" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.address)}" target="_blank" rel="noopener noreferrer">${icon('nav')}Directions</a>` : '';
    return `<article class="ticket${big ? ' big' : ''}" data-id="${esc(e.id)}" style="--cat:${catColor(e.category)}">
      <div class="stub">${stubFor(e)}</div>
      <div class="tbody">
        <button type="button" class="save" data-save="${esc(e.id)}" aria-pressed="${saved}" aria-label="${saved ? 'Remove' : 'Save'} ${esc(e.title)}">${icon('heart')}</button>
        <p class="cat"><i></i><span>${esc(e.category)}</span>${e.featured ? '<span class="pick">Editor’s pick</span>' : ''}</p>
        <h3>${esc(e.title)}</h3>
        <div class="meta">
          <p>${icon('pin')}<span>${esc(e.venue)}${e.area ? `, ${esc(e.area)}` : ''}</span></p>
          <p>${icon('clock')}<span>${esc(timeLabel(e))}</span></p>
          <p>${icon('ticket')}<span>${esc(e.price || 'Check with the venue')}</span></p>
        </div>
        <p class="desc">${esc(e.description)}</p>
        <div class="actions">${details}${directions}<button type="button" class="btn" data-ics="${esc(e.id)}">${icon('cal')}Add to calendar</button></div>
      </div>
    </article>`;
  }

  /* ---------- list ---------- */
  function renderList() {
    const items = filtered().sort((a, b) => a._start - b._start);
    const cards = $('cards');
    const empty = $('empty');
    cards.setAttribute('aria-busy', 'false');
    $('count').textContent = `${items.length} ${items.length === 1 ? 'event' : 'events'} shown`;

    if (!items.length) {
      cards.innerHTML = '';
      empty.hidden = false;
      const filtering = state.day !== 'all' || state.category !== 'all' || state.area !== 'all' || state.q || state.savedOnly;
      empty.innerHTML = filtering
        ? `<h3>Nothing matches yet</h3><p>${state.savedOnly ? 'You haven’t saved anything in this view.' : 'No verified listings fit these filters.'} Try another day or clear the filters.</p><button type="button" class="btn" data-clear>Clear filters</button>`
        : `<h3>No plans posted yet</h3><p>The next listings haven’t been verified yet. The spots below are open any day.</p>`;
    } else {
      empty.hidden = true;
      const groups = new Map();
      for (const e of items) {
        const k = state.day === 'all' ? e._first : state.day;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(e);
      }
      cards.innerHTML = [...groups.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, list]) => {
        const { title, sub } = dayTitle(k);
        return `<section class="group" aria-label="${esc(title)}, ${esc(sub)}"><div class="grouphead"><h3>${esc(title)}</h3><span>${esc(sub)} · ${list.length} ${list.length === 1 ? 'plan' : 'plans'}</span></div>${list.map((e) => ticket(e)).join('')}</section>`;
      }).join('');
    }
    renderMap(items);
  }

  /* ---------- map ---------- */
  let map, layer, placeLayer;
  const markers = new Map();

  function spread(items) {
    // Venues that share a block would stack on one pin, so nudge them apart in a small circle.
    const buckets = new Map();
    items.forEach((e) => {
      if (!Number.isFinite(e.lat) || !Number.isFinite(e.lng)) return;
      const k = `${e.lat.toFixed(3)},${e.lng.toFixed(3)}`;
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(e);
    });
    const out = [];
    for (const list of buckets.values()) {
      list.forEach((e, i) => {
        if (list.length === 1) return out.push({ e, lat: e.lat, lng: e.lng });
        const a = (2 * Math.PI * i) / list.length;
        out.push({ e, lat: e.lat + Math.sin(a) * 0.0011, lng: e.lng + Math.cos(a) * 0.0014 });
      });
    }
    return out;
  }

  function ensureMap() {
    if (map || !window.L) return Boolean(map);
    map = L.map('map', { scrollWheelZoom: false, zoomControl: true }).setView([32.92, -96.87], 9);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; OpenStreetMap &copy; CARTO', maxZoom: 18 }).addTo(map);
    layer = L.featureGroup().addTo(map);
    placeLayer = L.layerGroup().addTo(map);
    return true;
  }

  function renderMap(items) {
    if (!ensureMap()) return;
    layer.clearLayers();
    markers.clear();
    spread(items).forEach(({ e, lat, lng }) => {
      const html = `<div class="pinwrap"><div class="pin" style="--pc:${catColor(e.category)}"></div></div>`;
      const m = L.marker([lat, lng], { icon: L.divIcon({ className: '', html, iconSize: [28, 28], iconAnchor: [14, 14] }), title: e.title, keyboard: true }).addTo(layer);
      const link = isHttps(e.url) ? `<br><a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">Event details</a>` : '';
      m.bindPopup(`<strong>${esc(e.title)}</strong><br>${esc(e.venue)}, ${esc(e.area)}${link}`);
      m.on('click', () => highlight(e.id, true));
      markers.set(e.id, m);
    });

    placeLayer.clearLayers();
    state.places.forEach((p) => {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return;
      L.marker([p.lat, p.lng], { icon: L.divIcon({ className: '', html: '<div class="pinwrap"><div class="placepin"></div></div>', iconSize: [28, 28], iconAnchor: [14, 14] }), title: p.title })
        .addTo(placeLayer).bindPopup(`<strong>${esc(p.title)}</strong><br>${esc(p.area)} · open any day`);
    });

    if (layer.getLayers().length) map.fitBounds(layer.getBounds().pad(0.25), { maxZoom: 12 });
    setTimeout(() => map.invalidateSize(), 80);
  }

  function setActive(id, on) {
    document.querySelectorAll(`.ticket[data-id="${CSS.escape(id)}"]`).forEach((t) => t.classList.toggle('is-active', on));
    const m = markers.get(id);
    const pin = m && m.getElement() && m.getElement().querySelector('.pin');
    if (pin) pin.classList.toggle('is-active', on);
  }

  let flashTimer;
  function highlight(id, scroll) {
    document.querySelectorAll('.ticket.is-active').forEach((t) => setActive(t.dataset.id, false));
    setActive(id, true);
    if (scroll && document.body.dataset.view === 'list') {
      const card = document.querySelector(`#cards .ticket[data-id="${CSS.escape(id)}"]`);
      if (card) card.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    }
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => setActive(id, false), 2600);
  }

  /* ---------- anytime places ---------- */
  function renderPlaces() {
    $('places').innerHTML = state.places.map((p) => `<article class="place">
      <div><h3>${esc(p.title)}</h3><p class="where">${icon('pin')}${esc(p.area)} · ${esc(p.category)}</p></div>
      <p class="d">${esc(p.description)}</p>
      ${isHttps(p.url) ? `<a class="go" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${icon('nav')}Open in Maps</a>` : ''}
    </article>`).join('');
  }

  /* ---------- calendar export ---------- */
  function ics(e) {
    const z = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const t = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DFW After Dark//EN', 'BEGIN:VEVENT',
      `UID:${e.id}@dfw-after-dark`, `DTSTAMP:${z(new Date())}`, `DTSTART:${z(e._start)}`, `DTEND:${z(e._end)}`,
      `SUMMARY:${t(e.title)}`, `LOCATION:${t(`${e.venue}, ${e.address}`)}`,
      `DESCRIPTION:${t(`${e.description}${isHttps(e.url) ? `\n${e.url}` : ''}`)}`, 'END:VEVENT', 'END:VCALENDAR'];
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${e.id}.ics`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ---------- render + events ---------- */
  function render() { renderHero(); renderDays(); renderChips(); renderSavedBadge(); renderList(); }
  function refreshListOnly() { renderDays(); renderChips(); renderSavedBadge(); renderList(); }

  function bind() {
    $('days').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-day]'); if (!b) return;
      state.day = b.dataset.day; refreshListOnly();
    });
    $('chips').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-cat]'); if (!b) return;
      state.category = state.category === b.dataset.cat ? 'all' : b.dataset.cat; refreshListOnly();
    });
    $('search').addEventListener('input', (ev) => { state.q = ev.target.value.trim().toLowerCase(); refreshListOnly(); });
    $('area').addEventListener('change', (ev) => { state.area = ev.target.value; refreshListOnly(); });
    $('savedToggle').addEventListener('click', () => { state.savedOnly = !state.savedOnly; refreshListOnly(); });

    document.addEventListener('click', (ev) => {
      const save = ev.target.closest('[data-save]');
      if (save) {
        const id = save.dataset.save;
        state.saved.has(id) ? state.saved.delete(id) : state.saved.add(id);
        persistSaves();
        renderHero(); renderSavedBadge(); renderList();
        return;
      }
      const cal = ev.target.closest('[data-ics]');
      if (cal) { const e = state.events.find((x) => x.id === cal.dataset.ics); if (e) ics(e); return; }
      if (ev.target.closest('[data-clear]')) {
        Object.assign(state, { day: 'all', category: 'all', area: 'all', q: '', savedOnly: false });
        $('search').value = ''; $('area').value = 'all'; refreshListOnly();
      }
    });

    $('cards').addEventListener('mouseover', (ev) => { const t = ev.target.closest('.ticket'); if (t) setActive(t.dataset.id, true); });
    $('cards').addEventListener('mouseout', (ev) => { const t = ev.target.closest('.ticket'); if (t && !t.contains(ev.relatedTarget)) setActive(t.dataset.id, false); });

    const setView = (v) => {
      document.body.dataset.view = v;
      $('viewList').setAttribute('aria-pressed', String(v === 'list'));
      $('viewMap').setAttribute('aria-pressed', String(v === 'map'));
      if (v === 'map' && map) setTimeout(() => { map.invalidateSize(); if (layer.getLayers().length) map.fitBounds(layer.getBounds().pad(0.25), { maxZoom: 12 }); }, 60);
    };
    $('viewList').addEventListener('click', () => setView('list'));
    $('viewMap').addEventListener('click', () => setView('map'));
  }

  async function start() {
    bind();
    try {
      const [a, b] = await Promise.all([fetch('data/events.json', { cache: 'no-store' }), fetch('data/places.json', { cache: 'no-store' })]);
      if (!a.ok || !b.ok) throw new Error('Data request failed');
      state.events = prepare(await a.json());
      state.places = await b.json();
      buildAreaOptions();
      renderPlaces();
      render();
    } catch (err) {
      console.error(err);
      $('cards').setAttribute('aria-busy', 'false');
      $('cards').innerHTML = '';
      $('empty').hidden = false;
      $('empty').innerHTML = '<h3>Couldn’t load events</h3><p>The listings didn’t come through. Check your connection and try again.</p><button type="button" class="btn" onclick="location.reload()">Reload the page</button>';
      $('heroNext').innerHTML = '';
    }
  }
  start();
})();
