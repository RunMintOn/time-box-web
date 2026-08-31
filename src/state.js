const STORAGE_KEY = 'time-box-web-v3';

const uid = prefix => `${prefix}_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
export const MAX_DEPTH = 3;

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

function activity(id, title, duration, repeatDays = [], rigidity = 'flexible', traits = {}) {
  return { id, title, duration, repeatDays, rigidity, traits: { location: '', energy: '', freedom: '', ...traits }, note: '' };
}

function seed() {
  const activities = [
    activity('a_course_data', '大数据营销', 95, [0], 'fixed', { location: '教室', energy: '中', freedom: '高' }),
    activity('a_course_cloud', '云计算', 95, [0], 'fixed', { location: '教室', energy: '中', freedom: '高' }),
    activity('a_read', '阅读', 30, [0, 1, 2, 3, 4], 'approx', { energy: '低' }),
    activity('a_train', '锻炼', 60, [0, 1, 2, 3, 4], 'approx', { energy: '中' }),
    activity('a_own', '自己的事情', 70, [], 'flexible', { energy: '中' }),
  ];

  const placements = [
    { id: 'p_course_data', activityId: 'a_course_data', day: 0, start: 530, duration: 95, parentId: null },
    { id: 'p_own', activityId: 'a_own', day: 0, start: 545, duration: 70, parentId: 'p_course_data' },
    { id: 'p_course_cloud', activityId: 'a_course_cloud', day: 0, start: 640, duration: 95, parentId: null },
    { id: 'p_train_0', activityId: 'a_train', day: 0, start: 970, duration: 60, parentId: null },
    { id: 'p_train_1', activityId: 'a_train', day: 1, start: 1000, duration: 60, parentId: null },
    { id: 'p_train_2', activityId: 'a_train', day: 2, start: 950, duration: 60, parentId: null },
    { id: 'p_train_3', activityId: 'a_train', day: 3, start: 980, duration: 60, parentId: null },
    { id: 'p_train_4', activityId: 'a_train', day: 4, start: 1020, duration: 60, parentId: null },
    { id: 'p_read_0', activityId: 'a_read', day: 0, start: 1260, duration: 30, parentId: null },
    { id: 'p_read_1', activityId: 'a_read', day: 1, start: 1230, duration: 30, parentId: null },
    { id: 'p_read_2', activityId: 'a_read', day: 2, start: 1320, duration: 30, parentId: null },
    { id: 'p_read_3', activityId: 'a_read', day: 3, start: 1170, duration: 30, parentId: null },
    { id: 'p_read_4', activityId: 'a_read', day: 4, start: 1290, duration: 30, parentId: null },
  ];

  return { activities, placements, selected: null };
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

function placementById(id) {
  return state.placements.find(p => p.id === id) || null;
}

function childrenOf(id) {
  return state.placements.filter(p => p.parentId === id);
}

function descendantsOf(id) {
  if (!id) return [];
  const out = [];
  const walk = parentId => childrenOf(parentId).forEach(child => { out.push(child); walk(child.id); });
  walk(id);
  return out;
}

function depthOf(id) {
  let depth = 0;
  let current = placementById(id);
  const seen = new Set();
  while (current?.parentId && !seen.has(current.parentId)) {
    seen.add(current.parentId);
    depth += 1;
    current = placementById(current.parentId);
  }
  return depth;
}

function canParent(childId, parentId) {
  if (!parentId) return true;
  if (childId === parentId) return false;
  if (childId && descendantsOf(childId).some(p => p.id === parentId)) return false;
  return depthOf(parentId) + 1 < MAX_DEPTH;
}

function moveDescendants(id, day, delta) {
  descendantsOf(id).forEach(child => {
    child.day = day;
    child.start += delta;
  });
}

export const store = {
  get: () => state,
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  reset() { state = seed(); persist(); },
  select(type, id) { state.selected = id ? { type, id } : null; persist(); },
  activityById(id) { return state.activities.find(a => a.id === id) || null; },
  placementById,
  childrenOf,
  descendantsOf,
  depthOf,
  canParent,

  addActivity(data) {
    const item = {
      id: uid('a'),
      title: data.title || '未命名',
      duration: Number(data.duration) || 30,
      repeatDays: data.repeatDays || [],
      rigidity: data.rigidity || 'flexible',
      traits: {
        location: data.location || '',
        energy: data.energy || '',
        freedom: data.freedom || '',
      },
      note: data.note || '',
    };
    state.activities.push(item);
    persist();
    return item;
  },

  updateActivity(id, patch) {
    const item = state.activities.find(x => x.id === id);
    if (!item) return;
    if (patch.traits) item.traits = { ...item.traits, ...patch.traits };
    Object.assign(item, { ...patch, traits: item.traits });
    persist();
  },

  removeActivity(id) {
    const placementIds = state.placements.filter(x => x.activityId === id).map(x => x.id);
    const remove = new Set(placementIds);
    placementIds.forEach(pid => descendantsOf(pid).forEach(p => remove.add(p.id)));
    state.activities = state.activities.filter(x => x.id !== id);
    state.placements = state.placements.filter(x => !remove.has(x.id));
    if (state.selected?.id === id || remove.has(state.selected?.id)) state.selected = null;
    persist();
  },

  addPlacement(activityId, day, start, duration, parentId = null) {
    const activity = state.activities.find(x => x.id === activityId);
    if (!activity) return null;
    const parent = parentId ? placementById(parentId) : null;
    const item = {
      id: uid('p'),
      activityId,
      day: parent ? parent.day : Number(day),
      start: Number(start),
      duration: Number(duration) || activity.duration,
      parentId: parent?.id || null,
    };
    if (parent) {
      if (item.duration > parent.duration) item.duration = parent.duration;
      item.start = Math.max(parent.start, Math.min(item.start, parent.start + parent.duration - item.duration));
    }
    state.placements.push(item);
    persist();
    return item;
  },

  updatePlacement(id, patch) {
    const item = placementById(id);
    if (!item) return;
    const oldStart = item.start;
    const oldDay = item.day;
    Object.assign(item, patch);

    if (patch.duration != null) {
      const required = childrenOf(id).reduce((max, child) => Math.max(max, child.start + child.duration - item.start), 15);
      item.duration = Math.max(item.duration, required);
    }

    if (item.parentId) {
      const parent = placementById(item.parentId);
      if (parent) {
        item.day = parent.day;
        item.duration = Math.min(item.duration, parent.duration);
        item.start = Math.max(parent.start, Math.min(item.start, parent.start + parent.duration - item.duration));
      }
    }

    const delta = item.start - oldStart;
    if (delta || item.day !== oldDay) moveDescendants(id, item.day, delta);
    persist();
  },

  movePlacement(id, { day, start, parentId = null }) {
    const item = placementById(id);
    if (!item || !canParent(id, parentId)) return;
    const parent = parentId ? placementById(parentId) : null;
    if (parentId && (!parent || item.duration > parent.duration)) return;

    const oldStart = item.start;
    item.parentId = parentId || null;
    if (parent) {
      item.day = parent.day;
      item.start = Math.max(parent.start, Math.min(Number(start), parent.start + parent.duration - item.duration));
    } else {
      item.day = Number(day);
      item.start = Number(start);
    }
    moveDescendants(id, item.day, item.start - oldStart);
    persist();
  },

  removePlacement(id) {
    const remove = new Set([id, ...descendantsOf(id).map(p => p.id)]);
    state.placements = state.placements.filter(x => !remove.has(x.id));
    if (remove.has(state.selected?.id)) state.selected = null;
    persist();
  },

  spreadActivity(id) {
    const a = state.activities.find(x => x.id === id);
    if (!a) return;
    a.repeatDays.forEach((day, i) => {
      const exists = state.placements.some(p => p.activityId === id && p.day === day && !p.parentId);
      if (!exists) state.placements.push({ id: uid('p'), activityId: id, day, start: 20 * 60 + (i % 2) * 30, duration: a.duration, parentId: null });
    });
    persist();
  },
};
