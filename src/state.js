const STORAGE_KEY = 'time-box-web-v3';
const uid = prefix => `${prefix}_${Math.random().toString(36).slice(2,8)}_${Date.now().toString(36)}`;

export const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
export const DAY_LABELS = ['周一','周二','周三','周四','周五','周六','周日'];
export const MAX_DEPTH = 3;

export function clock(total) {
  const t = Math.max(0, Math.min(1439, Math.round(Number(total) || 0)));
  return `${String(Math.floor(t / 60)).padStart(2,'0')}:${String(t % 60).padStart(2,'0')}`;
}

export function durationLabel(mins) {
  mins = Math.max(0, Number(mins) || 0);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

const makeActivity = (id,title,duration,repeatDays=[],rigidity='flexible',traits={}) => ({
  id,title,duration,repeatDays,rigidity,
  traits:{ location:'', energy:'', freedom:'', ...traits }, note:''
});

function seed() {
  const activities = [
    makeActivity('a_course_data','大数据营销',95,[0],'fixed',{location:'教室',energy:'中',freedom:'高'}),
    makeActivity('a_course_cloud','云计算',95,[0],'fixed',{location:'教室',energy:'中',freedom:'高'}),
    makeActivity('a_read','阅读',30,[0,1,2,3,4],'approx',{energy:'低'}),
    makeActivity('a_train','锻炼',60,[0,1,2,3,4],'approx',{energy:'中'}),
    makeActivity('a_own','自己的事情',70,[],'flexible',{energy:'中'})
  ];
  const placements = [
    {id:'p_course_data',activityId:'a_course_data',day:0,start:530,duration:95,parentId:null},
    {id:'p_own',activityId:'a_own',day:0,start:545,duration:70,parentId:'p_course_data'},
    {id:'p_course_cloud',activityId:'a_course_cloud',day:0,start:640,duration:95,parentId:null},
    {id:'p_train_0',activityId:'a_train',day:0,start:970,duration:60,parentId:null},
    {id:'p_train_1',activityId:'a_train',day:1,start:1000,duration:60,parentId:null},
    {id:'p_train_2',activityId:'a_train',day:2,start:950,duration:60,parentId:null},
    {id:'p_train_3',activityId:'a_train',day:3,start:980,duration:60,parentId:null},
    {id:'p_train_4',activityId:'a_train',day:4,start:1020,duration:60,parentId:null},
    {id:'p_read_0',activityId:'a_read',day:0,start:1260,duration:30,parentId:null},
    {id:'p_read_1',activityId:'a_read',day:1,start:1230,duration:30,parentId:null},
    {id:'p_read_2',activityId:'a_read',day:2,start:1320,duration:30,parentId:null},
    {id:'p_read_3',activityId:'a_read',day:3,start:1170,duration:30,parentId:null},
    {id:'p_read_4',activityId:'a_read',day:4,start:1290,duration:30,parentId:null}
  ];
  return { activities, placements, selected:null };
}

let state;
try {
  const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  state = parsed && Array.isArray(parsed.activities) && Array.isArray(parsed.placements) ? parsed : seed();
} catch { state = seed(); }

const listeners = new Set();
const persist = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  listeners.forEach(fn => fn(state));
};
const placementById = id => state.placements.find(p => p.id === id) || null;
const childrenOf = id => state.placements.filter(p => p.parentId === id);

function descendantsOf(id) {
  const out = [];
  const visit = parentId => childrenOf(parentId).forEach(child => { out.push(child); visit(child.id); });
  visit(id);
  return out;
}

function depthOf(id) {
  let depth = 0, current = placementById(id), guard = 0;
  while (current?.parentId && guard++ < 10) { depth++; current = placementById(current.parentId); }
  return depth;
}

function canParent(childId,parentId) {
  if (!parentId) return true;
  if (childId === parentId) return false;
  if (descendantsOf(childId).some(p => p.id === parentId)) return false;
  return depthOf(parentId) + 1 < MAX_DEPTH;
}

