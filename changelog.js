/* Daily radar activity is aggregated by local date; technology releases stay detailed. */
(() => {
'use strict';
const list = document.getElementById('change-list');
const buttons = Array.from(document.querySelectorAll('[data-filter]'));
const esc = value => String(value == null ? '' : value).replace(/[&<>"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));
const localKey = raw => {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const value = key => parts.find(part=>part.type===key).value;
  return value('year')+'-'+value('month')+'-'+value('day');
};
const label = raw => new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',weekday:'long',year:'numeric',month:'long',day:'numeric'}).format(new Date(raw));
let entries = [], current = 'all';
function draw() {
 const groups = new Map();
 for (const e of entries) {
  const key=localKey(e.date);
  if (!key) continue;
  if (!groups.has(key)) groups.set(key,{date:e.date,added:0,removed:0,tech:[]});
  const g=groups.get(key);
  if (e.type==='added') g.added++;
  if (e.type==='removed') g.removed++;
  if (e.type==='technology') g.tech.push(e);
 }
 const html=Array.from(groups).sort((a,b)=>b[0].localeCompare(a[0])).map(([,g])=>{
   const daily=current!=='technology'&&(g.added||g.removed);
   const tech=current!=='daily'&&g.tech.length;
   if (!daily&&!tech) return '';
   const net=g.added-g.removed;
   const summary=daily?'<article class="change-item change-daily"><span class="change-kind">Daily radar refresh</span><div><h3>Event directory refreshed</h3><p>Changes to the rolling seven-day schedule. Removed listings are not necessarily cancellations.</p><div class="change-details"><span>+'+g.added+' added</span><span>−'+g.removed+' removed</span><span>'+(net>0?'+':'')+net+' net</span></div></div></article>':'';
   const release=tech?g.tech.map(e=>'<article class="change-item change-technology"><span class="change-kind">Technology update</span><div><h3>'+esc(e.title||e.name||'Site improvement')+'</h3><p>'+esc(e.description||'Website improvement')+'</p></div></article>').join(''):'';
   return '<section class="change-day"><h3 class="change-day-heading">'+esc(label(g.date))+'</h3><div class="change-day-items">'+summary+release+'</div></section>';
 }).filter(Boolean).join('');
 list.innerHTML=html||'<div class="change-message">No updates in this category yet.</div>';
 buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===current)));
}
buttons.forEach(b=>b.addEventListener('click',()=>{current=b.dataset.filter;draw();}));
fetch('data/changelog.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Unavailable');return r.json();}).then(data=>{
 entries=(Array.isArray(data)?data:[]).filter(e=>e&&['added','removed','technology'].includes(e.type)&&localKey(e.date));
 for(const type of ['added','removed']) document.getElementById(type+'-count').textContent=entries.filter(e=>e.type===type).length.toLocaleString();
 document.getElementById('tech-count').textContent=entries.filter(e=>e.type==='technology').length.toLocaleString();
 draw();
}).catch(()=>{list.innerHTML='<div class="change-message">Change history temporarily unavailable.</div>';});
})();