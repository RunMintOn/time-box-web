const STORAGE_KEY = 'time-box-web-v2';

const uid = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

export function minutes(value) {
  if (typeof value === 'number') return value;
  const [h, m] = String(value).split(':').map(Number);
  return h * 60 + m;
}

export function clock(total) {
  const t = Math.max(0, Math.min(24 * 60 - 1, Math.round(total)));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export function durationLabel(mins) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function seed() {
  const activities = [
    { id: 'a_read', title: '阅读', duration: 30, repeatDays: [0,1,2,3,4], rigidity: 'approx', note: '' },
    { id: 'a_train', title: '锻炼', duration: 60, repeatDays: [0,1,2,3,4], rigidity: 'approx', note: '' },
    { id: 'a_own', title: '自己的事情', duration: 70, repeatDays: [], rigidity: 'flexible', note: '' },
  ];

  const contexts = [
    { id: 'c_mon_1', day: 0, start: 530, end: 625, title: '大数据营销', location: '教室', energy: '中', freedom: '高' },
    { id: 'c_mon_2', day: 0, start: 640, end: 735, title: '云计算', location: '教室', energy: '中', freedom: '高' },
    { id: 'c_wed_1', day: 2, start: 530, end: 625, title: '课程', location: '教室', energy: '中', freedom: '高' },
  ];

  const placements = [
    { id: 'p_own', activityId: 'a_own', day: 0, start: 545, duration: 70 },
    { id: 'p_train_0', activityId: 'a_train', day: 0, start: 970, duration: 60 },
    { id: 'p_train_1', activityId: 'a_train', day: 1, start: 1000, duration: 60 },
    { id: 'p_train_2', activityId: 'a_train', day: 2, start: 950, duration: 60 },
    { id: 'p_train_3', activityId: 'a_train', day: 3, start: 980, duration: 60 },
    { id: 'p_train_4', activityId: 'a_train', day: 4, start: 1020, duration: 60 },
    { id: 'p_read_0', activityId: 'a_read', day: 0, start: 1260, duration: 30 },
    { id: 'p_read_1', activityId: 'a_read', day: 1, start: 1230, duration: 30 },
    { id: 'p_read_2', activityId: 'a_read', day: 2, start: 1320, duration: 30 },
    { id: 'p_read_3', activityId: 'a_read', day: 3, start: 1170, duration: 30 },
    { id: 'p_read_4', activityId: 'a_read', day: 4, start: 1290, duration: 30 },
  ];

  return { activities, contexts, placements, selected: null };
}

let state;
try {
  state = JSON.parse(localStorage.getItem(STORAGE_KEY)) || seed();
} catch {
  state = seed();
}

const listeners = new Set();

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  listeners.forEach(fn => fn(state));
}

export const store = {
  get: () => state,
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  reset() { state = seed(); persist(); },
  select(type, id) { state.selected = id ? { type, id } : null; persist(); },
  addActivity(data) {
    const item = { id: uid('a'), title: data.title || '未命名', duration: Number(data.duration) || 30, repeatDays: data.repeatDays || [], rigidity: data.rigidity || 'flexible', note: data.note || '' };
    state.activities.push(item); persist(); return item;
  },
  updateActivity(id, patch) { Object.assign(state.activities.find(x => x.id === id) || {}, patch); persist(); },
  removeActivity(id) {
    state.activities = state.activities.filter(x => x.id !== id);
    state.placements = state.placements.filter(x => x.activityId !== id);
    if (state.selected?.id === id) state.selected = null;
    persist();
  },
  addContext(data) {
    const item = { id: uid('c'), day: Number(data.day) || 0, start: Number(data.start), end: Number(data.end), title: data.title || 'Context', location: data.location || '', energy: data.energy || '', freedom: data.freedom || '' };
    state.contexts.push(item); persist(); return item;
  },
  updateContext(id, patch) { Object.assign(state.contexts.find(x => x.id === id) || {}, patch); persist(); },
  removeContext(id) { state.contexts = state.contexts.filter(x => x.id !== id); if (state.selected?.id === id) state.selected = null; persist(); },
  addPlacement(activityId, day, start, duration) {
    const activity = state.activities.find(x => x.id === activityId);
    if (!activity) return null;
    const item = { id: uid('p'), activityId, day, start, duration: duration || activity.duration };
    state.placements.push(item); persist(); return item;
  },
  updatePlacement(id, patch) { Object.assign(state.placements.find(x => x.id === id) || {}, patch); persist(); },
  removePlacement(id) { state.placements = state.placements.filter(x => x.id !== id); if (state.selected?.id === id) state.selected = null; persist(); },
  spreadActivity(id) {
    const a = state.activities.find(x => x.id === id);
    if (!a) return;
    a.repeatDays.forEach((day, i) => {
      const exists = state.placements.some(p => p.activityId === id && p.day === day);
      if (!exists) state.placements.push({ id: uid('p'), activityId: id, day, start: 20 * 60 + (i % 2) * 30, duration: a.duration });
    });
    persist();
  }
};
