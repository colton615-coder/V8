
const SCREENS = ["home","add","ledger","budgets","stats","recurring","settings"];
const DB_NAME='colt-app', DB_VERSION=10; let idb;
function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=(e)=>{const db=e.target.result;
 if(!db.objectStoreNames.contains('transactions')){const s=db.createObjectStore('transactions',{keyPath:'id',autoIncrement:true});s.createIndex('byDate','date');}
 if(!db.objectStoreNames.contains('meta')) db.createObjectStore('meta',{keyPath:'key'});
 if(!db.objectStoreNames.contains('recurrings')) db.createObjectStore('recurrings',{keyPath:'id',autoIncrement:true});};
 r.onsuccess=()=>{idb=r.result;res(idb)}; r.onerror=()=>rej(r.error)})}
const store=(n,m='readonly')=>idb.transaction([n],m).objectStore(n);
const setMeta=(k,v)=>new Promise((res,rej)=>{const r=store('meta','readwrite').put({key:k,value:v});r.onsuccess=()=>res(true);r.onerror=()=>rej(r.error)});
const getMeta=(k)=>new Promise((res,rej)=>{const r=store('meta').get(k);r.onsuccess=()=>res(r.result?.value);r.onerror=()=>rej(r.error)});
const addTx=(o)=>new Promise((res,rej)=>{const r=store('transactions','readwrite').add(o);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const allTx=()=>new Promise((res,rej)=>{const r=store('transactions').getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)});
const delTx=(id)=>new Promise((res,rej)=>{const r=store('transactions','readwrite').delete(id);r.onsuccess=()=>res(true);r.onerror=()=>rej(r.error)});
const $=(s)=>document.querySelector(s);
const fmt=(n)=>`$${(Math.round(n*100)/100).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const todayISO=()=>new Date().toISOString().slice(0,10);
const ymKey=(d)=>{const dt=new Date(d);return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`};

function setupTabs(){const screens=SCREENS.map(id=>document.getElementById(id));
function show(id){screens.forEach(s=>s.classList.toggle('active',s.id===id));document.querySelectorAll('.tabbar button').forEach(b=>b.classList.toggle('active',b.dataset.screen===id));window.scrollTo({top:0,behavior:'instant'})}
document.querySelectorAll('.tabbar button').forEach(b=>b.addEventListener('click',()=>show(b.dataset.screen)));
document.body.addEventListener('click',(e)=>{const t=e.target.closest('[data-screen]'); if(!t) return; const s=t.getAttribute('data-screen'); if(SCREENS.includes(s)) show(s);});}

async function renderRecent(){const list=$('#recentList'); if(!list) return; const all=(await allTx()).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5); list.innerHTML='';
for(const t of all){const pos=t.type==='income'; const li=document.createElement('li'); li.innerHTML=`<div><span class="badge">${t.category||t.type}</span><div class="meta">${new Date(t.date).toLocaleDateString()}</div></div><div><span class="amount mono ${pos?'pos':'neg'}">${pos?'+':'-'}${fmt(Math.abs(t.amount))}</span></div>`; list.append(li);}}
async function renderLedger(){const list=$('#txList'); if(!list) return; list.innerHTML=''; const all=(await allTx()).sort((a,b)=>new Date(b.date)-new Date(a.date)); for(const t of all){const pos=t.type==='income'; const li=document.createElement('li'); li.innerHTML=`<div><span class="badge">${t.category||t.type}</span><div class="meta">${new Date(t.date).toLocaleDateString()}${t.note?` • ${t.note}`:''}</div></div><div><span class="amount mono ${pos?'pos':'neg'}">${pos?'+':'-'}${fmt(Math.abs(t.amount))}</span></div>`; const del=document.createElement('button'); del.className='ghost'; del.type='button'; del.textContent='✕'; del.style.cssText='grid-column:1 / -1; justify-self:end'; del.onclick=async()=>{await delTx(t.id); renderAll();}; li.append(del); list.append(li);}}
async function renderCatBudgets(){const list=$('#catBudgetsList'); if(!list) return; list.innerHTML=''; const budgets=(await getMeta('catBudgets'))||{}; const spent={}, ym=ymKey(new Date()); const all=await allTx();
for(const t of all){if(t.type!=='expense'||ymKey(t.date)!==ym) continue; const c=(t.category||'').trim(); spent[c]=(spent[c]||0)+Number(t.amount||0)}
const cats=Object.keys(budgets).sort((a,b)=>a.localeCompare(b)); for(const c of cats){const b=Number(budgets[c]||0), s=Number(spent[c]||0); const pct=b>0?Math.round((s/b)*100):0; const li=document.createElement('li'); li.innerHTML=`<div class="badge">${c}</div><div><div class="bar ${pct>=100?'over':(pct>=80?'warn':'')}"><div class="fill" style="height:6px;width:${Math.min(100,(b?(s/b)*100:0))}%;background:${pct>=100?'#ef4444':(pct>=80?'#f59e0b':'#22c55e')}"></div></div><div class="meta">${fmt(s)} / ${fmt(b)} • ${pct}%</div></div>`; list.append(li);}}

