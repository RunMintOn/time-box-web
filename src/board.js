import { store, DAYS, DAY_LABELS, minutes, clock, durationLabel } from './state.js';

const START = 7 * 60;
const END = 24 * 60;
const RANGE = END - START;
const SNAP = 15;

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const pct = mins => ((mins - START) / RANGE) * 100;
const fromPct = p => START + (p / 100) * RANGE;
const snap15 = mins => Math.round(mins / SNAP) * SNAP;

function activityById(id) {
  return store.get().activities.find(a => a.id === id);
}

function collectAnchors(day, ignorePlacementId = null) {
  const s = store.get();
  const anchors = [8 * 60, 12 * 60, 16 * 60, 20 * 60, 22 * 60];
  s.contexts.filter(c => c.day === day).forEach(c => anchors.push(c.start, c.end));
  s.placements.filter(p => p.day === day && p.id !== ignorePlacementId).forEach(p => anchors.push(p.start, p.start + p.duration));
  return anchors;
}

function smartSnap(raw, day, ignorePlacementId = null) {
  const snapped = snap15(raw);
  const anchors = collectAnchors(day, ignorePlacementId);
  let best = snapped;
  let dist = 13;
  anchors.forEach(a => {
    const d = Math.abs(raw - a);
    if (d < dist) { best = a; dist = d; }
  });
  return clamp(best, START, END - 15);
}

function makeStuds(count = 4) {
  return `<span class="stud-row" aria-hidden="true">${Array.from({ length: count }, () => '<i></i>').join('')}</span>`;
}

function placementHTML(p) {
  const a = activityById(p.activityId);
  if (!a) return '';
  const selected = store.get().selected?.type === 'placement' && store.get().selected.id === p.id;
  return `<button class="lego-block placement ${selected ? 'is-selected' : ''}" data-placement="${p.id}" style="--top:${pct(p.start)}%;--height:${Math.max(4.2, (p.duration / RANGE) * 100)}%" aria-label="${a.title} ${clock(p.start)} ${durationLabel(p.duration)}">
    ${makeStuds(p.duration >= 60 ? 5 : 3)}
    <span class="block-title">${a.title}</span>
    <span class="block-meta">${clock(p.start)} · ${durationLabel(p.duration)}</span>
    <span class="resize-handle" data-resize="${p.id}" aria-hidden="true"></span>
  </button>`;
}

function contextHTML(c) {
  const selected = store.get().selected?.type === 'context' && store.get().selected.id === c.id;
  const span = Math.max(5, pct(c.end) - pct(c.start));
  return `<button class="context-pad ${selected ? 'is-selected' : ''}" data-context="${c.id}" style="--top:${pct(c.start)}%;--height:${span}%">
    <span class="context-kicker">CONTEXT</span>
    <strong>${c.title}</strong>
    <span>${clock(c.start)}–${clock(c.end)}${c.location ? ` · ${c.location}` : ''}</span>
    <small>${[c.energy && `精力 ${c.energy}`, c.freedom && `自由 ${c.freedom}`].filter(Boolean).join(' · ')}</small>
  </button>`;
}

function dayColumn(day) {
  const s = store.get();
  return `<section class="day-column" data-day="${day}">
    <header class="day-title"><strong>${DAY_LABELS[day]}</strong><span>${DAYS[day]}</span></header>
    <div class="day-canvas" data-day-canvas="${day}">
      <span class="period p-morning">上午</span>
      <span class="period p-afternoon">下午</span>
      <span class="period p-evening">晚上</span>
      <div class="quiet-line" style="--top:${pct(12*60)}%"></div>
      <div class="quiet-line" style="--top:${pct(18*60)}%"></div>
      ${s.contexts.filter(c => c.day === day).map(contextHTML).join('')}
      ${s.placements.filter(p => p.day === day).map(placementHTML).join('')}
      <div class="snap-guide" hidden></div>
      <output class="drag-time" hidden></output>
    </div>
  </section>`;
}

export function renderBoard(root) {
  root.innerHTML = `<div class="week-board">${DAYS.map((_, i) => dayColumn(i)).join('')}</div>`;
  wireBoard(root);
}

function pointerMinute(canvas, clientY) {
  const r = canvas.getBoundingClientRect();
  const y = clamp(clientY - r.top, 0, r.height);
  return START + (y / r.height) * RANGE;
}

function dayFromPoint(clientX, clientY) {
  const el = document.elementFromPoint(clientX, clientY)?.closest('[data-day-canvas]');
  return el ? Number(el.dataset.dayCanvas) : null;
}

