// Export the last-24h real ingested feed to a static HTML page for local preview.
import { Pool } from 'pg';
import { writeFileSync } from 'node:fs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const rows = (await pool.query(`
  SELECT a.risk_level AS risk, a.categories, a.summary, a.urgency_score AS urgency,
         a.affected_sectors AS sectors, a.confirmed, a.notification_title AS title,
         COALESCE(rs.confirmation_count,0) AS confirmations,
         rs.content, rs.source_url AS url, rs.stated_at AS "statedAt",
         s.name AS source, s.source_group AS grp, s.source_kind AS kind,
         COALESCE(sr.reliability_score,50) AS reliability
  FROM processed_alerts a
  JOIN raw_statements rs ON rs.id = a.raw_statement_id
  JOIN sources s ON s.id = rs.source_id
  LEFT JOIN source_reliability sr ON sr.source_id = s.id
  WHERE rs.stated_at > now() - interval '24 hours'
  ORDER BY rs.stated_at DESC
  LIMIT 400
`)).rows;

const generatedAt = new Date().toISOString();
const data = JSON.stringify(rows);

const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Trump Trading — Backend 24h Check</title>
<style>
:root{--bg:#0B0F14;--surface:#121821;--surface2:#1A2230;--border:#243044;--critical:#E53935;--high:#FB8C00;--medium:#FDD835;--low:#66BB6A;--accent:#3D8BFD;--text:#E6EBF2;--text2:#8A97A8}
*{box-sizing:border-box;margin:0;padding:0}body{background:var(--bg);color:var(--text);font-family:'Segoe UI',system-ui,sans-serif;padding-bottom:40px}
header{background:var(--surface);border-bottom:1px solid var(--border);padding:14px 18px;position:sticky;top:0;z-index:10}
h1{font-size:18px}.sub{font-size:12px;color:var(--text2);margin-top:3px}
.bar{background:var(--surface2);border-bottom:1px solid var(--border);padding:8px 18px;font-size:12px;color:var(--text2);display:flex;gap:18px;flex-wrap:wrap}
.bar b{color:var(--text)}
.filters{padding:12px 18px;display:flex;gap:7px;flex-wrap:wrap}
.fbtn{padding:5px 13px;border-radius:20px;border:1px solid var(--border);background:transparent;color:var(--text2);font-size:12px;cursor:pointer}
.fbtn.active{background:var(--accent);border-color:var(--accent);color:#fff}
.fbtn.active[data-r=Critical]{background:var(--critical);border-color:var(--critical)}
.fbtn.active[data-r=High]{background:var(--high);border-color:var(--high);color:#111}
.fbtn.active[data-r=Medium]{background:var(--medium);border-color:var(--medium);color:#111}
.feed{max-width:880px;margin:0 auto;padding:8px 18px;display:flex;flex-direction:column;gap:11px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden}
.acc{height:3px}.body{padding:13px 15px}
.top{display:flex;justify-content:space-between;gap:10px;margin-bottom:7px}
.title{font-size:14px;font-weight:600;line-height:1.4;flex:1}
.pill{font-size:10px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;padding:3px 9px;border-radius:20px;white-space:nowrap;height:fit-content}
.Critical{background:rgba(229,57,53,.18);color:var(--critical)}.High{background:rgba(251,140,0,.18);color:var(--high)}.Medium{background:rgba(253,216,53,.18);color:var(--medium)}.Low{background:rgba(102,187,106,.18);color:var(--low)}
.src{font-size:11px;color:var(--text2);margin-bottom:7px;display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.dot{width:5px;height:5px;border-radius:50%;background:var(--accent)}
.official{color:var(--low);font-weight:700}.confirmed{color:var(--low)}.unconfirmed{color:var(--medium)}
.summary{font-size:12.5px;color:var(--text2);line-height:1.5;margin-bottom:9px}
.foot{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;align-items:center}
.cats{display:flex;gap:5px;flex-wrap:wrap}
.cat{font-size:10px;background:rgba(61,139,253,.12);border:1px solid rgba(61,139,253,.3);color:var(--accent);padding:2px 7px;border-radius:4px}
.time{font-size:11px;color:var(--text2)}.empty{text-align:center;padding:40px;color:var(--text2)}
a.link{color:var(--accent);font-size:11px;text-decoration:none}
</style></head><body>
<header><h1>🇺🇸 Trump Trading — Backend 24-Hour Check</h1>
<div class="sub">Real data ingested by the backend (processed_alerts joined with raw_statements). Snapshot, not live.</div></header>
<div class="bar" id="stats"></div>
<div class="filters" id="filters"></div>
<div class="feed" id="feed"></div>
<script>
const DATA=${data};
const GEN=new Date(${JSON.stringify(generatedAt)});
function cairo(d){return new Date(d).toLocaleString('en-US',{timeZone:'Africa/Cairo',weekday:'short',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false})+' Cairo'}
function rel(d){const m=Math.floor((Date.now()-new Date(d))/60000);if(m<1)return'just now';if(m<60)return m+' min ago';const h=Math.floor(m/60);if(h<24)return h+'h ago';return Math.floor(h/24)+'d ago'}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
let filter='all';
function stats(){const c={Critical:0,High:0,Medium:0,Low:0};const srcs=new Set();DATA.forEach(x=>{c[x.risk]=(c[x.risk]||0)+1;srcs.add(x.source)});
document.getElementById('stats').innerHTML='<span><b>'+DATA.length+'</b> items / 24h</span><span><b>'+srcs.size+'</b> sources</span><span style="color:var(--critical)"><b>'+c.Critical+'</b> Critical</span><span style="color:var(--high)"><b>'+c.High+'</b> High</span><span style="color:var(--medium)"><b>'+c.Medium+'</b> Medium</span><span style="color:var(--low)"><b>'+c.Low+'</b> Low</span><span>snapshot '+cairo(GEN)+'</span>'}
function filters(){const rs=['all','Critical','High','Medium','Low'];document.getElementById('filters').innerHTML=rs.map(r=>'<button class="fbtn '+(filter===r?'active':'')+'" data-r="'+r+'" onclick="setF(\\''+r+'\\')">'+(r==='all'?'All':r)+'</button>').join('')}
function setF(r){filter=r;render()}
function render(){stats();filters();let list=filter==='all'?DATA:DATA.filter(x=>x.risk===filter);const f=document.getElementById('feed');
if(!list.length){f.innerHTML='<div class="empty">No items in this filter.</div>';return}
const col={Critical:'#E53935',High:'#FB8C00',Medium:'#FDD835',Low:'#66BB6A'};
f.innerHTML=list.map(x=>{const off=x.kind==='direct_official';const conf=x.confirmed||x.confirmations>0;
return '<div class="card"><div class="acc" style="background:'+col[x.risk]+'"></div><div class="body">'+
'<div class="top"><div class="title">'+esc(x.title||x.content.slice(0,90))+'</div><div class="pill '+x.risk+'">'+x.risk+'</div></div>'+
'<div class="src"><span class="dot"></span>'+esc(x.source)+(off?' · <span class="official">OFFICIAL</span>':'')+' · <span class="'+(conf?'confirmed':'unconfirmed')+'">'+(conf?'✓ confirmed ('+(x.confirmations+1)+' src)':'○ unconfirmed')+'</span> · urgency '+x.urgency+' · rel '+x.reliability+'</div>'+
'<div class="summary">'+esc(x.content.slice(0,220))+'</div>'+
'<div class="foot"><div class="cats">'+(x.categories||[]).map(c=>'<span class="cat">'+esc(c)+'</span>').join('')+'</div>'+
'<div class="time" title="'+cairo(x.statedAt)+'">🕐 '+rel(x.statedAt)+' · Cairo'+(x.url?' · <a class="link" href="'+x.url+'" target="_blank">open ↗</a>':'')+'</div></div>'+
'</div></div>'}).join('')}
render();
</script></body></html>`;

writeFileSync(process.argv[2], html);
console.log(`wrote ${rows.length} items to ${process.argv[2]}`);
await pool.end();