function drawBars(ctx,labels,values,goal){const W=ctx.canvas.width,H=ctx.canvas.height; ctx.clearRect(0,0,W,H); const css=getComputedStyle(document.documentElement); ctx.fillStyle=css.getPropertyValue('--card')||'#0a0a0a'; ctx.fillRect(0,0,W,H); const pad=14,axis=14,innerW=W-pad*2,innerH=H-pad*2-axis; const maxVal=Math.max(...values,goal||0,10); const barW=Math.max(4,innerW/values.length*.7); const step=innerW/values.length; ctx.strokeStyle=css.getPropertyValue('--border')||'#1f1f1f'; ctx.lineWidth=1; for(let i=0;i<=2;i++){const y=pad+innerH-(innerH*i/2); ctx.beginPath(); ctx.moveTo(pad,y); ctx.lineTo(W-pad,y); ctx.stroke();} if(goal&&goal>0){const y=pad+innerH-(innerH*goal/maxVal); ctx.strokeStyle='#ef4444'; ctx.setLineDash([4,4]); ctx.beginPath(); ctx.moveTo(pad,y); ctx.lineTo(W-pad,y); ctx.stroke(); ctx.setLineDash([]);} ctx.fillStyle='#4ade80'; values.forEach((v,i)=>{const x=pad+i*step+(step-barW)/2; const h=innerH*(v/maxVal); ctx.fillRect(x,pad+innerH-h,barW,Math.max(2,h));}); ctx.fillStyle='#9ca3af'; ctx.font='9px -apple-system, Inter, sans-serif'; labels.forEach((lb,i)=>{ if(i%Math.ceil(labels.length/8)!==0) return; ctx.fillText(lb,pad+i*step,H-2);});}
async function drawChart(){const c=document.getElementById('chart'); const ctx=c.getContext('2d'); const all=await allTx(); const now=new Date(); const ym=ymKey(now); const days=new Date(now.getFullYear(),now.getMonth()+1,0).getDate(); const vals=Array.from({length:days},()=>0); for(const t of all){ if(t.type!=='expense') continue; if(ymKey(t.date)!==ym) continue; vals[new Date(t.date).getDate()-1]+=Number(t.amount||0);} const labels=vals.map((_,i)=>String(i+1)); const spent=vals.reduce((a,b)=>a+b,0); const goal=Number(document.getElementById('budgetGoal').value || await getMeta('budgetGoal') || 0); drawBars(ctx,labels,vals,goal); document.getElementById('sumEffective').textContent=fmt(goal||0); document.getElementById('sumSpent').textContent=fmt(spent);}

function setupForms(){const qf=document.getElementById('quickForm'); qf.addEventListener('submit',async(e)=>{e.preventDefault(); const fd=new FormData(qf); const obj={type:fd.get('type'),amount:Number(fd.get('amount')),category:fd.get('category'),date:todayISO(),note:fd.get('note')||''}; if(!obj.amount||obj.amount<=0) return alert('Amount must be > 0'); await addTx(obj); qf.reset(); await renderAll();});
const catForm=document.getElementById('budgetCatForm'); catForm.addEventListener('submit',async(e)=>{e.preventDefault(); const fd=new FormData(catForm); const cat=(fd.get('cat')||'').trim(); const amt=Number(fd.get('amt')); if(!cat||!amt||amt<=0) return alert('Enter a category and a budget > 0'); const budgets=(await getMeta('catBudgets'))||{}; budgets[cat]=amt; await setMeta('catBudgets',budgets); catForm.reset(); await renderCatBudgets();});
document.getElementById('budgetGoal').addEventListener('change',async(e)=>{await setMeta('budgetGoal',Number(e.target.value||0)); drawChart();});
document.getElementById('themeToggle').addEventListener('change',async(e)=>{document.documentElement.dataset.theme=e.target.checked?'light':'dark'; await setMeta('theme',document.documentElement.dataset.theme);});}

async function refreshHome(){const all=await allTx(); const ym=ymKey(new Date()); let inc=0,exp=0; for(const t of all){ if(ymKey(t.date)!==ym) continue; if(t.type==='income') inc+=Number(t.amount||0); else exp+=Number(t.amount||0);} document.getElementById('homeIncome').textContent=fmt(inc); document.getElementById('homeExpenses').textContent=fmt(exp); document.getElementById('homeNet').textContent=fmt(inc-exp);}
async function renderAll(){await renderRecent(); await renderLedger(); await renderCatBudgets(); await drawChart();}

function setupSW(){if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js'));}}
async function initTheme(){const t=(await getMeta('theme'))||'dark'; document.documentElement.dataset.theme=t;}
(function boot(){openDB().then(()=>{setupTabs(); setupSW(); setupForms(); initTheme().then(renderAll);}).catch(()=>alert('IndexedDB failed.'));})();