function showGuide(root, day, minute, text) {
  root.querySelectorAll('.snap-guide,.drag-time').forEach(el => el.hidden = true);
  const canvas = root.querySelector(`[data-day-canvas="${day}"]`);
  if (!canvas) return;
  const guide = canvas.querySelector('.snap-guide');
  const bubble = canvas.querySelector('.drag-time');
  guide.style.setProperty('--top', `${pct(minute)}%`);
  guide.hidden = false;
  bubble.style.setProperty('--top', `${pct(minute)}%`);
  bubble.textContent = text;
  bubble.hidden = false;
  canvas.classList.add('is-target');
}

function clearGuides(root) {
  root.querySelectorAll('.snap-guide,.drag-time').forEach(el => el.hidden = true);
  root.querySelectorAll('.day-canvas').forEach(el => el.classList.remove('is-target'));
}

function wireBoard(root) {
  root.querySelectorAll('[data-context]').forEach(el => el.addEventListener('click', e => {
    e.stopPropagation(); store.select('context', el.dataset.context);
  }));

  root.querySelectorAll('[data-placement]').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('[data-resize]')) return;
      e.stopPropagation(); store.select('placement', el.dataset.placement);
    });
    el.addEventListener('pointerdown', e => {
      if (e.target.closest('[data-resize]')) return;
      beginMove(e, root, el.dataset.placement);
    });
  });

  root.querySelectorAll('[data-resize]').forEach(handle => handle.addEventListener('pointerdown', e => beginResize(e, root, handle.dataset.resize)));

  root.querySelectorAll('[data-day-canvas]').forEach(canvas => {
    canvas.addEventListener('click', () => store.select(null, null));
    canvas.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; const m = smartSnap(pointerMinute(canvas, e.clientY), Number(canvas.dataset.dayCanvas)); showGuide(root, Number(canvas.dataset.dayCanvas), m, `放到 ${clock(m)}`); });
    canvas.addEventListener('dragleave', e => { if (!canvas.contains(e.relatedTarget)) clearGuides(root); });
    canvas.addEventListener('drop', e => {
      e.preventDefault();
      const activityId = e.dataTransfer.getData('text/activity-id');
      if (!activityId) return;
      const day = Number(canvas.dataset.dayCanvas);
      const m = smartSnap(pointerMinute(canvas, e.clientY), day);
      const p = store.addPlacement(activityId, day, m);
      store.select('placement', p.id);
      clearGuides(root);
    });
  });
}

function beginMove(e, root, id) {
  if (e.button !== 0) return;
  const p = store.get().placements.find(x => x.id === id);
  if (!p) return;
  e.preventDefault();
  const target = e.currentTarget;
  target.setPointerCapture(e.pointerId);
  target.classList.add('is-dragging');
  document.body.classList.add('dragging-block');

  const sourceCanvas = target.closest('[data-day-canvas]');
  const startMinuteAtPointer = pointerMinute(sourceCanvas, e.clientY);
  const offset = startMinuteAtPointer - p.start;
  let preview = { day: p.day, start: p.start };

  const move = ev => {
    const day = dayFromPoint(ev.clientX, ev.clientY);
    if (day == null) return;
    const canvas = root.querySelector(`[data-day-canvas="${day}"]`);
    const raw = pointerMinute(canvas, ev.clientY) - offset;
    const start = smartSnap(raw, day, id);
    preview = { day, start };
    showGuide(root, day, start, `${clock(start)} · ${durationLabel(p.duration)}`);
  };

  const up = ev => {
    target.releasePointerCapture?.(e.pointerId);
    target.classList.remove('is-dragging');
    document.body.classList.remove('dragging-block');
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerup', up);
    target.removeEventListener('pointercancel', up);
    clearGuides(root);
    store.updatePlacement(id, preview);
    store.select('placement', id);
  };

  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', up);
  target.addEventListener('pointercancel', up);
}

function beginResize(e, root, id) {
  if (e.button !== 0) return;
  e.preventDefault(); e.stopPropagation();
  const p = store.get().placements.find(x => x.id === id);
  if (!p) return;
  const handle = e.currentTarget;
  handle.setPointerCapture(e.pointerId);
  const canvas = handle.closest('[data-day-canvas]');
  let duration = p.duration;

  const move = ev => {
    const end = snap15(pointerMinute(canvas, ev.clientY));
    duration = clamp(end - p.start, 15, END - p.start);
    showGuide(root, p.day, p.start + duration, `${durationLabel(duration)}`);
  };
  const up = () => {
    handle.releasePointerCapture?.(e.pointerId);
    handle.removeEventListener('pointermove', move);
    handle.removeEventListener('pointerup', up);
    handle.removeEventListener('pointercancel', up);
    clearGuides(root);
    store.updatePlacement(id, { duration });
    store.select('placement', id);
  };
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', up);
  handle.addEventListener('pointercancel', up);
}
