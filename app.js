/* Colt iOS PWA — V1.8
   Ultra-dense split: Home / Add / Ledger / Budgets / Stats / Settings.
   Button reliability: delegated tap handler + type=button on all nav controls.
*/
const SCREENS = ["home","add","ledger","budgets","stats","settings"];
const DB_NAME = 'colt-app'; const DB_VERSION = 9;
let idb;

// ---------- DB ----------
function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(DB_NAME, DB_VERSION);r.onupgradeneeded=(e)=>{const db=e.target.result;
  if(!db.objectStoreNames.contains('transactions')){const s=db.createObjectStore('transactions',{keyPath:'id',autoIncrement:true});s.createIndex('byDate','date');}
  if(!db.objectStoreNames.contains('meta')) db.createObjectStore('meta',{keyPath:'key'});
  if(!db.objectStoreNames.contains('tasks')) db.createObjectStore('tasks',{keyPath:'id',autoIncrement:true});
};r.onsuccess=()=>{idb=r.result;res(idb);};r.onerror=()=>rej(r.error);});}
const store=(name,mode='readonly')=>idb.transaction([name],mode).objectStore(name);
const setMeta=(key,value)=>new Promise((res,rej)=>{const r=store('meta','readwrite').put({key,value});r.onsuccess=()=>res(true);r.onerror=()=>rej(r.error);});
const getMeta=(key)=>new Promise((res,rej)=>{const r=store('meta').get(key);r.onsuccess=()=>res(r.result?.value);r.onerror=()=>rej(r.error);});
const addTx=(o)=>new Promise((res,rej)=>{const r=store('transactions','readwrite').add(o);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
const allTx=()=>new Promise((res,rej)=>{const r=store('transactions').getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error);});
const delTx=(id)=>new Promise((res,rej)=>{const r=store('transactions','readwrite').delete(id);r.onsuccess=()=>res(true);r.onerror=()=>rej(r.error);});

// ---------- Utils ----------
const $=(sel)=>document.querySelector(sel);
const el=(t,a={},...c)=>{const n=document.createElement(t);for(const[k,v]of Object.entries(a)){if(k==='class')n.className=v;else if(k==='dataset')Object.assign(n.dataset,v);else if(k.startsWith('on'))n.addEventListener(k.slice(2),v);else if(v!=null)n.setAttribute(k,v);}for(const x of c)n.append(x instanceof Node?x:document.createTextNode(String(x)));return n;};
const fmt=(n)=>`$${(Math.round(n*100)/100).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const todayISO=()=>new Date().toISOString().slice(0,10);
const ymKey=(d)=>{const dt=new Date(d);return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;};

// ---------- Navigation (bulletproof) ----------
function setupTabs(){
  const screens = SCREENS.map(id=>document.getElementById(id));
  const buttons = Array.from(document.querySelectorAll('.tabbar button'));
  function show(id){
    screens.forEach(s=>s.classList.toggle('active', s.id===id));
    buttons.forEach(b=>b.classList.toggle('active', b.dataset.screen===id));
    window.scrollTo({top:0, behavior:'instant'});
  }
  // Pointer first for instant feel
  document.body.addEventListener('pointerdown', (e)=>{
    const t=e.target.closest('[data-screen]'); if(!t) return;
    e.preventDefault(); const s=t.getAttribute('data-screen'); if(SCREENS.includes(s)) show(s);
  });
}

// ---------- Renderers ----------
async function renderRecent(){
  const list=$('#recentList'); if(!list) return;
  const all=(await allTx()).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,3);
  list.innerHTML='';
  for(const t of all){
    list.append(el('li',{},
      el('div',{}, el('span',{class:'badge'}, t.category||t.type), el('div',{class:'meta'}, new Date(t.date).toLocaleDateString())),
      el('div',{}, el('span',{class:`amount mono ${t.type==='income'?'pos':'neg'}`}, `${t.type==='income'?'+':'-'}${fmt(Math.abs(t.amount))}`))
    ));
  }
}
async function renderLedger(){
  const list=$('#txList'); if(!list) return; list.innerHTML='';
  const all=(await allTx()).sort((a,b)=>new Date(b.date)-new Date(a.date));
  for(const t of all){
    const right=el('div',{}, el('span',{class:`amount mono ${t.type==='income'?'pos':'neg'}`}, `${t.type==='income'?'+':'-'}${fmt(Math.abs(t.amount))}`));
    const left = el('div',{}, el('span',{class:'badge'}, t.category||t.type), el('div',{class:'meta'}, new Date(t.date).toLocaleDateString(), t.note?` • ${t.note}`:''));
    const li=el('li',{}, left, right);
    li.append(el('button',{class:'ghost',style:'grid-column:1 / -1; justify-self:end',type:'button',onclick:async()=>{await delTx(t.id); renderAll();}},'✕'));
    list.append(li);
  }
}

// ---------- Budgets ----------
async function catBudgets(){return (await getMeta('catBudgets'))||{};}
async function setCatBudget(cat,amt){const all=await catBudgets();all[cat]=Number(amt)||0;await setMeta('catBudgets',all);}
async function delCatBudget(cat){const all=await catBudgets();delete all[cat];await setMeta('catBudgets',all);}
async function spendByCatCurrent(){ const all=await allTx(); const ym=ymKey(new Date()); const sums={}; for(const t of all){ if(t.type!=='expense'||ymKey(t.date)!==ym) continue; const c=(t.category||'').trim(); sums[c]=(sums[c]||0)+Number(t.amount||0);} return sums; }
function barClass(p){ if(p>=100) return 'bar over'; if(p>=80) return 'bar warn'; return 'bar'; }
async function renderCatBudgets(){ const list=$('#catBudgetsList'); list.innerHTML=''; const budgets=await catBudgets(); const spent=await spendByCatCurrent(); const cats=Object.keys(budgets).sort((a,b)=>a.localeCompare(b));
  for(const c of cats){ const b=Number(budgets[c]||0), s=Number(spent[c]||0); const pct=b>0?Math.round((s/b)*100):0;
    const row=el('li',{},
      el('div',{class:'budget-row'}, el('div',{class:'badge'},c), el('button',{class:'ghost',type:'button',onclick:async()=>{await delCatBudget(c); renderCatBudgets();}},'✕')),
      el('div',{class:barClass(pct)}, el('div',{class:'fill',style:`width:${Math.min(100,(b?(s/b)*100:0))}%`})),
      el('div',{class:'budget-meta'}, `${fmt(s)} / ${fmt(b)} • ${pct}%`)
    );
    list.append(row);
  }}

// ---------- Chart (very slim) ----------
function drawBars(ctx,labels,values,goal){
  const W=ctx.canvas.width,H=ctx.canvas.height; ctx.clearRect(0,0,W,H);
  const css=getComputedStyle(document.documentElement); ctx.fillStyle=css.getPropertyValue('--card')||'#0a0a0a'; ctx.fillRect(0,0,W,H);
  const pad=14,axis=14,innerW=W-pad*2,innerH=H-pad*2-axis; const maxVal=Math.max(...values,goal||0,10); const barW=Math.max(4, innerW/values.length*.7); const step=innerW/values.length;
  ctx.strokeStyle=css.getPropertyValue('--border')||'#1f1f1f'; ctx.lineWidth=1;
  for(let i=0;i<=2;i++){const y=pad+innerH-(innerH*i/2); ctx.beginPath(); ctx.moveTo(pad,y); ctx.lineTo(W-pad,y); ctx.stroke();}
  if(goal&&goal>0){const y=pad+innerH-(innerH*goal/maxVal); ctx.strokeStyle='#ef4444'; ctx.setLineDash([4,4]); ctx.beginPath(); ctx.moveTo(pad,y); ctx.lineTo(W-pad,y); ctx.stroke(); ctx.setLineDash([]);}
  ctx.fillStyle='#4ade80'; values.forEach((v,i)=>{const x=pad+i*step+(step-barW)/2; const h=innerH*(v/maxVal); ctx.fillRect(x,pad+innerH-h,barW,Math.max(2,h));});
  ctx.fillStyle='#9ca3af'; ctx.font='9px -apple-system, Inter, sans-serif'; labels.forEach((lb,i)=>{ if(i%Math.ceil(labels.length/8)!==0) return; ctx.fillText(lb,pad+i*step,H-2);});
}
async function drawChart(){
  const c=$('#chart'); const ctx=c.getContext('2d'); const all=await allTx(); const now=new Date(); const ym=ymKey(now);
  const days=new Date(now.getFullYear(),now.getMonth()+1,0).getDate(); const vals=Array.from({length:days},()=>0);
  for(const t of all){ if(t.type!=='expense') continue; if(ymKey(t.date)!==ym) continue; vals[new Date(t.date).getDate()-1]+=Number(t.amount||0); }
  const labels=vals.map((_,i)=>String(i+1)); const spent=vals.reduce((a,b)=>a+b,0);
  const goal=Number($('#budgetGoal').value || await getMeta('budgetGoal') || 0);
  drawBars(ctx,labels,vals,goal);
  $('#sumEffective').textContent=fmt(goal||0); $('#sumSpent').textContent=fmt(spent);
}

// ---------- Forms ----------
function setupForms(){
  const qf=$('#quickForm');
  qf.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const fd=new FormData(qf);
    const obj={ type:fd.get('type'), amount:Number(fd.get('amount')), category:fd.get('category'), date:todayISO(), note:fd.get('note')||'' };
    if(!obj.amount||obj.amount<=0) return alert('Amount must be > 0');
    await addTx(obj); qf.reset(); await renderAll();
  });

  const catForm=$('#budgetCatForm');
  catForm.addEventListener('submit', async(e)=>{
    e.preventDefault();
    const fd=new FormData(catForm); const cat=(fd.get('cat')||'').trim(); const amt=Number(fd.get('amt'));
    if(!cat||!amt||amt<=0) return alert('Enter a category and a budget > 0');
    await setCatBudget(cat,amt); catForm.reset(); await renderCatBudgets();
  });

  $('#budgetGoal').addEventListener('change', async(e)=>{ await setMeta('budgetGoal', Number(e.target.value||0)); drawChart(); });
  $('#themeToggle').addEventListener('change', async(e)=>{ document.documentElement.dataset.theme=e.target.checked?'light':'dark'; await setMeta('theme',document.documentElement.dataset.theme); });
}

// ---------- RenderAll ----------
async function refreshHome(){ await renderRecent(); const all=await allTx(); const ym=ymKey(new Date()); let inc=0,exp=0; for(const t of all){ if(ymKey(t.date)!==ym) continue; if(t.type==='income') inc+=Number(t.amount); else exp+=Number(t.amount);} $('#homeIncome').textContent=fmt(inc); $('#homeExpenses').textContent=fmt(exp); $('#homeNet').textContent=fmt(inc-exp); }
async function renderAll(){ await refreshHome(); await renderLedger(); await renderCatBudgets(); await drawChart(); }

// ---------- SW / Tabs / Theme / Boot ----------
function setupSW(){ if('serviceWorker' in navigator){ window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js')); } }
async function initTheme(){ const t=(await getMeta('theme'))||'dark'; document.documentElement.dataset.theme=t; }

(async function boot(){
  try{ await openDB(); }catch(e){ alert('IndexedDB failed.'); }
  setupTabs(); setupSW(); setupForms(); await initTheme();
  await renderAll();
})();