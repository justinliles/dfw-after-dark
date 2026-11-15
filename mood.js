/* Out & About DFW — local-data Mood Finder. No external APIs. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const TZ='America/Chicago';
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const fmt=(d,options)=>new Intl.DateTimeFormat('en-US',{timeZone:TZ,...options}).format(d instanceof Date?d:new Date(d));
  const keyOf=date=>{const p=new Intl.DateTimeFormat('en-US',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date instanceof Date?date:new Date(date));const o=Object.fromEntries(p.map(x=>[x.type,x.value]));return o.year+'-'+o.month+'-'+o.day};
  const toNoon=key=>{const [y,m,d]=key.split('-').map(Number);return new Date(Date.UTC(y,m-1,d,18))};
  const addDay=(key,n)=>{const d=toNoon(key);d.setUTCDate(d.getUTCDate()+n);return keyOf(d)};
  const today=keyOf(new Date()),week=Array.from({length:7},(_,i)=>addDay(today,i));
  let events=[],selections=null,round=0;
  const keywordRules={
    music:[['Music & Jazz',9],['music',4],['jazz',5],['concert',4],['symphony',4],['band',3],['comedy',3],['improv',3],['theatre',3],['show',2],['live',1]],
    creative:[['Art & Culture',9],['Books & Shops',6],['art',5],['gallery',4],['artist',3],['pottery',5],['painting',4],['workshop',4],['craft',3],['book',4],['author',4],['museum',3]],
    play:[['Games & Play',10],['games',5],['arcade',5],['chess',6],['magic',5],['interactive',3],['improv',3],['comedy',3],['escape',4],['play',3]],
    explore:[['Markets & Festivals',9],['Pets & Animals',8],['market',4],['festival',5],['history',3],['historic',3],['walking',4],['tour',3],['animals',4],['rescue',4],['shop',2],['fair',2]]
  };
  function covers(e,day){return e._startKey<=day&&e._endKey>=day}
  function isAdultRestricted(e){const s=[e.title,e.description].join(' ').toLowerCase();return /\b(?:21\+|18\+|21 and (?:over|up)|18 and (?:over|up)|adults? only|age 21|age 18|must be 21|must be 18)\b/i.test(s)}
  function budgetOf(e){
    const p=String(e.price||'').toLowerCase();
    if (/\bfree\b/.test(p)&&!/\$\s*\d/.test(p)) return 0;
    if (/check|varies|unknown|tbd|donation|included with|admission required|see organizer/.test(p))return null;
    if (/\bfrom\b|\bstarting\b|\bstarts at\b|\bplus\b.*\badmission\b/.test(p))return null;
    const nums=[...p.matchAll(/\$\s*([\d,]+(?:\.\d{1,2})?)/g)].map(m=>Number(m[1].replaceAll(',',''))).filter(Number.isFinite);
    if(!nums.length)return null;
    return Math.max(...nums);
  }
  function enrich(raw){
    const now=new Date();
    return raw.filter(e=>e&&e.id&&e.title&&/^https:\/\//i.test(e.url||'')).map(e=>{
      const start=new Date(e.start),end=new Date(e.end||e.start);
      return {...e,_start:start,_end:end,_startKey:keyOf(start),_endKey:keyOf(end),_budget:budgetOf(e)};
    }).filter(e=>Number.isFinite(+e._start)&&Number.isFinite(+e._end)&&e._end>=now&&week.some(day=>covers(e,day)));
  }
  function initSelects(){
    const select=$('mood-day');
    week.forEach((day,i)=>{
      const opt=document.createElement('option');opt.value=day;
      opt.textContent=(i===0?'Today — ':i===1?'Tomorrow — ':'')+fmt(toNoon(day),{weekday:'short',month:'short',day:'numeric'});
      select.appendChild(opt);
    });
    const places=[...new Set(events.map(e=>e.area).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    for(const area of places){const o=document.createElement('option');o.value=area;o.textContent=area; $('mood-area').appendChild(o)}
  }
  function inputs(){
    const form=$('mood-form');
    return {mood:form.elements.mood.value,group:form.elements.group.value,day:$('mood-day').value,area:$('mood-area').value,budget:$('mood-budget').value};
  }
  function eligible(e,p){
    if(p.day!=='all'&&!covers(e,p.day))return false;
    if(p.area!=='all'&&e.area!==p.area)return false;
    if(p.budget!=='any'&&(e._budget===null||(p.budget==='free'?e._budget!==0:e._budget>Number(p.budget))))return false;
    if(p.group==='family'&&isAdultRestricted(e))return false;
    return true;
  }
  function score(e,p,seed){
    const hay=[e.category,e.title,e.description,e.venue].join(' ').toLowerCase();
    let points=Number(e.featured?3:0);
    const keywords=keywordRules[p.mood]||[];
    for(const [word,n] of keywords)if(hay.includes(word.toLowerCase()))points+=n;
    if(p.mood==='surprise'){points+=5;if(e.category==='Music & Jazz'||e.category==='Art & Culture')points+=2}
    if(p.group==='family'&&/all ages|family|kid|child|pet|festival|market|craft/i.test(hay))points+=3;
    if(p.group==='solo'&&/museum|gallery|tour|book|market|workshop|art/i.test(hay))points+=2;
    if(p.group==='couple'&&/jazz|music|art|book|walk|market|pottery|show/i.test(hay))points+=2;
    if(p.group==='friends'&&/game|music|festival|market|show|improv|comedy/i.test(hay))points+=2;
    const upcoming=week.findIndex(k=>covers(e,k));points+=Math.max(0,7-upcoming)*0.16;
    if(e._budget===0)points+=0.4;
    if(e.timeTBD)points-=0.7;
    // Deterministic, small remix when "another mix" is clicked; not fabricated relevance.
    let hash=seed;
    for(const ch of e.id)hash=(hash*31+ch.charCodeAt(0))>>>0;
    points+=(hash%100)/100*2.5;
    return points;
  }
  function why(e,p){
    const bits=[];
    if(p.mood!=='surprise')bits.push({'music':'Matches your music and entertainment mood','creative':'Fits your creative and curious side','play':'A playful pick for getting out','explore':'An opportunity to explore DFW'}[p.mood]);
    else bits.push('An interesting pick from this week');
    if(p.area!=='all')bits.push('in '+e.area);
    if(e._budget===0)bits.push('free entry listed');
    if(e.featured)bits.push('featured by the editors');
    return bits.join(' · ')+'.';
  }
  function chosen(p){
    let pool=events.filter(e=>eligible(e,p));
    const seen=new Set();
    pool=pool.sort((a,b)=>score(b,p,round)-score(a,p,round)||a._start-b._start).filter(e=>{
      // Prevent near-identical daily recurring sessions dominating the shortlist.
      const canonical=(e.title||'').trim().toLowerCase().replace(/[^a-z0-9]/g,'')+'|'+(e.venue||'').trim().toLowerCase();
      if(seen.has(canonical))return false;
      seen.add(canonical);return true;
    });
    return pool.slice(0,5);
  }
  function card(e,p,n){
    const day=e._startKey<today?today:e._startKey;
    const dateLabel=fmt(toNoon(day),{weekday:'short',month:'short',day:'numeric'});
    const hours=e.timeTBD?'Hours: See organizer':e._startKey!==e._endKey?'Multi-day event; check daily hours':fmt(e._start,{hour:'numeric',minute:'2-digit'});
    const details='<a href="'+esc(e.url)+'" target="_blank" rel="noopener noreferrer">Event details ↗</a>';
    const directions=e.address?'<a href="https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(e.address)+'" target="_blank" rel="noopener noreferrer">Directions ↗</a>':'';
    return '<article class="mood-result-card"><div class="mood-result-number">'+String(n+1).padStart(2,'0')+'</div><div class="mood-result-main"><span class="mood-result-category">'+esc(e.category||'Local experience')+'</span><h3>'+esc(e.title)+'</h3><p class="mood-result-why">'+esc(why(e,p))+'</p><p class="mood-result-detail">'+esc(dateLabel)+' · '+esc(hours)+' · '+esc(e.venue||'Venue details')+', '+esc(e.area||'DFW')+'</p><p>'+esc(e.description||'Check the organizer for the full details.')+'</p><p class="mood-price">'+esc(e.price||'Price: See organizer')+'</p><div class="mood-links">'+details+directions+'</div></div></article>';
  }
  function render(){
    if(!selections)return;
    const pool=chosen(selections),el=$('mood-results');
    el.hidden=false;
    $('mood-results-summary').textContent=pool.length?'Here are '+pool.length+' ideas from the current event guide, ranked for your preferences.':'No listings meet every filter yet. Widen your budget, date or area to see more options.';
    $('mood-cards').innerHTML=pool.length?pool.map((e,i)=>card(e,selections,i)).join(''):'<div class="mood-no-results"><h3>No exact match this time.</h3><p>Try “Any budget”, “Anywhere in DFW”, or another date. We will not suggest unverified events or prices.</p><button type="button" id="mood-widen">Show broader options</button></div>';
    $('mood-widen')?.addEventListener('click',()=>{$('mood-day').value='all';$('mood-area').value='all';$('mood-budget').value='any';selections=inputs();round++;render()});
    el.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  }
  $('mood-form').addEventListener('submit',event=>{event.preventDefault();selections=inputs();round=0;render()});
  $('mood-again').addEventListener('click',()=>{if(selections){round++;render()}});
  $('mood-form').addEventListener('reset',()=>{selections=null;round=0;$('mood-results').hidden=true;});
  fetch('data/events.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Event feed unavailable');return r.json()}).then(data=>{
    if(!Array.isArray(data))throw Error('Unexpected event data');
    events=enrich(data);
    initSelects();
    $('mood-submit').disabled=false;
    $('mood-loaded').textContent=events.length+' real upcoming listings ready to match.';
  }).catch(()=>{
    $('mood-loaded').textContent='Event data is unavailable. Please refresh to try again.';
    $('mood-submit').disabled=true;
  });
  $('mood-submit').disabled=true;
})();
