import './style.css';
import * as THREE from 'three';
import { CATALOG, BY_ID, GROUPS, REGIONS, fullName, sideLabel } from './data/catalog.js';
import { STRINGS } from './i18n.js';
import { Viewer, ANTERIOR, PATIENT_RIGHT } from './viewer.js';
import { checkAnswer, maskName, shuffle, normalize, stripDiacritics } from './quiz.js';

// ------------------------------------------------------------------ state
const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem('kostra.' + k);
      return v === null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem('kostra.' + k, JSON.stringify(v));
    } catch {}
  },
};

const state = {
  lang: store.get('lang', navigator.language?.startsWith('cs') || navigator.language?.startsWith('sk') ? 'cs' : 'en'),
  theme: store.get('theme', null),
  mode: 'explore',
  region: 'skeleton',
  side: 'R',
  search: '',
  showCartilage: store.get('showCartilage', true),
  showTeeth: store.get('showTeeth', true),
  selected: null,
  isolated: false,
  autoRotate: false,
  quizCfg: store.get('quizCfg', { difficulty: 'easy', answerLang: 'cs', count: 10, teeth: false, cartilage: false }),
  quiz: null,
};

const $ = (s) => document.querySelector(s);
const t = (k) => STRINGS[state.lang][k];
const isTouch = matchMedia('(hover: none)').matches;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const otherLang = () => (state.lang === 'cs' ? 'en' : 'cs');
const region = () => REGIONS.find((r) => r.key === state.region);

// ------------------------------------------------------------------ viewer
const viewer = new Viewer($('#canvasWrap'));
const UP = new THREE.Vector3(0, 1, 0);

function sideVec() {
  return state.side === 'R' ? PATIENT_RIGHT.clone() : PATIENT_RIGHT.clone().negate();
}

function regionViewDir() {
  const A = ANTERIOR.clone();
  switch (state.region) {
    case 'skull':
      return A.addScaledVector(PATIENT_RIGHT, 0.45).addScaledVector(UP, 0.08).normalize();
    case 'spine':
      return PATIENT_RIGHT.clone().negate().addScaledVector(A, 0.35).normalize();
    case 'pelvis':
      return A.addScaledVector(UP, 0.25).normalize();
    case 'upperLimb':
      return A.addScaledVector(sideVec(), 0.3).normalize();
    case 'hand':
      return A.addScaledVector(sideVec(), 0.15).normalize();
    case 'foot':
      return A.multiplyScalar(0.55).add(UP).addScaledVector(sideVec(), 0.35).normalize();
    case 'lowerLimb':
      return A.addScaledVector(sideVec(), 0.2).normalize();
    default:
      return A;
  }
}

function entriesFor(regionKey, side, { cartilage, teeth }) {
  const r = REGIONS.find((x) => x.key === regionKey);
  return CATALOG.filter(
    (e) =>
      e.regions.includes(regionKey) &&
      (!r.sided || e.side === side) &&
      (cartilage || (e.kind !== 'disc' && e.kind !== 'cartilage')) &&
      (teeth || e.kind !== 'tooth'),
  );
}

function exploreEntries() {
  return entriesFor(state.region, state.side, { cartilage: state.showCartilage, teeth: state.showTeeth });
}

function applyVisibility({ frame = true, animate = true } = {}) {
  let ids;
  if (state.mode === 'test' && state.quiz) {
    ids = state.quiz.visibleIds;
  } else if (state.isolated && state.selected) {
    ids = [state.selected];
  } else {
    ids = exploreEntries().map((e) => e.id);
  }
  viewer.setVisible(ids);
  if (frame) viewer.frameBox(viewer.boxOf(ids), regionViewDir(), { animate });
}

// ------------------------------------------------------------------ i18n
function applyI18n() {
  document.documentElement.lang = state.lang;
  document.title = `${t('title')} · 3D atlas`;
  document.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
    el.setAttribute('aria-label', t(el.dataset.i18nTitle));
  });
  document.querySelectorAll('.lang-switch button').forEach((b) => b.classList.toggle('active', b.dataset.lang === state.lang));
  $('#search').placeholder = t('search');
  $('#hintBar').textContent = isTouch ? t('hintTouch') : t('hint');
  $('#aboutBody').innerHTML = aboutHtml();
}