function shiftDescendants(id,day,delta) {
  descendantsOf(id).forEach(p => { p.day = day; p.start += delta; });
}

export const store = {
  get:()=>state,
  subscribe(fn){ listeners.add(fn); return ()=>listeners.delete(fn); },
  reset(){ state = seed(); persist(); },
  select(type,id){ state.selected = id ? {type,id} : null; persist(); },
  activityById(id){ return state.activities.find(a => a.id === id) || null; },
  placementById, childrenOf, descendantsOf, depthOf, canParent,

  addActivity(data={}){
    const item = makeActivity(uid('a'), data.title || '未命名', Number(data.duration)||30, data.repeatDays||[], data.rigidity||'flexible', {
      location:data.location||'', energy:data.energy||'', freedom:data.freedom||''
    });
    state.activities.push(item); persist(); return item;
  },
  updateActivity(id,patch={}){
    const a = state.activities.find(x=>x.id===id); if(!a) return;
    if (patch.traits) a.traits = {...a.traits,...patch.traits};
    Object.keys(patch).filter(k=>k!=='traits').forEach(k=>a[k]=patch[k]);
    persist();
  },
  removeActivity(id){
    const roots = state.placements.filter(p=>p.activityId===id).map(p=>p.id);
    const remove = new Set(roots);
    roots.forEach(r=>descendantsOf(r).forEach(p=>remove.add(p.id)));
    state.activities = state.activities.filter(a=>a.id!==id);
    state.placements = state.placements.filter(p=>!remove.has(p.id));
    if (state.selected && (state.selected.id===id || remove.has(state.selected.id))) state.selected=null;
    persist();
  },
  addPlacement(activityId,day,start,duration,parentId=null){
    const a = this.activityById(activityId); if(!a) return null;
    const parent = parentId ? placementById(parentId) : null;
    let d = Number(duration)||a.duration;
    let s = Number(start);
    let finalDay = Number(day);
    if(parent){ finalDay=parent.day; d=Math.min(d,parent.duration); s=Math.max(parent.start,Math.min(s,parent.start+parent.duration-d)); }
    const p={id:uid('p'),activityId,day:finalDay,start:s,duration:d,parentId:parent?.id||null};
    state.placements.push(p); persist(); return p;
  },
  updatePlacement(id,patch={}){
    const p=placementById(id); if(!p) return;
    const oldStart=p.start, oldDay=p.day;
    Object.assign(p,patch);
    if(p.parentId){ const parent=placementById(p.parentId); if(parent){ p.day=parent.day; p.duration=Math.min(p.duration,parent.duration); p.start=Math.max(parent.start,Math.min(p.start,parent.start+parent.duration-p.duration)); } }
    if(p.start!==oldStart || p.day!==oldDay) shiftDescendants(id,p.day,p.start-oldStart);
    persist();
  },
  movePlacement(id,{day,start,parentId=null}){
    const p=placementById(id); if(!p || !canParent(id,parentId)) return;
    const oldStart=p.start;
    if(parentId){ const parent=placementById(parentId); if(!parent) return; p.parentId=parentId; p.day=parent.day; p.duration=Math.min(p.duration,parent.duration); p.start=Math.max(parent.start,Math.min(Number(start),parent.start+parent.duration-p.duration)); }
    else { p.parentId=null; p.day=Number(day); p.start=Number(start); }
    shiftDescendants(id,p.day,p.start-oldStart); persist();
  },
  removePlacement(id){
    const remove=new Set([id,...descendantsOf(id).map(p=>p.id)]);
    state.placements=state.placements.filter(p=>!remove.has(p.id));
    if(state.selected && remove.has(state.selected.id)) state.selected=null;
    persist();
  },
  spreadActivity(id){
    const a=this.activityById(id); if(!a) return;
    a.repeatDays.forEach((day,i)=>{
      if(!state.placements.some(p=>p.activityId===id && p.day===day && !p.parentId)) state.placements.push({id:uid('p'),activityId:id,day,start:1200+(i%2)*30,duration:a.duration,parentId:null});
    });
    persist();
  }
};
