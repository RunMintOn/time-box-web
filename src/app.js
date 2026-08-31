import { store, DAY_LABELS, clock, durationLabel } from './state.js';
import { renderBoard } from './board.js';

const $ = s => document.querySelector(s);
const boardRoot = $('#boardRoot');
const libraryRoot = $('#libraryRoot');
const inspectorRoot = $('#inspectorRoot');

function repeatLabel(days) {
  if (!days?.length) return '不重复';
  return days.map(d => DAY_LABELS[d].replace('周', '')).join(' ');
}

function renderLibrary() {
  const s = store.get();
  libraryRoot.innerHTML = `
    <div class="panel-heading">
      <div><span class="eyebrow">BLOCK LIBRARY</span><h2>积木盒</h2></div>
      <button class="icon-button" id="newActivity" title="新建 Activity">＋</button>
    </div>
    <p class="panel-copy">拖一块到本周。这里是一件事情本身；右边出现的是它的实例。</p>
    <div class="library-list">
      ${s.activities.map(a => `<article class="library-block" draggable="true" data-activity="${a.id}">
        <span class="library-grip" aria-hidden="true">⠿</span>
        <div class="library-text"><strong>${a.title}</strong><span>≈ ${durationLabel(a.duration)}</span></div>
        <div class="library-tags"><span>${a.rigidity}</span><span>${repeatLabel(a.repeatDays)}</span></div>
        ${a.repeatDays?.length ? `<button class="tiny-action" data-spread="${a.id}">铺到本周</button>` : ''}
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
    e.stopPropagation(); store.spreadActivity(btn.dataset.spread);
  }));
  $('#newActivity')?.addEventListener('click', () => openActivityDialog());
  $('#newActivityBottom')?.addEventListener('click', () => openActivityDialog());
}