function aboutHtml() {
  if (state.lang === 'cs')
    return `<p>Interaktivní 3D atlas lidské kostry. V režimu <b>Prozkoumat</b> najeďte myší na libovolnou kost a zobrazí se její český, anglický a latinský název. Oblasti těla (lebka, páteř, ruka, noha…) si můžete zobrazit samostatně. V režimu <b>Test</b> si názvy procvičíte ve třech obtížnostech.</p>
      <p><b>3D modely:</b> <a href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/" target="_blank" rel="noopener">BodyParts3D</a>, © The Database Center for Life Science, licence <a href="https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en" target="_blank" rel="noopener">CC BY-SA 2.1 Japan</a> (zjednodušeno pro web). Identifikátory podle ontologie FMA.</p>
      <p><b>Názvosloví:</b> latinsky podle Terminologia Anatomica, česky podle běžné české anatomické terminologie.</p>
      <p>Model neobsahuje kostrč a sluchové kůstky (nejsou v datech BodyParts3D 3.0).</p>`;
  return `<p>An interactive 3D atlas of the human skeleton. In <b>Explore</b> mode hover any bone to see its English, Czech and Latin name. Body regions (skull, spine, hand, foot…) can be viewed on their own. In <b>Quiz</b> mode you can practise the names at three difficulty levels.</p>
    <p><b>3D models:</b> <a href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/" target="_blank" rel="noopener">BodyParts3D</a>, © The Database Center for Life Science, licensed <a href="https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en" target="_blank" rel="noopener">CC BY-SA 2.1 Japan</a> (simplified for the web). Identifiers follow the FMA ontology.</p>
    <p><b>Nomenclature:</b> Latin per Terminologia Anatomica; Czech per standard Czech anatomical terminology.</p>
    <p>The model does not include the coccyx and the auditory ossicles (absent from BodyParts3D 3.0).</p>`;
}

function applyTheme() {
  if (state.theme) document.documentElement.dataset.theme = state.theme;
  else delete document.documentElement.dataset.theme;
}

// ------------------------------------------------------------------ sidebar: regions
function renderRegions() {
  $('#regionGrid').innerHTML = REGIONS.map(
    (r) =>
      `<button class="region-btn ${r.key === state.region ? 'active' : ''}" data-region="${r.key}"><span class="ico">${r.icon}</span>${esc(r[state.lang])}</button>`,
  ).join('');
  $('#sideRow').hidden = !region().sided;
  const all = entriesFor(state.region, state.side, { cartilage: true, teeth: true });
  $('#optTeeth').closest('label').hidden = !all.some((e) => e.kind === 'tooth');
  $('#optCartilage').closest('label').hidden = !all.some((e) => e.kind === 'disc' || e.kind === 'cartilage');
  document.querySelectorAll('#sideSeg button').forEach((b) => b.classList.toggle('active', b.dataset.side === state.side));
}

$('#regionGrid').addEventListener('click', (e) => {
  const b = e.target.closest('[data-region]');
  if (!b || state.quiz) return;
  state.region = b.dataset.region;
  state.isolated = false;
  if (state.selected && !exploreEntries().some((x) => x.id === state.selected)) selectBone(null);
  renderRegions();
  renderList();
  renderTestPanel();
  applyVisibility();
});
$('#sideSeg').addEventListener('click', (e) => {
  const b = e.target.closest('[data-side]');
  if (!b || state.quiz) return;
  state.side = b.dataset.side;
  state.isolated = false;
  if (state.selected && !exploreEntries().some((x) => x.id === state.selected)) selectBone(null);
  renderRegions();
  renderList();
  renderTestPanel();
  applyVisibility();
});

// ------------------------------------------------------------------ sidebar: bone list
function matchesSearch(e, q) {
  if (!q) return true;
  const hay = stripDiacritics([fullName(e, 'cs'), fullName(e, 'en'), fullName(e, 'la'), e.info || ''].join(' | ').toLowerCase());
  return q.split(' ').every((w) => hay.includes(w));
}

function renderList() {
  const q = stripDiacritics(normalize(state.search));
  const items = exploreEntries().filter((e) => matchesSearch(e, q));
  $('#boneCount').textContent = t('count')(items.length);
  if (!items.length) {
    $('#boneList').innerHTML = `<div class="empty">${t('noResults')}</div>`;
    return;
  }
  const groups = new Map();
  for (const e of items) {
    if (!groups.has(e.group)) groups.set(e.group, []);
    groups.get(e.group).push(e);
  }
  const sideTag = (e) => (e.side ? `<span class="side">${state.lang === 'cs' ? (e.side === 'R' ? 'P' : 'L') : e.side}</span>` : '');
  $('#boneList').innerHTML = [...groups]
    .map(
      ([g, list]) =>
        `<div class="bone-group"><h3>${esc(GROUPS[g][state.lang])}</h3>${list
          .map(
            (e) =>
              `<button class="bone-item ${e.id === state.selected ? 'active' : ''}" data-id="${e.id}"><span class="n">${esc(e.base[state.lang])}${sideTag(e)}</span><span class="l">${esc(e.base.la)}</span></button>`,
          )
          .join('')}</div>`,
    )
    .join('');
}

