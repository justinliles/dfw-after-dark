/* Out & About DFW — public change history */
(() => {
  'use strict';
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const okayUrl = (u) => typeof u === 'string' && /^https:\/\//i.test(u);
  const list = document.getElementById('change-list');
  const buttons = [...document.querySelectorAll('[data-filter]')];
  let entries = [];
  let current = 'all';
  const time = (x) => {
    const d = new Date(x);
    return Number.isNaN(+d) ? 'Date unavailable' : new Intl.DateTimeFormat('en-US',{dateStyle:'medium', timeZone:'America/Chicago'}).format(d);
  };
  const row = (item) => {
    const kind = item.type === 'added' || item.type === 'removed' ? item.type : 'technology';
    const name = esc(item.title || item.name || 'Site update');
    const detail = esc(item.description || (kind === 'added' ? 'Added to the upcoming events feed' : kind === 'removed' ? 'Removed from the rolling event feed; not necessarily cancelled' : 'Website improvement'));
    const source = okayUrl(item.url) ? '<a class="change-source" href="'+esc(item.url)+'" target="_blank" rel="noopener noreferrer">Organizer / source ↗</a>' : '';
    const commit = okayUrl(item.commitUrl) ? '<a class="change-source" href="'+esc(item.commitUrl)+'" target="_blank" rel="noopener noreferrer">View change ↗</a>' : '';
    const label = kind === 'added' ? 'Event added' : kind === 'removed' ? 'Event removed' : 'Technology update';
    return '<article class="change-item change-'+kind+'"><span class="change-kind">'+label+'</span><div><h3>'+name+'</h3><p>'+detail+'</p><div class="change-details"><span>'+esc(time(item.date))+'</span>'+(item.area?'<span>'+esc(item.area)+'</span>':'')+source+commit+'</div></div></article>';
  };
  function draw() {
    const visible = entries.filter(e => current === 'all' || e.type === current);
    list.innerHTML = visible.length ? visible.map(row).join('') : '<div class="change-message">No updates in this category yet. Check another filter.</div>';
    buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === current)));
  }
  buttons.forEach(b => b.addEventListener('click', () => { current = b.dataset.filter; draw(); }));
  fetch('data/changelog.json', {cache:'no-store'}).then(r => {if(!r.ok) throw Error('No changelog data'); return r.json();}).then(data => {
    entries = (Array.isArray(data) ? data : []).filter(e => e && ['added','removed','technology'].includes(e.type)).sort((a,b) => (b.date||'').localeCompare(a.date||''));
    for (const k of ['added','removed']) document.getElementById(k+'-count').textContent = entries.filter(e=>e.type===k).length.toLocaleString();
    document.getElementById('tech-count').textContent = entries.filter(e=>e.type==='technology').length.toLocaleString();
    draw();
  }).catch(() => { list.innerHTML = '<div class="change-message">The change history is temporarily unavailable. <a href="/">Explore current events</a>.</div>';});
})();