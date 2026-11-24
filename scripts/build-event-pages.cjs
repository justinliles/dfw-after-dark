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
 if (dayKey(d)<today && dayKey(new Date(e.end))>=today) {
  return 'Ongoing through '+new Intl.DateTimeFormat('en-US',{timeZone:zone,dateStyle:'full'}).format(new Date(e.end));
 }
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
 const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#102B36"><title>${esc(e.title)} | Out & About DFW</title><meta name="description" content="${esc(e.description||e.title)}"><link rel="canonical" href="${url}"><link rel="stylesheet" href="/styles.css">${head}
<style>
*,*::before,*::after{box-sizing:border-box}
html{max-width:100%;overflow-x:clip}
body.event-detail-page{margin:0;max-width:100%;overflow-x:clip;background:#142a35;color:#fff9ed}
.event-detail-page .event-header{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1.1rem clamp(1rem,4vw,3rem);max-width:1200px;margin:auto}
.event-detail-page .event-brand{font-size:clamp(1rem,2.5vw,1.3rem);font-weight:700;white-space:normal;min-width:0}
.event-detail-page .event-brand a{color:inherit;text-decoration:none}
.event-detail-page .event-nav{display:flex;gap:1rem;flex-wrap:wrap;align-items:center}
.event-detail-page .event-nav a{color:#dce9e8;text-decoration:none;font-size:.95rem}
.event-detail-page .event-shell{width:min(100% - 2rem,780px);margin:clamp(2rem,7vw,5rem) auto 4rem;min-width:0}
.event-detail-page .event-kicker{color:#f3c576;letter-spacing:.12em;text-transform:uppercase;font-size:.76rem;font-weight:700;line-height:1.6;overflow-wrap:anywhere}
.event-detail-page .event-title{font-family:inherit;font-size:clamp(2.1rem,7vw,4.4rem);line-height:1.08;letter-spacing:-.035em;font-weight:800;text-transform:none;margin:1.1rem 0 1.6rem;max-width:100%;overflow-wrap:anywhere;word-break:normal;hyphens:auto}
.event-detail-page .event-info{display:grid;gap:.8rem;margin:0 0 1.5rem}
.event-detail-page .event-info p{font-size:clamp(1rem,2.6vw,1.15rem);line-height:1.55;margin:0;overflow-wrap:anywhere}
.event-detail-page .event-description{font-size:1.08rem;line-height:1.75;margin:1.5rem 0 2rem;overflow-wrap:anywhere}
.event-detail-page .event-cta{display:inline-flex;align-items:center;justify-content:center;max-width:100%;min-height:3.3rem;padding:.9rem 1.3rem;border-radius:1rem;background:#f18a73;color:#142a35;text-decoration:none;font-weight:750;text-align:center;overflow-wrap:anywhere}
.event-detail-page .event-note{font-size:.9rem;line-height:1.6;color:#cad8d7;margin-top:1.3rem}
.event-detail-page .event-back{display:inline-block;margin-top:1.3rem;color:#fff9ed;text-underline-offset:4px}
@media(max-width:600px){
.event-detail-page .event-header{padding:1rem;align-items:flex-start;flex-direction:column;gap:.7rem}
.event-detail-page .event-nav{gap:1.1rem}
.event-detail-page .event-nav a{font-size:.86rem}
.event-detail-page .event-shell{width:calc(100% - 2rem);margin:2.25rem auto 3rem}
.event-detail-page .event-title{font-size:clamp(2rem,10vw,2.8rem);line-height:1.12;letter-spacing:-.025em;margin:.8rem 0 1.5rem}
.event-detail-page .event-cta{width:100%}
}
</style></head><body class="event-detail-page"><header class="event-header"><div class="event-brand"><a href="/">✳ Out &amp; About DFW</a></div><nav class="event-nav" aria-label="Event navigation"><a href="/">Home</a><a href="/events.html">All events</a><a href="/mood.html">Mood Finder</a></nav></header><main class="event-shell"><p class="event-kicker">${esc(e.category||'Local event')} · ${esc(e.area)}</p><h1 class="event-title">${esc(e.title)}</h1><div class="event-info"><p>📅 ${esc(dateLabel(e))}${e.timeTBD?' · Hours: See organizer':''}</p><p>📍 ${esc(e.venue)} · ${esc(e.address)}</p><p>🎟 ${esc(e.price||'Price: See organizer')}</p></div><p class="event-description">${esc(e.description||'')}</p><a class="event-cta" href="${esc(e.url)}" rel="noopener noreferrer" target="_blank">Official event details ↗</a><p class="event-note">Confirm schedule, admission policies and tickets with the organizer.</p><a class="event-back" href="/events.html">← Browse more DFW events</a></main></body></html>`;
 fs.writeFileSync(path.join(eventDir,slug),html);
}
for(const filename of fs.readdirSync(eventDir)) {
 if(filename.endsWith('.html')&&!keep.has(filename)) fs.unlinkSync(path.join(eventDir,filename));
}
const indexPath=path.join(root,'index.html');
let index=fs.readFileSync(indexPath,'utf8');
// Prefer future, confirmed-time featured events and avoid hard-coded daily IDs.
const now = Date.now();
const upcoming=active.filter(e=>!e.timeTBD&&Date.parse(e.end)>=now);
const featured=upcoming.filter(e=>e.featured);
const ordered=[...featured,...upcoming].filter((e,i,a)=>a.findIndex(x=>x.id===e.id)===i);
const shortlist=[];
for(const e of ordered) {
 if(shortlist.length===3)break;
 if(!shortlist.some(x=>dayKey(new Date(x.start))===dayKey(new Date(e.start))))shortlist.push(e);
}
for(const e of ordered) {
 if(shortlist.length===3)break;
 if(!shortlist.some(x=>x.id===e.id))shortlist.push(e);
}
const cards=shortlist.map(e=>'<article class="home-pick"><span class="home-pick-date">'+esc(dateLabel(e))+'</span><h3><a href="/event/'+encodeURIComponent(e.id)+'.html">'+esc(e.title)+'</a></h3><p>'+esc(e.venue)+' · '+esc(e.area)+'</p><p>'+esc(e.price||'Price: See organizer')+'</p><p>'+esc(e.description||'')+'</p><a href="/event/'+encodeURIComponent(e.id)+'.html">Event details ↗</a></article>').join('');
index=index.replace(/(<div id="home-cards"[^>]*>)[\s\S]*?(<\/div><\/section>)/,(_,open,close)=>open+cards+close);
index=index.replace(/(<p id="home-status"[^>]*>)[\s\S]*?(<\/p>)/,(_,open,close)=>open+'Updated daily · '+shortlist.length+' handpicked DFW plans'+close);
fs.writeFileSync(indexPath,index);
const urls=[...staticPaths,...active.map(e=>'/event/'+encodeURIComponent(e.id)+'.html')];
const sitemap='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+urls.map(u=>'<url><loc>'+base+u+'</loc></url>').join('\n')+'\n</urlset>\n';
fs.writeFileSync(path.join(root,'sitemap.xml'),sitemap);
fs.writeFileSync(path.join(root,'robots.txt'),'User-agent: *\nAllow: /\nSitemap: '+base+'/sitemap.xml\n');
console.log(JSON.stringify({today,last,sourceCount:events.length,activeCount:active.length,shortlist:shortlist.map(e=>e.id),sitemapUrls:urls.length}));
