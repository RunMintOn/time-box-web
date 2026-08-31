import { store, DAYS, DAY_LABELS, MAX_DEPTH, clock, durationLabel } from './state.js';

const START = 7 * 60;
const END = 24 * 60;
const RANGE = END - START;
const SNAP = 15;

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const pct = mins => ((mins - START) / RANGE) * 100;
const snap15 = mins => Math.round(mins / SNAP) * SNAP;

function activityById(id) {
  return store.activityById(id);
}

function relativeGeometry(p, parent) {
  if (!parent) {
    return {
      top: pct(p.start),
      height: Math.max(3.6, (p.duration / RANGE) * 100),
    };
  }
  return {
    top: clamp(((p.start - parent.start) / parent.duration) * 100, 0, 100),
    height: clamp((p.duration / parent.duration) * 100, 8, 100),
  };
}

function traitText(activity) {
  const t = activity?.traits || {};
  return [t.location, t.energy && `精力 ${t.energy}`, t.freedom && `自由 ${t.freedom}`].filter(Boolean).join(' · ');
}

function placementHTML(p, parent = null, depth = 0) {
  const a = activityById(p.activityId);
  if (!a) return '';
  const children = store.childrenOf(p.id).sort((x, y) => x.start - y.start);
  const selected = store.get().selected?.type === 'placement' && store.get().selected.id === p.id;
  const g = relativeGeometry(p, parent);
  const childHTML = children.map(child => placementHTML(child, p, depth + 1)).join('');
  const classNames = [
    'placement-node',
    children.length ? 'has-children' : 'is-leaf',
    selected ? 'is-selected' : '',
    depth ? 'is-nested' : '',
  ].filter(Boolean).join(' ');

  return `<div class="${classNames}" data-placement="${p.id}" data-depth="${depth}" style="--top:${g.top}%;--height:${g.height}%">
    <button class="placement-surface" type="button" data-drag-handle="${p.id}" aria-label="${a.title} ${clock(p.start)} ${durationLabel(p.duration)}">
      <span class="stud-row" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      <span class="block-copy">
        <strong>${escapeHtml(a.title)}</strong>
        <small>${clock(p.start)} · ${durationLabel(p.duration)}</small>
        ${traitText(a) ? `<em>${escapeHtml(traitText(a))}</em>` : ''}
      </span>
      ${children.length ? `<span class="container-badge">${children.length} 内嵌</span>` : ''}
      <span class="resize-handle" data-resize="${p.id}" aria-label="调整时长"></span>
    </button>
    ${childHTML}
  </div>`;
}

function dayColumn(day) {
  const roots = store.get().placements.filter(p => p.day === day && !p.parentId).sort((a, b) => a.start - b.start);
  return `<section class="day-column" data-day="${day}">
    <header class="day-title"><strong>${DAY_LABELS[day]}</strong><span>${DAYS[day]}</span></header>
    <div class="day-canvas" data-day-canvas="${day}">
      <span class="period p-morning">上午</span>
      <span class="period p-afternoon">下午</span>
      <span class="period p-evening">晚上</span>
      <div class="quiet-line" style="--top:${pct(12 * 60)}%"></div>
      <div class="quiet-line" style="--top:${pct(18 * 60)}%"></div>
      ${roots.map(p => placementHTML(p)).join('')}
      <div class="snap-guide" hidden></div>
      <output class="drag-time" hidden></output>
    </div>
  </section>`;
}