$('#search').addEventListener('input', (e) => {
  state.search = e.target.value;
  renderList();
});
$('#boneList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-id]');
  if (b) selectBone(b.dataset.id, { focus: true });
});
$('#boneList').addEventListener('mouseover', (e) => {
  const b = e.target.closest('[data-id]');
  if (b && viewer.hovered !== b.dataset.id) {
    viewer.hovered = b.dataset.id;
    viewer._refreshMaterials();
  }
});
$('#boneList').addEventListener('mouseleave', () => {
  viewer.hovered = null;
  viewer._refreshMaterials();
});
for (const [id, key] of [
  ['#optCartilage', 'showCartilage'],
  ['#optTeeth', 'showTeeth'],
]) {
  const el = $(id);
  el.checked = state[key];
  el.addEventListener('change', () => {
    state[key] = el.checked;
    store.set(key, el.checked);
    renderList();
    applyVisibility({ frame: false });
  });
}

// ------------------------------------------------------------------ tooltip
const tip = $('#tooltip');
function tooltipHtml(e) {
  const main = fullName(e, state.lang);
  const other = fullName(e, otherLang());
  const meta = [GROUPS[e.group][state.lang], e.info].filter(Boolean).join(' · ');
  return `<div class="t-main">${esc(main)}</div>
    <div class="t-latin">${esc(fullName(e, 'la'))}</div>
    <div class="t-other">${state.lang === 'cs' ? 'EN' : 'CZ'}: ${esc(other)}</div>
    <div class="t-meta">${esc(meta)}</div>`;
}
function positionTip(pos) {
  const pad = 16;
  const r = tip.getBoundingClientRect();
  let x = pos.x + 18;
  let y = pos.y + 18;
  if (x + r.width > innerWidth - pad) x = pos.x - r.width - 18;
  if (y + r.height > innerHeight - pad) y = pos.y - r.height - 18;
  tip.style.left = Math.max(pad, x) + 'px';
  tip.style.top = Math.max(pad, y) + 'px';
}
viewer.on('hover', (id, pos) => {
  if (state.mode !== 'explore' || !id || !pos) {
    tip.hidden = true;
    viewer.renderer.domElement.style.cursor = '';
    return;
  }
  const e = BY_ID[id];
  if (!e) return;
  viewer.renderer.domElement.style.cursor = 'pointer';
  if (tip.dataset.id !== id || tip.hidden) {
    tip.innerHTML = tooltipHtml(e);
    tip.dataset.id = id;
    tip.hidden = false;
  }
  positionTip(pos);
});