function renderInspector() {
  const s = store.get();
  const selected = s.selected;
  if (!selected) {
    inspectorRoot.innerHTML = `<div class="inspector-empty"><span class="eyebrow">INSPECTOR</span><div class="empty-glyph">◇</div><strong>选择一个积木</strong><p>点击 Activity、Placement 或 Context，在这里编辑。</p></div>`;
    return;
  }

  if (selected.type === 'placement') {
    const p = s.placements.find(x => x.id === selected.id);
    const a = p && s.activities.find(x => x.id === p.activityId);
    if (!p || !a) return store.select(null, null);
    inspectorRoot.innerHTML = `<div class="inspector-content">
      <span class="eyebrow">PLACEMENT</span><h2>${a.title}</h2>
      <div class="metric-row"><span>${DAY_LABELS[p.day]}</span><strong>${clock(p.start)}</strong></div>
      <label class="field"><span>开始</span><input id="pStart" type="time" value="${clock(p.start)}"></label>
      <label class="field"><span>本次时长</span><input id="pDuration" type="number" min="15" step="15" value="${p.duration}"></label>
      <label class="field"><span>星期</span><select id="pDay">${DAY_LABELS.map((d,i)=>`<option value="${i}" ${i===p.day?'selected':''}>${d}</option>`).join('')}</select></label>
      <div class="inspector-actions"><button class="danger-button" id="deletePlacement">删除这次</button></div>
    </div>`;
    $('#pStart').addEventListener('change', e => store.updatePlacement(p.id, { start: toMinutes(e.target.value) }));
    $('#pDuration').addEventListener('change', e => store.updatePlacement(p.id, { duration: Math.max(15, Number(e.target.value) || 15) }));
    $('#pDay').addEventListener('change', e => store.updatePlacement(p.id, { day: Number(e.target.value) }));
    $('#deletePlacement').addEventListener('click', () => store.removePlacement(p.id));
    return;
  }

  if (selected.type === 'activity') {
    const a = s.activities.find(x => x.id === selected.id);
    if (!a) return store.select(null, null);
    inspectorRoot.innerHTML = `<div class="inspector-content">
      <span class="eyebrow">ACTIVITY</span><h2>${a.title}</h2>
      <p class="panel-copy">这是“积木模具”。改这里会影响以后新放下的实例。</p>
      <label class="field"><span>名称</span><input id="aTitle" value="${escapeHtml(a.title)}"></label>
      <label class="field"><span>默认时长</span><input id="aDuration" type="number" min="15" step="15" value="${a.duration}"></label>
      <label class="field"><span>时间刚性</span><select id="aRigidity"><option value="flexible">Flexible</option><option value="approx">Approx</option><option value="fixed">Fixed</option></select></label>
      <div class="inspector-actions"><button class="danger-button" id="deleteActivity">删除 Activity</button></div>
    </div>`;
    $('#aRigidity').value = a.rigidity;
    $('#aTitle').addEventListener('change', e => store.updateActivity(a.id, { title: e.target.value.trim() || '未命名' }));
    $('#aDuration').addEventListener('change', e => store.updateActivity(a.id, { duration: Math.max(15, Number(e.target.value) || 15) }));
    $('#aRigidity').addEventListener('change', e => store.updateActivity(a.id, { rigidity: e.target.value }));
    $('#deleteActivity').addEventListener('click', () => store.removeActivity(a.id));
    return;
  }

  if (selected.type === 'context') {
    const c = s.contexts.find(x => x.id === selected.id);
    if (!c) return store.select(null, null);
    inspectorRoot.innerHTML = `<div class="inspector-content">
      <span class="eyebrow">CONTEXT</span><h2>${c.title}</h2>
      <p class="panel-copy">这是背景条件，不代表你一定在做这件事。</p>
      <label class="field"><span>名称</span><input id="cTitle" value="${escapeHtml(c.title)}"></label>
      <label class="field"><span>地点</span><input id="cLocation" value="${escapeHtml(c.location)}"></label>
      <div class="two-fields"><label class="field"><span>开始</span><input id="cStart" type="time" value="${clock(c.start)}"></label><label class="field"><span>结束</span><input id="cEnd" type="time" value="${clock(c.end)}"></label></div>
      <div class="inspector-actions"><button class="danger-button" id="deleteContext">删除 Context</button></div>
    </div>`;
    $('#cTitle').addEventListener('change', e => store.updateContext(c.id, { title: e.target.value.trim() || 'Context' }));
    $('#cLocation').addEventListener('change', e => store.updateContext(c.id, { location: e.target.value.trim() }));
    $('#cStart').addEventListener('change', e => store.updateContext(c.id, { start: toMinutes(e.target.value) }));
    $('#cEnd').addEventListener('change', e => store.updateContext(c.id, { end: toMinutes(e.target.value) }));
    $('#deleteContext').addEventListener('click', () => store.removeContext(c.id));
  }
}

function toMinutes(value) { const [h,m] = value.split(':').map(Number); return h*60+m; }
function escapeHtml(value='') { return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

function openActivityDialog() {
  const d = $('#activityDialog');
  d.querySelector('form').reset();
  d.showModal();
}

function openContextDialog() {
  const d = $('#contextDialog');
  d.querySelector('form').reset();
  d.showModal();
}

function wireDialogs() {
  $('#activityForm').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const repeatDays = [...e.currentTarget.querySelectorAll('[name="repeatDay"]:checked')].map(x => Number(x.value));
    const a = store.addActivity({ title: fd.get('title'), duration: fd.get('duration'), rigidity: fd.get('rigidity'), repeatDays });
    store.select('activity', a.id); $('#activityDialog').close();
  });
  $('#contextForm').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const c = store.addContext({ day: fd.get('day'), title: fd.get('title'), location: fd.get('location'), start: toMinutes(fd.get('start')), end: toMinutes(fd.get('end')), energy: fd.get('energy'), freedom: fd.get('freedom') });
    store.select('context', c.id); $('#contextDialog').close();
  });
  document.querySelectorAll('[data-close-dialog]').forEach(btn => btn.addEventListener('click', () => btn.closest('dialog').close()));
}

function renderAll() {
  renderLibrary(); renderBoard(boardRoot); renderInspector();
}

$('#addContext').addEventListener('click', openContextDialog);
$('#addActivity').addEventListener('click', openActivityDialog);
$('#resetDemo').addEventListener('click', () => { if (confirm('重置为示例数据？')) store.reset(); });

wireDialogs();
store.subscribe(renderAll);
renderAll();