export function renderBoard(root) {
  root.innerHTML = `<div class="week-board">${DAYS.map((_, i) => dayColumn(i)).join('')}</div>`;
  wireBoard(root);
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function pointerMinute(canvas, clientY) {
  const r = canvas.getBoundingClientRect();
  const y = clamp(clientY - r.top, 0, r.height);
  return START + (y / r.height) * RANGE;
}

function dayCanvasAt(clientX, clientY) {
  const el = document.elementsFromPoint(clientX, clientY).map(x => x.closest?.('[data-day-canvas]')).find(Boolean);
  return el || null;
}

function candidateParentAt(clientX, clientY, movingId = null) {
  const moving = movingId ? store.placementById(movingId) : null;
  const nodes = document.elementsFromPoint(clientX, clientY)
    .map(x => x.closest?.('[data-placement]'))
    .filter(Boolean);
  for (const node of nodes) {
    const id = node.dataset.placement;
    if (!id || id === movingId) continue;
    const parent = store.placementById(id);
    if (!parent) continue;
    if (movingId && !store.canParent(movingId, id)) continue;
    if (moving && moving.duration > parent.duration) continue;
    if (!movingId && store.depthOf(id) + 1 >= MAX_DEPTH) continue;
    return parent;
  }
  return null;
}

function collectAnchors(day, ignorePlacementId = null, parentId = null) {
  const s = store.get();
  const anchors = parentId ? [] : [8 * 60, 12 * 60, 16 * 60, 20 * 60, 22 * 60];
  const parent = parentId ? store.placementById(parentId) : null;
  if (parent) anchors.push(parent.start, parent.start + parent.duration);
  s.placements
    .filter(p => p.day === day && p.id !== ignorePlacementId && (p.parentId || null) === (parentId || null))
    .forEach(p => anchors.push(p.start, p.start + p.duration));
  return anchors;
}

function smartSnap(raw, day, ignorePlacementId = null, parentId = null) {
  const snapped = snap15(raw);
  let best = snapped;
  let dist = 13;
  collectAnchors(day, ignorePlacementId, parentId).forEach(a => {
    const d = Math.abs(raw - a);
    if (d < dist) { best = a; dist = d; }
  });
  return clamp(best, START, END - 15);
}

function constrainToParent(start, duration, parent) {
  if (!parent) return start;
  return clamp(start, parent.start, Math.max(parent.start, parent.start + parent.duration - duration));
}

function clearGuides(root) {
  root.querySelectorAll('.snap-guide,.drag-time').forEach(el => el.hidden = true);
  root.querySelectorAll('.day-canvas').forEach(el => el.classList.remove('is-target'));
  root.querySelectorAll('.placement-node').forEach(el => el.classList.remove('nest-candidate'));
}

function showGuide(root, day, minute, text, parentId = null) {
  clearGuides(root);
  const canvas = root.querySelector(`[data-day-canvas="${day}"]`);
  if (!canvas) return;
  canvas.classList.add('is-target');
  const guide = canvas.querySelector(':scope > .snap-guide');
  const bubble = canvas.querySelector(':scope > .drag-time');
  guide.style.setProperty('--top', `${pct(minute)}%`);
  guide.hidden = false;
  bubble.style.setProperty('--top', `${pct(minute)}%`);
  bubble.textContent = text;
  bubble.hidden = false;
  if (parentId) root.querySelector(`[data-placement="${parentId}"]`)?.classList.add('nest-candidate');
}

function previewPosition(root, clientX, clientY, duration, movingId = null) {
  const canvas = dayCanvasAt(clientX, clientY);
  if (!canvas) return null;
  const day = Number(canvas.dataset.dayCanvas);
  const parent = candidateParentAt(clientX, clientY, movingId);
  const parentId = parent?.id || null;
  const raw = pointerMinute(canvas, clientY);
  let start = smartSnap(raw, day, movingId, parentId);
  start = constrainToParent(start, duration, parent);
  const text = parent
    ? `放入 ${activityById(parent.activityId)?.title || '容器'} · ${clock(start)}`
    : `${clock(start)} · ${durationLabel(duration)}`;
  showGuide(root, parent ? parent.day : day, start, text, parentId);
  return { day: parent ? parent.day : day, start, parentId };
}

function wireBoard(root) {
  root.querySelectorAll('[data-drag-handle]').forEach(handle => {
    const id = handle.dataset.dragHandle;
    handle.addEventListener('click', e => { e.stopPropagation(); store.select('placement', id); });
    handle.addEventListener('pointerdown', e => {
      if (e.target.closest('[data-resize]')) return;
      beginMove(e, root, id);
    });
  });

  root.querySelectorAll('[data-resize]').forEach(handle => {
    handle.addEventListener('pointerdown', e => beginResize(e, root, handle.dataset.resize));
  });

  root.querySelectorAll('[data-day-canvas]').forEach(canvas => {
    canvas.addEventListener('click', e => {
      if (!e.target.closest('[data-placement]')) store.select(null, null);
    });
    canvas.addEventListener('dragover', e => {
      e.preventDefault();
      const activityId = document.body.dataset.dragActivity || e.dataTransfer.getData('text/activity-id');
      const a = activityById(activityId);
      if (!a) return;
      previewPosition(root, e.clientX, e.clientY, a.duration);
      e.dataTransfer.dropEffect = 'copy';
    });
    canvas.addEventListener('dragleave', e => {
      if (!canvas.contains(e.relatedTarget)) clearGuides(root);
    });
    canvas.addEventListener('drop', e => {
      e.preventDefault();
      const activityId = e.dataTransfer.getData('text/activity-id') || document.body.dataset.dragActivity;
      const a = activityById(activityId);
      if (!a) return;
      const preview = previewPosition(root, e.clientX, e.clientY, a.duration);
      if (!preview) return;
      const p = store.addPlacement(activityId, preview.day, preview.start, a.duration, preview.parentId);
      if (p) store.select('placement', p.id);
      clearGuides(root);
    });
  });
}

function beginMove(e, root, id) {
  if (e.button !== 0) return;
  const p = store.placementById(id);
  if (!p) return;
  e.preventDefault();
  e.stopPropagation();
  const node = e.currentTarget.closest('[data-placement]');
  const sourceCanvas = node.closest('[data-day-canvas]');
  const pointerAtStart = pointerMinute(sourceCanvas, e.clientY);
  const offset = pointerAtStart - p.start;
  let preview = { day: p.day, start: p.start, parentId: p.parentId || null };

  e.currentTarget.setPointerCapture(e.pointerId);
  node.classList.add('is-dragging');
  document.body.classList.add('dragging-block');

  const move = ev => {
    const canvas = dayCanvasAt(ev.clientX, ev.clientY);
    if (!canvas) return;
    const parent = candidateParentAt(ev.clientX, ev.clientY, id);
    const day = parent ? parent.day : Number(canvas.dataset.dayCanvas);
    const raw = pointerMinute(canvas, ev.clientY) - offset;
    const parentId = parent?.id || null;
    let start = smartSnap(raw, day, id, parentId);
    start = constrainToParent(start, p.duration, parent);
    preview = { day, start, parentId };
    const label = parent
      ? `放入 ${activityById(parent.activityId)?.title || '容器'} · ${clock(start)}`
      : `${clock(start)} · ${durationLabel(p.duration)}`;
    showGuide(root, day, start, label, parentId);
  };

  const up = () => {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    node.classList.remove('is-dragging');
    document.body.classList.remove('dragging-block');
    e.currentTarget.removeEventListener('pointermove', move);
    e.currentTarget.removeEventListener('pointerup', up);
    e.currentTarget.removeEventListener('pointercancel', up);
    clearGuides(root);
    store.movePlacement(id, preview);
    store.select('placement', id);
  };

  e.currentTarget.addEventListener('pointermove', move);
  e.currentTarget.addEventListener('pointerup', up);
  e.currentTarget.addEventListener('pointercancel', up);
}

function beginResize(e, root, id) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  const p = store.placementById(id);
  if (!p) return;
  const canvas = e.currentTarget.closest('[data-day-canvas]');
  const parent = p.parentId ? store.placementById(p.parentId) : null;
  const maxEnd = parent ? parent.start + parent.duration : END;
  let duration = p.duration;

  e.currentTarget.setPointerCapture(e.pointerId);
  const move = ev => {
    const end = clamp(snap15(pointerMinute(canvas, ev.clientY)), p.start + 15, maxEnd);
    duration = end - p.start;
    showGuide(root, p.day, p.start + duration, durationLabel(duration), p.parentId);
  };
  const up = () => {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    e.currentTarget.removeEventListener('pointermove', move);
    e.currentTarget.removeEventListener('pointerup', up);
    e.currentTarget.removeEventListener('pointercancel', up);
    clearGuides(root);
    store.updatePlacement(id, { duration });
    store.select('placement', id);
  };

  e.currentTarget.addEventListener('pointermove', move);
  e.currentTarget.addEventListener('pointerup', up);
  e.currentTarget.addEventListener('pointercancel', up);
}
