/* Build-time static event pages and sitemap. No API credentials or network calls. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const base = 'https://dfwdaily.midnightmeta.dev';
const zone = 'America/Chicago';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dayKey = date => {
 const p = new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 const get = k => p.find(x=>x.type===k).value;
 return get('year')+'-'+get('month')+'-'+get('day');
};
const today = dayKey(new Date());
const after = n => {const [y,m,d]=today.split('-').map(Number);return new Date(Date.UTC(y,m-1,d+n,18));};
const last = dayKey(after(6));
const events = JSON.parse(fs.readFileSync(path.join(root,'data/events.json'),'utf8'));
if(!Array.isArray(events)) throw Error('Expected array of events');
const valid = events.filter(e=>e && e.id && e.title && e.venue && e.area && e.address && /^https:\/\//.test(e.url||'') && Number.isFinite(Date.parse(e.start)) && Number.isFinite(Date.parse(e.end)) && Date.parse(e.end)>=Date.parse(e.start) && dayKey(new Date(e.end))>=today && dayKey(new Date(e.start))<=last);
const unique = new Map(valid.map(e=>[e.id,e]));
const active = [...unique.values()].sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
const eventDir = path.join(root,'event');
fs.mkdirSync(eventDir,{recursive:true});
const keep = new Set();
const staticPaths = ['/','/events.html','/search.html','/mood.html','/how-it-works.html','/changelog.html'];
function dateLabel(e) {
 const d = new Date(e.start);
 return new Intl.DateTimeFormat('en-US',{timeZone:zone,dateStyle:'full',...(e.timeTBD?{}:{timeStyle:'short'})}).format(d);
}
function schemaFor(e,url) {
 // Do not use date-local midnight placeholders as confirmed event hours in structured data.
 if(e.timeTBD) return null;
 const schema = {'@context':'https://schema.org','@type':'Event',name:e.title,startDate:e.start,endDate:e.end,eventStatus:'https://schema.org/EventScheduled',eventAttendanceMode:'https://schema.org/OfflineEventAttendanceMode',url,description:e.description||e.title,location:{'@type':'Place',name:e.venue,address:{'@type':'PostalAddress',streetAddress:e.address,addressLocality:e.area,addressRegion:'TX',addressCountry:'US'}}};
 // Price strings with ranges/fees are not safe numeric offers; never infer availability.
 if(/^free$/i.test(String(e.price||'').trim())) schema.isAccessibleForFree=true;
 return schema;
}
for(const e of active) {
 if(!/^[a-z0-9][a-z0-9_-]*$/i.test(e.id)) throw Error('Unsafe event id: '+e.id);
 const slug=e.id+'.html';keep.add(slug);
 const url=base+'/event/'+encodeURIComponent(slug);
 const json=schemaFor(e,url);
 const head=json?'<script type="application/ld+json">'+JSON.stringify(json).replace(/</g,'\\u003c')+'</script>':'';
 const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(e.title)+' | Out & About DFW</title><meta name="description" content="'+esc(e.description||e.title)+'"><link rel="canonical" href="'+url+'"><link rel="stylesheet" href="/styles.css">'+head+'</head><body><header class="top"><a class="brand" href="/">✳ Out &amp; About DFW</a><nav class="site-nav"><a href="/">Home</a><a href="/events.html">All events</a><a href="/mood.html">Mood Finder</a></nav></header><main class="wrap home-section"><p class="change-eyebrow">'+esc(e.category||'Local event')+' · '+esc(e.area)+'</p><h1>'+esc(e.title)+'</h1><p>'+esc(dateLabel(e))+(e.timeTBD?' · Hours: See organizer':'')+'</p><p>'+esc(e.venue)+' · '+esc(e.address)+'</p><p>'+esc(e.price||'Price: See organizer')+'</p><p>'+esc(e.description||'')+'</p><a class="home-button primary" href="'+esc(e.url)+'" rel="noopener noreferrer" target="_blank">Official event details ↗</a><p>Confirm schedule, admission policies and tickets with the organizer.</p><p><a href="/events.html">Browse more DFW events →</a></p></main></body></html>';
 fs.writeFileSync(path.join(eventDir,slug),html);
}
for(const filename of fs.readdirSync(eventDir)) {
 if(filename.endsWith('.html')&&!keep.has(filename)) fs.unlinkSync(path.join(eventDir,filename));
}
const indexPath=path.join(root,'index.html');
let index=fs.readFileSync(indexPath,'utf8');
const featured=active.filter(e=>e.featured&&!e.timeTBD);
const shortlist=[...featured,...active.filter(e=>!e.timeTBD)].filter((e,i,a)=>a.findIndex(x=>x.id===e.id)===i).slice(0,3);
const cards=shortlist.map(e=>'<article class="home-pick"><span class="home-pick-date">'+esc(dateLabel(e))+'</span><h3><a href="/event/'+encodeURIComponent(e.id)+'.html">'+esc(e.title)+'</a></h3><p>'+esc(e.venue)+' · '+esc(e.area)+'</p><p>'+esc(e.price||'Price: See organizer')+'</p><p>'+esc(e.description||'')+'</p><a href="/event/'+encodeURIComponent(e.id)+'.html">Event details ↗</a></article>').join('');
index=index.replace(/(<div id="home-cards"[^>]*>)[\s\S]*?(<\/div><\/section>)/,(_,open,close)=>open+cards+close);
index=index.replace(/(<p id="home-status"[^>]*>)[\s\S]*?(<\/p>)/,(_,open,close)=>open+'Updated daily · '+shortlist.length+' handpicked DFW plans'+close);
fs.writeFileSync(indexPath,index);
const urls=[...staticPaths,...active.map(e=>'/event/'+encodeURIComponent(e.id)+'.html')];
const sitemap='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+urls.map(u=>'<url><loc>'+base+u+'</loc></url>').join('\n')+'\n</urlset>\n';
fs.writeFileSync(path.join(root,'sitemap.xml'),sitemap);
fs.writeFileSync(path.join(root,'robots.txt'),'User-agent: *\nAllow: /\nSitemap: '+base+'/sitemap.xml\n');
console.log(JSON.stringify({today,last,sourceCount:events.length,activeCount:active.length,shortlist:shortlist.map(e=>e.id),sitemapUrls:urls.length}));
