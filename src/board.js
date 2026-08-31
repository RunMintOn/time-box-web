import { store, DAYS, DAY_LABELS, MAX_DEPTH, clock, durationLabel } from './state.js';

const START=420, END=1440, RANGE=END-START, SNAP=15;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const pct=m=>((m-START)/RANGE)*100;
const snap=m=>Math.round(m/SNAP)*SNAP;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function activity(id){ return store.activityById(id); }
function geometry(p,parent){
  if(!parent) return {top:pct(p.start),height:Math.max(3.7,p.duration/RANGE*100)};
  return {top:clamp((p.start-parent.start)/parent.duration*100,0,100),height:clamp(p.duration/parent.duration*100,10,100)};
}
function traits(a){ const t=a?.traits||{}; return [t.location,t.energy&&`精力 ${t.energy}`,t.freedom&&`自由 ${t.freedom}`].filter(Boolean).join(' · '); }

function nodeHTML(p,parent=null,depth=0){
  const a=activity(p.activityId); if(!a) return '';
  const kids=store.childrenOf(p.id).sort((x,y)=>x.start-y.start), g=geometry(p,parent);
  const selected=store.get().selected?.type==='placement'&&store.get().selected.id===p.id;
  return `<div class="placement-node ${kids.length?'has-children':'is-leaf'} ${depth?'is-nested':''} ${selected?'is-selected':''}" data-placement="${p.id}" data-depth="${depth}" style="--top:${g.top}%;--height:${g.height}%">
    <button class="placement-surface" type="button" data-drag-handle="${p.id}">
      <span class="stud-row" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      <span class="block-copy"><strong>${esc(a.title)}</strong><small>${clock(p.start)} · ${durationLabel(p.duration)}</small>${traits(a)?`<em>${esc(traits(a))}</em>`:''}</span>
      ${kids.length?`<span class="container-badge">${kids.length} 内嵌</span>`:''}
      <span class="resize-handle" data-resize="${p.id}"></span>
    </button>
    ${kids.map(k=>nodeHTML(k,p,depth+1)).join('')}
  </div>`;
}

function dayHTML(day){
  const roots=store.get().placements.filter(p=>p.day===day&&!p.parentId).sort((a,b)=>a.start-b.start);
  return `<section class="day-column"><header class="day-title"><strong>${DAY_LABELS[day]}</strong><span>${DAYS[day]}</span></header><div class="day-canvas" data-day-canvas="${day}">
    <span class="period p-morning">上午</span><span class="period p-afternoon">下午</span><span class="period p-evening">晚上</span>
    <div class="quiet-line" style="--top:${pct(720)}%"></div><div class="quiet-line" style="--top:${pct(1080)}%"></div>
    ${roots.map(p=>nodeHTML(p)).join('')}<div class="snap-guide" hidden></div><output class="drag-time" hidden></output>
  </div></section>`;
}

export function renderBoard(root){ root.innerHTML=`<div class="week-board">${DAYS.map((_,i)=>dayHTML(i)).join('')}</div>`; wire(root); }

function minuteAt(canvas,y){ const r=canvas.getBoundingClientRect(); return START+clamp(y-r.top,0,r.height)/r.height*RANGE; }
function canvasAt(x,y){ return document.elementsFromPoint(x,y).map(el=>el.closest?.('[data-day-canvas]')).find(Boolean)||null; }
function parentAt(x,y,movingId=null){
  const nodes=document.elementsFromPoint(x,y).map(el=>el.closest?.('[data-placement]')).filter(Boolean);
  for(const n of nodes){ const id=n.dataset.placement; if(!id||id===movingId) continue; if(movingId&&!store.canParent(movingId,id)) continue; if(!movingId&&store.depthOf(id)+1>=MAX_DEPTH) continue; return store.placementById(id); }
  return null;
}
function snapped(raw,parent){
  let v=snap(raw);
  if(parent){ const anchors=[parent.start,parent.start+parent.duration]; anchors.forEach(a=>{if(Math.abs(raw-a)<13)v=a;}); }
  return clamp(v,START,END-15);
}
function fit(start,duration,parent){ return parent?clamp(start,parent.start,Math.max(parent.start,parent.start+parent.duration-duration)):start; }
function clear(root){ root.querySelectorAll('.snap-guide,.drag-time').forEach(x=>x.hidden=true); root.querySelectorAll('.day-canvas').forEach(x=>x.classList.remove('is-target')); root.querySelectorAll('.placement-node').forEach(x=>x.classList.remove('nest-candidate')); }
function guide(root,day,minute,text,parentId=null){
  clear(root); const canvas=root.querySelector(`[data-day-canvas="${day}"]`); if(!canvas)return;
  canvas.classList.add('is-target'); const line=canvas.querySelector(':scope > .snap-guide'), out=canvas.querySelector(':scope > .drag-time');
  line.style.setProperty('--top',`${pct(minute)}%`); line.hidden=false; out.style.setProperty('--top',`${pct(minute)}%`); out.textContent=text; out.hidden=false;
  if(parentId) root.querySelector(`[data-placement="${parentId}"]`)?.classList.add('nest-candidate');
}
function preview(root,x,y,duration,movingId=null){
  const canvas=canvasAt(x,y); if(!canvas)return null; const rawDay=Number(canvas.dataset.dayCanvas), parent=parentAt(x,y,movingId); const day=parent?parent.day:rawDay;
  let start=fit(snapped(minuteAt(canvas,y),parent),duration,parent); const parentId=parent?.id||null;
  guide(root,day,start,parent?`放入 ${activity(parent.activityId)?.title||'容器'} · ${clock(start)}`:`${clock(start)} · ${durationLabel(duration)}`,parentId);
  return {day,start,parentId};
}

