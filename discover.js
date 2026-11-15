/* Out & About DFW: short home + independent search experience. No APIs, no keys. */
(() => {
'use strict';
const q=s=>document.querySelector(s);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(date,opts)=>new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',...opts}).format(new Date(date));
const key=date=>{const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(date));const x=Object.fromEntries(p.map(y=>[y.type,y.value]));return x.year+'-'+x.month+'-'+x.day};
const dateKey=d=>key(d);
const time=e=>e.timeTBD?'Hours: See organizer':fmt(e.start,{hour:'numeric',minute:'2-digit'});
const pretty=e=>fmt(e.start,{weekday:'short',month:'short',day:'numeric'});
const https=u=>typeof u==='string'&&u.startsWith('https://');
const today=key(new Date());
const startOfDay=day=>new Date(day+'T00:00:00-06:00');
function valid(e){
  const s=new Date(e.start),end=new Date(e.end||e.start);
  if(Number.isNaN(+s)||Number.isNaN(+end)||end<new Date()||!https(e.url))return false;
  const first=key(s),last=key(end);
  const seven=new Date(today+'T12:00:00-06:00');seven.setUTCDate(seven.getUTCDate()+6);
  return last>=today&&first<=key(seven);
}
let events=[];
function textFor(e){return [e.title,e.venue,e.area,e.category,e.description,e.price].join(' ').toLowerCase()}
function details(e){
 return '<a href="'+escape(e.url)+'" target="_blank" rel="noopener noreferrer">Details ↗</a>';
}
function luckyCard(e){
 return '<div class="lucky-note"><span>✦ YOUR SURPRISE PICK</span><h3>'+escape(e.title)+'</h3><p>'+escape(pretty(e))+' · '+escape(time(e))+' · '+escape(e.venue)+' · '+escape(e.area)+'</p><p>'+escape(e.description)+'</p>'+details(e)+'</div>';
}
function pick(pool){if(!pool.length)return null;const candidates=pool.filter(e=>e.featured);const arr=candidates.length?candidates:pool;let i=0;try{const n=new Uint32Array(1);crypto.getRandomValues(n);i=n[0]%arr.length}catch{i=Math.floor(Math.random()*arr.length)}return arr[i]}
function home(){
 const list=q('#home-cards'),status=q('#home-status'),lucky=q('#lucky'),box=q('#lucky-result');
 if(!list)return;
 const featured=events.filter(e=>e.featured),chosen=[...featured];
 for(const e of events)if(chosen.length<4&&!chosen.some(x=>x.id===e.id))chosen.push(e);
 const sample=chosen.slice(0,4);
 status.textContent=events.length?events.length+' upcoming listings · Showing just four highlights':'No upcoming listings right now';
 list.innerHTML=sample.length?sample.map(e=>'<article class="home-pick"><span class="home-pick-date">'+escape(pretty(e))+' · '+escape(time(e))+'</span><h3>'+escape(e.title)+'</h3><p>'+escape(e.venue)+' · '+escape(e.area)+'</p><p>'+escape(e.description||'')+'</p>'+details(e)+'</article>').join(''):'<p class="home-muted">Nothing scheduled right now. Browse the anytime destinations on the Events page.</p>';
 lucky.addEventListener('click',()=>{const e=pick(events);box.hidden=false;box.innerHTML=e?luckyCard(e):'<p>No upcoming events to choose from yet.</p>';box.scrollIntoView({behavior:'smooth',block:'nearest'})});
}
function search(){
 const input=q('#query');if(!input)return;
 const date=q('#search-date'),category=q('#search-category'),results=q('#search-list'),pagination=q('#search-pagination'),count=q('#result-count');
 const params=new URLSearchParams(location.search);input.value=params.get('q')||'';
 const days=new Map();
 for(const e of events){const k=dateKey(e.start);if(!days.has(k))days.set(k,fmt(e.start,{weekday:'short',month:'short',day:'numeric'}))}
 [...days].sort(([a],[b])=>a.localeCompare(b)).forEach(([k,label])=>date.insertAdjacentHTML('beforeend','<option value="'+escape(k)+'">'+escape(label)+'</option>'));
 [...new Set(events.map(e=>e.category))].filter(Boolean).sort().forEach(c=>category.insertAdjacentHTML('beforeend','<option value="'+escape(c)+'">'+escape(c)+'</option>'));
 let page=1;const SIZE=12;
 const matches=()=>{const terms=input.value.toLowerCase().trim().split(/\s+/).filter(Boolean);return events.filter(e=>
   (date.value==='all'||(dateKey(e.start)<=date.value&&dateKey(e.end||e.start)>=date.value))&&
   (category.value==='all'||e.category===category.value)&&terms.every(t=>textFor(e).includes(t))
 )};
 function draw(){
   const arr=matches(),pages=Math.max(1,Math.ceil(arr.length/SIZE));page=Math.min(page,pages);
   const slice=arr.slice((page-1)*SIZE,page*SIZE);
   count.textContent=arr.length+' matching events';
   q('#result-heading').textContent=input.value.trim()?'Results for “'+input.value.trim()+'”':'Explore this week';
   results.innerHTML=slice.length?slice.map(e=>'<article class="search-hit"><div class="search-hit-date">'+escape(pretty(e))+'<small>'+escape(time(e))+'</small></div><div><a class="search-title" href="'+escape(e.url)+'" target="_blank" rel="noopener noreferrer">'+escape(e.title)+'</a><p>'+escape(e.venue)+' · '+escape(e.area)+' · '+escape(e.category)+'</p><p>'+escape(e.description||'')+'</p></div><a class="search-arrow" href="'+escape(e.url)+'" target="_blank" rel="noopener noreferrer" aria-label="View '+escape(e.title)+'">↗</a></article>').join(''):'<p class="search-empty">No verified events match. Try a different keyword or day.</p>';
   pagination.innerHTML=arr.length>SIZE?'<button type="button" data-step="-1" '+(page===1?'disabled':'')+'>← Previous</button><span>Page '+page+' of '+pages+'</span><button type="button" data-step="1" '+(page===pages?'disabled':'')+'>Next →</button>':'';
 }
 pagination.addEventListener('click',ev=>{const el=ev.target.closest('[data-step]');if(!el)return;page+=Number(el.dataset.step);draw();q('#search-results').scrollIntoView()});
 q('#search-form').addEventListener('submit',ev=>{ev.preventDefault();page=1;history.replaceState(null,'',location.pathname+(input.value.trim()?'?q='+encodeURIComponent(input.value.trim()):''));draw();q('#search-results').scrollIntoView({behavior:'smooth'})});
 input.addEventListener('input',()=>{page=1;draw()});
 for(const el of [date,category])el.addEventListener('change',()=>{page=1;draw()});
 q('#search-reset').addEventListener('click',()=>{input.value='';date.value='all';category.value='all';page=1;history.replaceState(null,'',location.pathname);draw()});
 q('#search-lucky').addEventListener('click',()=>{const e=pick(matches().length?matches():events);if(!e){results.innerHTML='<p class="search-empty">No events found yet.</p>';return;}input.value=e.title;date.value='all';category.value='all';page=1;draw();q('#search-results').scrollIntoView({behavior:'smooth'})});
 draw();
}
fetch('data/events.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Event data unavailable');return r.json()}).then(data=>{events=data.filter(valid).sort((a,b)=>new Date(a.start)-new Date(b.start));home();search()}).catch(()=>{const s=q('#home-status');if(s)s.textContent='The radar is temporarily unavailable.';const h=q('#search-list');if(h)h.innerHTML='<p class="search-empty">Could not load event data. Try refreshing.</p>';});
})();