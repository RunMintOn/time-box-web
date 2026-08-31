import { store, DAY_LABELS, clock, durationLabel } from './state.js';
import { renderBoard } from './board.js';

const $ = s => document.querySelector(s);
const boardRoot = $('#boardRoot');
const libraryRoot = $('#libraryRoot');
const inspectorRoot = $('#inspectorRoot');

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function toMinutes(value) {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

function repeatLabel(days) {
  if (!days?.length) return '不重复';
  return days.map(d => DAY_LABELS[d].replace('周', '')).join(' ');
}

function traitSummary(a) {
  const t = a.traits || {};
  return [t.location, t.energy && `精力 ${t.energy}`, t.freedom && `自由 ${t.freedom}`].filter(Boolean).join(' · ');
}

function renderLibrary() {
  const s = store.get();
  libraryRoot.innerHTML = `
    <div class="panel-heading">
      <div><span class="eyebrow">ACTIVITY LIBRARY</span><h2>积木盒</h2></div>
      <button class="icon-button" id="newActivity" title="新建 Activity">＋</button>
    </div>
    <p class="panel-copy">这里只有一种东西：Activity。拖到空白处是独立积木；拖到另一块里面就会嵌套。</p>
    <div class="library-list">
      ${s.activities.map(a => `
        <article class="library-block" draggable="true" data-activity="${a.id}">
          <span class="library-grip" aria-hidden="true">⠿</span>
          <div class="library-text"><strong>${escapeHtml(a.title)}</strong><span>≈ ${durationLabel(a.duration)}</span></div>
          ${traitSummary(a) ? `<p class="library-traits">${escapeHtml(traitSummary(a))}</p>` : ''}
          <div class="library-tags"><span>${a.rigidity}</span><span>${repeatLabel(a.repeatDays)}</span></div>
          ${a.repeatDays?.length ? `<button class="tiny-action" type="button" data-spread="${a.id}">铺到本周</button>` : ''}
        </article>`).join('')}
    </div>
    <button class="add-wide" id="newActivityBottom">＋ 新积木</button>`;

  libraryRoot.querySelectorAll('[data-activity]').forEach(card => {
    card.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/activity-id', card.dataset.activity);
      e.dataTransfer.effectAllowed = 'copy';
      card.classList.add('is-dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('is-dragging'));
    card.addEventListener('click', e => {
      if (e.target.closest('[data-spread]')) return;
      store.select('activity', card.dataset.activity);
    });
  });

  libraryRoot.querySelectorAll('[data-spread]').forEach(btn => btn.addEventListener('click', e => {
    e.stopPropagation();
    store.spreadActivity(btn.dataset.spread);
  }));

  $('#newActivity')?.addEventListener('click', openActivityDialog);
  $('#newActivityBottom')?.addEventListener('click', openActivityDialog);
}

function placementPath(p) {
  const parts = [];
  let current = p;
  const seen = new Set();
  while (current?.parentId && !seen.has(current.parentId)) {
    seen.add(current.parentId);
    const parent = store.placementById(current.parentId);
    if (!parent) break;
    const a = store.activityById(parent.activityId);
    if (a) parts.unshift(a.title);
    current = parent;
  }
  return parts;
}

function inheritedTraits(p) {
  const own = store.activityById(p.activityId)?.traits || {};
  const chain = [];
  let current = p;
  while (current?.parentId) {
    current = store.placementById(current.parentId);
    if (current) chain.unshift(store.activityById(current.activityId)?.traits || {});
  }
  return chain.reduce((acc, traits) => ({ ...acc, ...Object.fromEntries(Object.entries(traits).filter(([, v]) => v)) }), { ...own });
}

function renderInspector() {
  const selected = store.get().selected;
  if (!selected) {
    inspectorRoot.innerHTML = `<div class="inspector-empty"><span class="eyebrow">INSPECTOR</span><div class="empty-glyph">◇</div><strong>选择一块积木</strong><p>Activity 是模具；Placement 是它在本周的一次出现。任何 Placement 都可以继续装别的 Placement。</p></div>`;
    return;
  }

  if (selected.type === 'placement') {
    const p = store.placementById(selected.id);
    const a = p && store.activityById(p.activityId);
    if (!p || !a) return store.select(null, null);
    const path = placementPath(p);
    const children = store.childrenOf(p.id);
    const inherited = inheritedTraits(p);
    inspectorRoot.innerHTML = `
      <div class="inspector-content">
        <span class="eyebrow">PLACEMENT</span>
        <h2>${escapeHtml(a.title)}</h2>
        ${path.length ? `<div class="nest-path">${path.map(escapeHtml).join(' / ')} / <strong>${escapeHtml(a.title)}</strong></div>` : '<div class="nest-path">顶层积木</div>'}
        <div class="metric-row"><span>${DAY_LABELS[p.day]}</span><strong>${clock(p.start)} · ${durationLabel(p.duration)}</strong></div>
        ${children.length ? `<div class="container-summary"><strong>这是一个容器</strong><span>里面有 ${children.length} 块 Activity</span></div>` : `<div class="container-summary muted"><strong>也可以作为容器</strong><span>把别的积木拖到它里面即可</span></div>`}
        <label class="field"><span>开始</span><input id="pStart" type="time" value="${clock(p.start)}"></label>
        <label class="field"><span>本次时长</span><input id="pDuration" type="number" min="15" step="15" value="${p.duration}"></label>
        <label class="field"><span>星期</span><select id="pDay">${DAY_LABELS.map((d, i) => `<option value="${i}" ${i === p.day ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
        ${(inherited.location || inherited.energy || inherited.freedom) ? `<div class="trait-stack"><span class="eyebrow">当前环境</span>${inherited.location ? `<span>地点 · ${escapeHtml(inherited.location)}</span>` : ''}${inherited.energy ? `<span>精力 · ${escapeHtml(inherited.energy)}</span>` : ''}${inherited.freedom ? `<span>自由度 · ${escapeHtml(inherited.freedom)}</span>` : ''}</div>` : ''}
        <div class="inspector-actions">
          ${p.parentId ? '<button class="button" id="detachPlacement" type="button">移出容器</button>' : ''}
          <button class="danger-button" id="deletePlacement" type="button">删除这次</button>
        </div>
      </div>`;

    $('#pStart').addEventListener('change', e => store.updatePlacement(p.id, { start: toMinutes(e.target.value) }));
    $('#pDuration').addEventListener('change', e => store.updatePlacement(p.id, { duration: Math.max(15, Number(e.target.value) || 15) }));
    $('#pDay').addEventListener('change', e => {
      if (p.parentId) return;
      store.updatePlacement(p.id, { day: Number(e.target.value) });
    });
    if (p.parentId) $('#pDay').disabled = true;
    $('#detachPlacement')?.addEventListener('click', () => store.movePlacement(p.id, { day: p.day, start: p.start, parentId: null }));
    $('#deletePlacement').addEventListener('click', () => store.removePlacement(p.id));
    return;
  }

  if (selected.type === 'activity') {
    const a = store.activityById(selected.id);
    if (!a) return store.select(null, null);
    inspectorRoot.innerHTML = `
      <div class="inspector-content">
        <span class="eyebrow">ACTIVITY</span><h2>${escapeHtml(a.title)}</h2>
        <p class="panel-copy">这是积木模具。地点、精力、自由度会被放进去的子 Activity 继承。</p>
        <label class="field"><span>名称</span><input id="aTitle" value="${escapeHtml(a.title)}"></label>
        <label class="field"><span>默认时长</span><input id="aDuration" type="number" min="15" step="15" value="${a.duration}"></label>
        <label class="field"><span>时间刚性</span><select id="aRigidity"><option value="flexible">Flexible</option><option value="approx">Approx</option><option value="fixed">Fixed</option></select></label>
        <label class="field"><span>地点</span><input id="aLocation" value="${escapeHtml(a.traits?.location || '')}" placeholder="可留空"></label>
        <div class="two-fields">
          <label class="field"><span>精力</span><select id="aEnergy"><option value="">—</option><option>低</option><option>中</option><option>高</option></select></label>
          <label class="field"><span>自由度</span><select id="aFreedom"><option value="">—</option><option>低</option><option>中</option><option>高</option></select></label>
        </div>
        <div class="inspector-actions"><button class="danger-button" id="deleteActivity" type="button">删除 Activity</button></div>
      </div>`;
    $('#aRigidity').value = a.rigidity;
    $('#aEnergy').value = a.traits?.energy || '';
    $('#aFreedom').value = a.traits?.freedom || '';
    $('#aTitle').addEventListener('change', e => store.updateActivity(a.id, { title: e.target.value.trim() || '未命名' }));
    $('#aDuration').addEventListener('change', e => store.updateActivity(a.id, { duration: Math.max(15, Number(e.target.value) || 15) }));
    $('#aRigidity').addEventListener('change', e => store.updateActivity(a.id, { rigidity: e.target.value }));
    $('#aLocation').addEventListener('change', e => store.updateActivity(a.id, { traits: { location: e.target.value.trim() } }));
    $('#aEnergy').addEventListener('change', e => store.updateActivity(a.id, { traits: { energy: e.target.value } }));
    $('#aFreedom').addEventListener('change', e => store.updateActivity(a.id, { traits: { freedom: e.target.value } }));
    $('#deleteActivity').addEventListener('click', () => store.removeActivity(a.id));
  }
}

function openActivityDialog() {
  const d = $('#activityDialog');
  d.querySelector('form').reset();
  d.showModal();
}

function wireDialog() {
  $('#activityForm').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const repeatDays = [...e.currentTarget.querySelectorAll('[name="repeatDay"]:checked')].map(x => Number(x.value));
    const a = store.addActivity({
      title: fd.get('title'),
      duration: fd.get('duration'),
      rigidity: fd.get('rigidity'),
      repeatDays,
      location: fd.get('location'),
      energy: fd.get('energy'),
      freedom: fd.get('freedom'),
    });
    store.select('activity', a.id);
    $('#activityDialog').close();
  });
  document.querySelectorAll('[data-close-dialog]').forEach(btn => btn.addEventListener('click', () => btn.closest('dialog').close()));
}

function renderAll() {
  renderLibrary();
  renderBoard(boardRoot);
  renderInspector();
}

$('#addActivity').addEventListener('click', openActivityDialog);
$('#resetDemo').addEventListener('click', () => { if (confirm('重置为新的嵌套示例数据？')) store.reset(); });

wireDialog();
store.subscribe(renderAll);
renderAll();