function wire(root){
  root.querySelectorAll('[data-drag-handle]').forEach(btn=>{
    const id=btn.dataset.dragHandle;
    btn.addEventListener('click',e=>{e.stopPropagation();store.select('placement',id);});
    btn.addEventListener('pointerdown',e=>{if(!e.target.closest('[data-resize]'))move(e,root,id);});
  });
  root.querySelectorAll('[data-resize]').forEach(h=>h.addEventListener('pointerdown',e=>resize(e,root,h.dataset.resize)));
  root.querySelectorAll('[data-day-canvas]').forEach(canvas=>{
    canvas.addEventListener('click',e=>{if(!e.target.closest('[data-placement]'))store.select(null,null);});
    canvas.addEventListener('dragover',e=>{e.preventDefault();const id=e.dataTransfer.getData('text/activity-id')||document.body.dataset.dragActivity;const a=activity(id);if(a){preview(root,e.clientX,e.clientY,a.duration);e.dataTransfer.dropEffect='copy';}});
    canvas.addEventListener('drop',e=>{e.preventDefault();const id=e.dataTransfer.getData('text/activity-id')||document.body.dataset.dragActivity;const a=activity(id);if(!a)return;const pos=preview(root,e.clientX,e.clientY,a.duration);if(pos){const p=store.addPlacement(id,pos.day,pos.start,a.duration,pos.parentId);if(p)store.select('placement',p.id);}clear(root);});
  });
}

function move(e,root,id){
  if(e.button!==0)return; const p=store.placementById(id); if(!p)return; e.preventDefault();e.stopPropagation();
  const btn=e.currentTarget,node=btn.closest('[data-placement]'),source=node.closest('[data-day-canvas]'),offset=minuteAt(source,e.clientY)-p.start; let pos={day:p.day,start:p.start,parentId:p.parentId||null};
  btn.setPointerCapture(e.pointerId);node.classList.add('is-dragging');
  const onMove=ev=>{const canvas=canvasAt(ev.clientX,ev.clientY);if(!canvas)return;const parent=parentAt(ev.clientX,ev.clientY,id),day=parent?parent.day:Number(canvas.dataset.dayCanvas),parentId=parent?.id||null;let start=fit(snapped(minuteAt(canvas,ev.clientY)-offset,parent),p.duration,parent);pos={day,start,parentId};guide(root,day,start,parent?`放入 ${activity(parent.activityId)?.title||'容器'} · ${clock(start)}`:`${clock(start)} · ${durationLabel(p.duration)}`,parentId);};
  const onUp=()=>{btn.releasePointerCapture?.(e.pointerId);btn.removeEventListener('pointermove',onMove);btn.removeEventListener('pointerup',onUp);btn.removeEventListener('pointercancel',onUp);clear(root);store.movePlacement(id,pos);store.select('placement',id);};
  btn.addEventListener('pointermove',onMove);btn.addEventListener('pointerup',onUp);btn.addEventListener('pointercancel',onUp);
}
function resize(e,root,id){
  if(e.button!==0)return;e.preventDefault();e.stopPropagation();const p=store.placementById(id);if(!p)return;const h=e.currentTarget,canvas=h.closest('[data-day-canvas]'),parent=p.parentId?store.placementById(p.parentId):null,maxEnd=parent?parent.start+parent.duration:END;let duration=p.duration;
  h.setPointerCapture(e.pointerId);const onMove=ev=>{const end=clamp(snap(minuteAt(canvas,ev.clientY)),p.start+15,maxEnd);duration=end-p.start;guide(root,p.day,p.start+duration,durationLabel(duration),p.parentId);};
  const onUp=()=>{h.releasePointerCapture?.(e.pointerId);h.removeEventListener('pointermove',onMove);h.removeEventListener('pointerup',onUp);h.removeEventListener('pointercancel',onUp);clear(root);store.updatePlacement(id,{duration});store.select('placement',id);};
  h.addEventListener('pointermove',onMove);h.addEventListener('pointerup',onUp);h.addEventListener('pointercancel',onUp);
}