// ------------------------------------------------------------------ selection / info card
function selectBone(id, { focus = false } = {}) {
  state.selected = id;
  viewer.setSelected(id);
  renderInfo();
  document.querySelectorAll('.bone-item').forEach((b) => b.classList.toggle('active', b.dataset.id === id));
  if (id) {
    const el = document.querySelector(`.bone-item[data-id="${id}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (focus) focusBone(id);
  } else if (state.isolated) {
    state.isolated = false;
    applyVisibility({ frame: false });
  }
}

function focusBone(id) {
  const box = viewer.boxOf([id]);
  const r = box.getBoundingSphere(new THREE.Sphere()).radius;
  const dir = viewer.bestViewDir(id, candidateDirs()).dir;
  viewer.frameBox(box, dir, { minRadius: Math.max(r * 2.2, 0.03) });
}

function candidateDirs() {
  const A = ANTERIOR, R = PATIENT_RIGHT;
  const base = regionViewDir();
  return [
    base,
    A.clone(),
    A.clone().add(R).normalize(),
    A.clone().sub(R).normalize(),
    R.clone(),
    R.clone().negate(),
    A.clone().negate(),
    A.clone().add(UP).normalize(),
    A.clone().negate().add(UP).normalize(),
    UP.clone().addScaledVector(A, 0.2).normalize(),
    A.clone().sub(UP).normalize(),
  ];
}

function renderInfo() {
  const card = $('#infoCard');
  const e = state.selected && BY_ID[state.selected];
  if (!e || state.mode !== 'explore') {
    card.hidden = true;
    return;
  }
  const L = state.lang;
  const rows = [
    [t('czech'), fullName(e, 'cs'), ''],
    [t('english'), fullName(e, 'en'), ''],
    [t('latin'), fullName(e, 'la'), 'la'],
  ];
  card.innerHTML = `<button class="x" data-act="close" aria-label="${t('close')}">✕</button>
    <div class="kicker">${esc(GROUPS[e.group][L])}${e.info ? ' · ' + esc(e.info) : ''}</div>
    <div class="names"><div class="big">${esc(fullName(e, L))}</div></div>
    <dl>${rows.map(([k, v, c]) => `<dt>${k}</dt><dd class="${c}">${esc(v)}</dd>`).join('')}</dl>
    <div class="row">
      <button class="btn" data-act="focus">🔍 ${t('focus')}</button>
      <button class="btn" data-act="isolate">${state.isolated ? '👁 ' + t('showAll') : '◎ ' + t('isolate')}</button>
    </div>`;
  card.hidden = false;
}

$('#infoCard').addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'close') selectBone(null);
  if (act === 'focus') focusBone(state.selected);
  if (act === 'isolate') {
    state.isolated = !state.isolated;
    applyVisibility({ frame: false });
    if (state.isolated) focusBone(state.selected);
    else applyVisibility();
    renderInfo();
  }
});

viewer.on('click', (id) => {
  if (state.mode !== 'explore') return;
  if (id) selectBone(id);
  else if (!isTouch) selectBone(null);
  else tip.hidden = true;
});

// ------------------------------------------------------------------ toolbar
$('#resetBtn').addEventListener('click', () => {
  if (state.quiz && state.quiz.current) showQuestionView(true);
  else applyVisibility();
});
$('#rotateBtn').addEventListener('click', () => {
  state.autoRotate = !state.autoRotate;
  viewer.setAutoRotate(state.autoRotate);
  $('#rotateBtn').classList.toggle('active', state.autoRotate);
});
$('#xrayBtn').addEventListener('click', () => {
  if (!state.quiz?.current) return;
  state.quiz.xray = !state.quiz.xray;
  viewer.setTarget(state.quiz.current.id, { dim: state.quiz.xray });
  $('#xrayBtn').classList.toggle('active', state.quiz.xray);
});

// ------------------------------------------------------------------ mode tabs
function setMode(mode) {
  state.mode = mode;
  document.body.dataset.mode = mode;
  document.querySelectorAll('.mode-tabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.mode === mode));
  tip.hidden = true;
  if (mode === 'explore') {
    if (state.quiz) endQuiz(false);
    viewer.setHoverEnabled(true);
    viewer.setTarget(null);
    viewer.setSelected(state.selected);
    renderInfo();
    applyVisibility();
  } else {
    viewer.setHoverEnabled(false);
    viewer.setSelected(null);
    state.isolated = false;
    renderTestPanel();
    applyVisibility();
  }
  // změna rozložení na mobilu
  requestAnimationFrame(() => viewer.resize());
}
document.querySelectorAll('.mode-tabs button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

// ------------------------------------------------------------------ language / theme / about
document.querySelectorAll('.lang-switch button').forEach((b) =>
  b.addEventListener('click', () => {
    state.lang = b.dataset.lang;
    store.set('lang', state.lang);
    applyI18n();
    renderRegions();
    renderList();
    renderInfo();
    renderTestPanel();
    if (state.quiz?.current) renderQuizCard();
    tip.hidden = true;
  }),
);
$('#themeBtn').addEventListener('click', () => {
  const dark = state.theme ? state.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  state.theme = dark ? 'light' : 'dark';
  store.set('theme', state.theme);
  applyTheme();
});
$('#aboutBtn').addEventListener('click', () => $('#aboutDlg').showModal());

// ================================================================== TEST
const DIFFS = [
  { key: 'easy', dots: '●○○' },
  { key: 'medium', dots: '●●○' },
  { key: 'hard', dots: '●●●' },
];
const DIFF_LABEL = { easy: 'diffEasy', medium: 'diffMedium', hard: 'diffHard' };
const LANG_LABEL = { cs: 'czech', en: 'english', la: 'latin' };

function quizPool(cfg = state.quizCfg) {
  const list = entriesFor(state.region, state.side, { cartilage: cfg.cartilage, teeth: cfg.teeth });
  // stejné jméno vlevo i vpravo = jedna otázka (strana se vybere náhodně)
  const byName = new Map();
  for (const e of shuffle(list)) {
    const k = e.base[cfg.answerLang];
    if (!byName.has(k)) byName.set(k, e);
  }
  return [...byName.values()];
}

function renderTestPanel() {
  const p = $('#testPanel');
  if (state.quiz) {
    const q = state.quiz;
    const n = q.questions.length;
    const answered = q.answers.length;
    const okCount = q.answers.filter((a) => a.result !== 'wrong').length;
    const w = (c) => (100 * q.answers.filter((a) => a.result === c).length) / n;
    p.innerHTML = `<div class="test-progress">
        <h2 class="panel-title">${t('score')}</h2>
        <div class="score-big"><b>${okCount}</b><span>/ ${answered} · ${t('question')} ${Math.min(answered + 1, n)} ${t('of')} ${n}</span></div>
        <div class="bar"><i class="ok" style="width:${w('correct')}%"></i><i class="almost" style="width:${w('almost')}%"></i><i class="bad" style="width:${w('wrong')}%"></i></div>
        <p class="test-meta">${t(DIFF_LABEL[q.cfg.difficulty])} · ${t(LANG_LABEL[q.cfg.answerLang])} · ${esc(region()[state.lang])}${region().sided ? ' (' + t(state.side === 'R' ? 'right' : 'left').toLowerCase() + ')' : ''}</p>
      </div>
      <div class="history">${q.answers
        .map((a) => {
          const e = BY_ID[a.id];
          const cls = a.result === 'correct' ? 'ok' : a.result === 'almost' ? 'almost' : 'bad';
          const mark = a.result === 'correct' ? '✓' : a.result === 'almost' ? '≈' : '✗';
          return `<div class="history-item ${cls}"><span class="mark">${mark}</span><span>${esc(e.base[q.cfg.answerLang])}${a.result === 'wrong' && a.input ? ` <small>(${esc(a.input)})</small>` : ''}</span></div>`;
        })
        .reverse()
        .join('')}</div>
      <button class="btn ghost block" id="quitQuiz" style="margin-top:10px">${t('quit')}</button>`;
    $('#quitQuiz').onclick = () => endQuiz(false);
    return;
  }
  const cfg = state.quizCfg;
  const poolSize = quizPool().length;
  const regionAll = entriesFor(state.region, state.side, { cartilage: true, teeth: true });
  const has = {
    teeth: regionAll.some((e) => e.kind === 'tooth'),
    cartilage: regionAll.some((e) => e.kind === 'disc' || e.kind === 'cartilage'),
  };
  const counts = [10, 20, 0];
  p.innerHTML = `<div class="test-setup">
      <h2 class="panel-title">${t('testSetup')}</h2>
      <p class="intro">${t('testIntro')}</p>
      <div class="field"><span class="label">${t('difficulty')}</span>
        <div class="diff-options">${DIFFS.map(
          (d) => `<label class="diff-opt"><input type="radio" name="diff" value="${d.key}" ${cfg.difficulty === d.key ? 'checked' : ''}/>
            <div><div class="dname">${t(DIFF_LABEL[d.key])}</div><div class="ddesc">${t(DIFF_LABEL[d.key] + 'Desc')}</div></div><span class="dots">${d.dots}</span></label>`,
        ).join('')}</div>
      </div>
      <div class="field"><span class="label">${t('answerLang')}</span>
        <div class="chip-row" data-cfg="answerLang">${['cs', 'en', 'la']
          .map((l) => `<button class="chip ${cfg.answerLang === l ? 'active' : ''}" data-v="${l}">${t(LANG_LABEL[l])}</button>`)
          .join('')}</div>
      </div>
      <div class="field"><span class="label">${t('questions')}</span>
        <div class="chip-row" data-cfg="count">${counts
          .map((c) => `<button class="chip ${cfg.count === c ? 'active' : ''}" data-v="${c}">${c || t('all')}</button>`)
          .join('')}</div>
      </div>
      ${
        has.teeth || has.cartilage
          ? `<div class="field"><span class="label">${t('include')}</span>
        <div class="toggles">
          ${has.teeth ? `<label class="toggle"><input type="checkbox" data-cfgc="teeth" ${cfg.teeth ? 'checked' : ''}/><span>${t('showTeeth')}</span></label>` : ''}
          ${has.cartilage ? `<label class="toggle"><input type="checkbox" data-cfgc="cartilage" ${cfg.cartilage ? 'checked' : ''}/><span>${t('showCartilage')}</span></label>` : ''}
        </div>
      </div>`
        : ''
    }
      <p class="pool-info">${esc(region()[state.lang])}${region().sided ? ' (' + t(state.side === 'R' ? 'right' : 'left').toLowerCase() + ')' : ''}: ${t('count')(poolSize)}</p>
      <button class="btn primary block" id="startQuiz" ${poolSize ? '' : 'disabled'}>${t('start')} →</button>
      ${poolSize ? '' : `<p class="pool-info" style="margin-top:8px">${t('noBones')}</p>`}
    </div>`;
  const save = () => {
    store.set('quizCfg', state.quizCfg);
    renderTestPanel();
  };
  p.querySelectorAll('input[name=diff]').forEach((r) => (r.onchange = () => ((state.quizCfg.difficulty = r.value), save())));
  p.querySelectorAll('[data-cfg]').forEach((row) =>
    row.addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      const k = row.dataset.cfg;
      state.quizCfg[k] = k === 'count' ? Number(b.dataset.v) : b.dataset.v;
      save();
    }),
  );
  p.querySelectorAll('[data-cfgc]').forEach((c) => (c.onchange = () => ((state.quizCfg[c.dataset.cfgc] = c.checked), save())));
  $('#startQuiz').onclick = () => startQuiz();
}

function startQuiz(onlyIds) {
  const cfg = { ...state.quizCfg };
  let pool = onlyIds ? onlyIds.map((id) => BY_ID[id]) : quizPool(cfg);
  pool = shuffle(pool);
  if (!onlyIds && cfg.count) pool = pool.slice(0, cfg.count);
  if (!pool.length) return;
  const visibleIds = entriesFor(state.region, state.side, { cartilage: true, teeth: true })
    .filter((e) => (cfg.teeth || e.kind !== 'tooth'))
    .map((e) => e.id);
  // cíl musí být vždy vidět
  for (const e of pool) if (!visibleIds.includes(e.id)) visibleIds.push(e.id);
  state.quiz = { cfg, questions: pool, index: 0, answers: [], visibleIds, current: null, xray: false, answered: false };
  selectBone(null);
  applyVisibility({ frame: false });
  renderTestPanel();
  nextQuestion();
}

function nextQuestion() {
  const q = state.quiz;
  if (q.index >= q.questions.length) return showResults();
  q.current = q.questions[q.index];
  q.answered = false;
  q.mask = maskName(q.current.base[q.cfg.answerLang]);
  renderQuizCard();
  updateInset();
  showQuestionView();
  // na mobilu (sloupcové rozložení) posunout zpět na scénu
  const layout = $('.layout');
  if (layout.scrollTop > 0) layout.scrollTo({ top: 0, behavior: 'smooth' });
  renderTestPanel();
}

const FOCUS_REGIONS = new Set(['skeleton', 'spine', 'upperLimb', 'lowerLimb']);
const ZOOM_SMALL = new Set(['skull', 'thorax', 'pelvis']);
function showQuestionView(animate = true) {
  const q = state.quiz;
  const id = q.current.id;
  const { dir, score } = viewer.bestViewDir(id, candidateDirs());
  q.xray = score < 0.55;
  viewer.setTarget(id, { dim: q.xray });
  $('#xrayBtn').classList.toggle('active', q.xray);
  const regionBox = viewer.boxOf(q.visibleIds);
  const regionR = regionBox.getBoundingSphere(new THREE.Sphere()).radius;
  const tBox = viewer.boxOf([id]);
  const tR = tBox.getBoundingSphere(new THREE.Sphere()).radius;
  if (FOCUS_REGIONS.has(state.region) && tR < regionR * 0.35) {
    viewer.frameBox(tBox, dir, { animate, minRadius: Math.min(regionR, Math.max(tR * 3.2, 0.06)) });
  } else if (ZOOM_SMALL.has(state.region) && tR < regionR * 0.15) {
    // malá kost ve velké oblasti (zub v lebce) – přiblížit, ale nechat okolí
    viewer.frameBox(tBox, dir, { animate, minRadius: Math.max(tR * 4, regionR * 0.5) });
  } else {
    viewer.frameBox(regionBox, dir, { animate });
  }
}

function questionText(e) {
  if (e.kind === 'tooth') return t('whatIsThisTooth');
  if (e.kind === 'bone') return t('whatIsThis');
  return t('whatIsThisOther');
}

function renderQuizCard() {
  const q = state.quiz;
  const e = q.current;
  const L = q.cfg.answerLang;
  const name = e.base[L];
  const card = $('#quizCard');
  const tags = [];
  if (e.side) tags.push(`<span class="tag target">${esc(sideLabel(e, state.lang))}</span>`);
  if (q.cfg.difficulty !== 'hard') tags.push(`<span class="tag">${esc(GROUPS[e.group][state.lang])}</span>`);
  tags.push(`<span class="tag">${q.index + 1} / ${q.questions.length}</span>`);

  let hint = '';
  if (q.cfg.difficulty === 'easy') hint = `<div class="hint-full ${L === 'la' ? 'la' : ''}">${esc(name)}</div>`;
  else if (q.cfg.difficulty === 'medium') hint = `<div class="slots" id="slots"></div>`;

  card.innerHTML = `<div class="quiz-top"><div class="quiz-q">${questionText(e)} <span style="color:var(--text-3);font-weight:500">(${t(LANG_LABEL[L]).toLowerCase()})</span></div><div class="quiz-tags">${tags.join('')}</div></div>
    <div class="quiz-hint">${hint}</div>
    <form class="quiz-input-row" id="quizForm" autocomplete="off">
      <input class="quiz-input" id="quizInput" placeholder="${t('typeHere')}" autocapitalize="off" autocorrect="off" spellcheck="false" lang="${L === 'la' ? 'la' : L}" />
      <button class="btn primary" type="submit" id="quizSubmit">${t('check')}</button>
    </form>
    <div id="quizFeedback"></div>
    <div class="quiz-foot"><span>${isTouch ? '' : t('pressEnter')}</span><button class="btn ghost" id="quizSkip" type="button">${t('dontKnow')}</button></div>`;
  card.hidden = false;
  const input = $('#quizInput');
  if (q.cfg.difficulty === 'medium') {
    renderSlots('');
    input.addEventListener('input', () => renderSlots(input.value));
  }
  $('#quizForm').addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (q.answered) return advance();
    if (!input.value.trim()) return input.focus();
    answer(input.value);
  });
  $('#quizSkip').addEventListener('click', () => (q.answered ? advance() : answer('')));
  if (!isTouch) setTimeout(() => input.focus({ preventScroll: true }), 50);
}

function renderSlots(typed) {
  const q = state.quiz;
  const typedChars = [...typed];
  const words = [];
  let cur = [];
  q.mask.forEach((m, i) => {
    if (m.char === ' ') {
      words.push(cur);
      cur = [];
      return;
    }
    let cls = 's';
    let ch = '';
    if (!m.letter) {
      cls += ' punct';
      ch = m.char;
    } else if (m.shown) {
      cls += ' shown';
      ch = m.char;
    } else if (typedChars[i] && typedChars[i] !== ' ') {
      const ok = stripDiacritics(typedChars[i].toLowerCase()) === stripDiacritics(m.char.toLowerCase());
      cls += ' typed' + (ok ? ' match' : '');
      ch = typedChars[i];
    }
    cur.push(`<span class="${cls}">${esc(ch)}</span>`);
  });
  words.push(cur);
  $('#slots').innerHTML = words.map((w) => `<span class="word">${w.join('')}</span>`).join('');
}

function answer(input) {
  const q = state.quiz;
  const e = q.current;
  const L = q.cfg.answerLang;
  const res = input ? checkAnswer(e, L, input, q.cfg.difficulty) : { result: 'wrong', expected: e.base[L] };
  q.answers.push({ id: e.id, input, result: res.result, skipped: !input });
  q.answered = true;
  const inp = $('#quizInput');
  inp.readOnly = true;
  inp.classList.add(res.result === 'correct' ? 'ok' : res.result === 'almost' ? 'almost' : 'bad');
  const cls = res.result === 'correct' ? 'ok' : res.result === 'almost' ? 'almost' : 'bad';
  const title = !input ? t('skipped') : res.result === 'correct' ? t('correct') : res.result === 'almost' ? t('almost') : t('wrong');
  const showNames = res.result !== 'correct' || L !== 'la';
  $('#quizFeedback').innerHTML = `<div class="feedback ${cls}">
      <div class="fb-title">${title}</div>
      ${showNames ? `<div class="fb-names">${res.result !== 'correct' ? `${t('correctAnswer')}: <b>${esc(e.base[L])}</b><br/>` : ''}
        <span class="la">${esc(e.base.la)}</span> · ${esc(e.base[L === 'cs' ? 'en' : 'cs'])}</div>` : ''}
    </div>`;
  const last = q.index + 1 >= q.questions.length;
  $('#quizSubmit').textContent = last ? t('finish') : t('next') + ' →';
  $('#quizSkip').hidden = true;
  $('#quizSubmit').focus({ preventScroll: true });
  renderTestPanel();
}

function advance() {
  state.quiz.index++;
  nextQuestion();
}

function showResults() {
  const q = state.quiz;
  const n = q.answers.length;
  const ok = q.answers.filter((a) => a.result !== 'wrong').length;
  const pct = Math.round((ok / n) * 100);
  const wrong = q.answers.filter((a) => a.result !== 'correct');
  const L = q.cfg.answerLang;
  const dlg = $('#resultDlg');
  dlg.innerHTML = `<h2>${t('results')}</h2>
    <div class="result-head"><div class="ring" style="--p:${pct}"><span>${pct}%</span></div>
      <div><div style="font-size:18px;font-weight:600">${t('resultLine')(ok, n)}</div>
      <div style="color:var(--text-2);margin-top:4px">${t(DIFF_LABEL[q.cfg.difficulty])} · ${t(LANG_LABEL[L])} · ${esc(region()[state.lang])}</div></div></div>
    ${
      wrong.length
        ? `<div class="panel-title">${t('mistakes')}</div><div class="mistakes">${wrong
            .map((a) => {
              const e = BY_ID[a.id];
              return `<div class="mistake"><div class="exp">${esc(e.base[L])} ${a.result === 'almost' ? '<span style="color:var(--warn)">≈</span>' : ''}</div>
              <div><span class="la">${esc(e.base.la)}</span> · ${esc(e.base[L === 'cs' ? 'en' : 'cs'])}</div>
              ${a.input ? `<div class="yours">${t('yourAnswer')}: ${esc(a.input)}</div>` : `<div class="yours">${t('skipped')}</div>`}</div>`;
            })
            .join('')}</div>`
        : `<p style="font-size:16px">${t('noMistakes')}</p>`
    }
    <div class="actions">
      <button class="btn ghost" data-act="new">${t('newTest')}</button>
      ${wrong.filter((a) => a.result === 'wrong').length ? `<button class="btn" data-act="retry">${t('retryMistakes')}</button>` : ''}
      <button class="btn primary" data-act="again">${t('again')}</button>
    </div>`;
  const wrongIds = wrong.filter((a) => a.result === 'wrong').map((a) => a.id);
  const ids = q.questions.map((e) => e.id);
  dlg.onclick = (ev) => {
    const act = ev.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    dlg.close();
    endQuiz(false);
    if (act === 'again') startQuiz(ids);
    if (act === 'retry') startQuiz(wrongIds);
  };
  dlg.oncancel = () => endQuiz(false);
  dlg.showModal();
}

function endQuiz(rerender = true) {
  state.quiz = null;
  viewer.setTarget(null);
  $('#quizCard').hidden = true;
  updateInset();
  $('#xrayBtn').classList.remove('active');
  renderTestPanel();
  if (rerender !== null) applyVisibility();
}

// karta testu zakrývá spodek plátna -> posunout scénu nad ni
function updateInset() {
  const card = $('#quizCard');
  const overlay = !card.hidden && state.mode === 'test' && getComputedStyle(card).position === 'absolute';
  viewer.setInsetBottom(overlay ? card.offsetHeight + 30 : 0);
}
new ResizeObserver(() => updateInset()).observe($('#quizCard'));
addEventListener('resize', updateInset);

// ------------------------------------------------------------------ boot
applyTheme();
applyI18n();
renderRegions();
renderList();
setMode('explore');

const modelUrl = `${import.meta.env.BASE_URL}models/skeleton.glb`;
viewer
  .load(modelUrl, (p) => ($('#loadBar').style.width = `${Math.round(p * 100)}%`))
  .then(() => {
    applyVisibility({ animate: false });
    $('#loading').classList.add('done');
    window.__ready = true;
  })
  .catch((err) => {
    console.error(err);
    $('#loading').querySelector('p').textContent = t('loadError');
  });

// pro ladění
window.__app = { state, viewer, CATALOG };
