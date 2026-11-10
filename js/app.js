/* Тасбих — логика приложения. Всё хранится на телефоне (localStorage), регистрации нет. */

const $ = (s) => document.querySelector(s);
const KEY = 'tasbih.v1';
const ICON = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  sound: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z"/><path d="M15.5 9a4 4 0 010 6"/><path d="M18 6.5a7.5 7.5 0 010 11"/>',
  mute: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  reset: '<path d="M4 12a8 8 0 108-8 8.2 8.2 0 00-5.8 2.5L4 9"/><path d="M4 4v5h5"/>',
  goal: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8" fill="currentColor"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0112 0v5.5l1.5 2h-15l1.5-2z"/><path d="M10 20.5a2.2 2.2 0 004 0"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M5 7h14M10 7V4.5h4V7M7 7l1 12.5h8L17 7M10.5 11v5M13.5 11v5"/>',
  cal: '<rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4M12 13v4M10 15h4"/>'
};
const icon = (n) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- хранилище ---------- */
const store = Object.assign(
  { lang: 'ru', sound: true, days: {}, total: 0, sessions: 0, counts: {}, targets: {}, reminders: ['08:00', '20:00'], hintSeen: 0 },
  (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } })()
);
let saveTimer = 0;
function save(now) {
  clearTimeout(saveTimer);
  const write = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} };
  now ? write() : (saveTimer = setTimeout(write, 500));
}
window.addEventListener('pagehide', () => save(true));
document.addEventListener('visibilitychange', () => { if (document.hidden) save(true); });

const L = () => UI[store.lang];
const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function addCount(n) { const k = dayKey(); store.days[k] = (store.days[k] || 0) + n; store.total += n; save(); }
function lastDays(n) {
  const out = []; const d = new Date();
  for (let i = n - 1; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() - i); out.push({ date: x, n: store.days[dayKey(x)] || 0 }); }
  return out;
}
function streak() {
  let s = 0; const d = new Date();
  for (let i = 0; i < 3650; i++) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() - i);
    if (store.days[dayKey(x)] > 0) s++; else if (i > 0) break;
  }
  return s;
}
const fmt = (n) => n >= 10000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1).replace('.0', '') + 'k' : String(n);

/* ---------- навигация ---------- */
const CARD_BG = { prayer: 'mosque', zikr: 'forest', salawat: 'dusk', istighfar: 'falls', morning: 'dawn', evening: 'desert' };
const CARD_AR = { prayer: 'سُبْحَانَ اللَّهِ', zikr: 'ذِكْر', salawat: 'صَلَاة', istighfar: 'اِسْتِغْفَار', morning: 'الصَّبَاح', evening: 'الْمَسَاء' };

function go(hash) { location.hash = hash; }
function back() { if (history.length > 1 && sessionStorage.getItem('nav')) history.back(); else go('#home'); }
function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  if (id !== 'counter') { stopLoop(); releaseWake(); }
}
function route() {
  const h = location.hash.replace(/^#/, '') || 'home', p = h.split('/');
  document.documentElement.lang = store.lang === 'kz' ? 'kk' : 'ru';
  document.title = L().app;
  $('#sheet').hidden = true;
  if (p[0] === 'seq' && SEQ[p[1]]) return openSeq(p[1]);
  if (p[0] === 'one' && LISTS[p[1]] && Z[p[2]]) return openOne(p[1], p[2]);
  if (p[0] === 'list' && LISTS[p[1]]) return renderList(p[1]);
  if (p[0] === 'prayer') return renderPrayer();
  if (p[0] === 'remind') return renderRemind();
  renderHome();
}
window.addEventListener('hashchange', () => { sessionStorage.setItem('nav', '1'); route(); });

/* ---------- главная ---------- */
function renderHome() {
  const t = L(), today = store.days[dayKey()] || 0, week = lastDays(7), max = Math.max(1, ...week.map((d) => d.n));
  const weekSum = week.reduce((a, d) => a + d.n, 0);
  const first = [...store.reminders].sort()[0];
  const now = new Date(), hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const nudge = today === 0 && first && hm >= first;
  const card = (id, href, wide, sub) => `
    <button class="card${wide ? ' wide' : ''}" type="button" data-go="${href}" style="background-image:url(img/bg/${CARD_BG[id]}.webp)">
      <span class="card-ar" lang="ar" dir="rtl" aria-hidden="true">${CARD_AR[id]}</span>
      <h2>${t[id]}</h2>${sub ? `<p>${sub}</p>` : ''}
    </button>`;
  $('#home').innerHTML = `<div class="wrap">
    <header class="topbar">
      <div class="brand"><h1>${t.app}</h1><p>${t.tagline}</p></div>
      <div class="seg" role="group" aria-label="Язык / Тіл">
        <button type="button" data-lang="ru" aria-pressed="${store.lang === 'ru'}">РУС</button>
        <button type="button" data-lang="kz" aria-pressed="${store.lang === 'kz'}">ҚАЗ</button>
      </div>
    </header>
    ${nudge ? `<div class="nudge"><span>${t.notYet}</span><button class="btn" type="button" data-go="#prayer">${t.start}</button></div>` : ''}
    <section class="stat" aria-label="${t.stats}">
      <div class="stat-row">
        <div class="stat-cell main"><strong>${fmt(today)}</strong><span>${t.today}</span></div>
        <div class="stat-cell"><strong>${fmt(weekSum)}</strong><span>${t.week}</span></div>
        <div class="stat-cell"><strong>${streak()}</strong><span>${t.streak}</span></div>
        <div class="stat-cell"><strong>${fmt(store.total)}</strong><span>${t.total}</span></div>
      </div>
      <div class="bars" aria-hidden="true">
        ${week.map((d, i) => `<div class="bar${i === 6 ? ' today' : ''}"><i style="height:${Math.round((d.n / max) * 100)}%"></i><span>${t.days[d.date.getDay()]}</span></div>`).join('')}
      </div>
    </section>
    <nav class="grid">
      ${card('prayer', '#prayer', true, t.prayerSub)}
      ${card('zikr', '#list/zikr')}${card('salawat', '#list/salawat')}
      ${card('istighfar', '#list/istighfar')}${card('morning', '#seq/morning')}
      ${card('evening', '#seq/evening')}
    </nav>
    <button class="row-btn" type="button" data-go="#remind">${icon('bell')}<div><b>${t.reminders}</b><small>${store.reminders.join(' · ') || t.remindersSub}</small></div>${icon('next')}</button>
    <button class="row-btn" type="button" id="homeSound" aria-pressed="${store.sound}">${icon(store.sound ? 'sound' : 'mute')}<div><b>${t.sound}</b><small>${store.sound ? 'On' : 'Off'}</small></div></button>
    <p class="note">v3</p>  </div>`;
  show('home');
}

document.addEventListener('click', (e) => {
  const g = e.target.closest('[data-go]'); if (g) { Sound.unlock(); return go(g.dataset.go); }
  const l = e.target.closest('[data-lang]'); if (l) { store.lang = l.dataset.lang; save(true); return route(); }
  if (e.target.closest('#homeSound')) { store.sound = !store.sound; Sound.on = store.sound; save(true); Sound.unlock(); Sound.click(); return renderHome(); }
  if (e.target.closest('[data-back]')) return back();
});

function pageHead(title) {
  return `<header class="topbar"><button class="icon-btn" type="button" data-back aria-label="${L().back}">${icon('back')}</button><h1>${title}</h1></header>`;
}

/* ---------- выбор «После намаза» ---------- */
function renderPrayer() {
  const t = L();
  const opt = (seq, title, sub, bg) => `
    <button class="card wide" type="button" data-go="#seq/${seq}" style="background-image:url(img/bg/${bg}.webp)">
      <h2>${title}</h2><p>${sub}</p>
    </button>`;
  $('#list').innerHTML = `<div class="wrap">${pageHead(t.prayer)}
    <div class="grid">${opt('prayerShort', t.short, t.shortSub, 'sea')}${opt('prayerFull', t.full, t.fullSub, 'aurora')}</div></div>`;
  show('list'); $('#list').scrollTop = 0;
}

/* ---------- список зикров ---------- */
function renderList(cat) {
  const t = L(), lang = store.lang;
  $('#list').innerHTML = `<div class="wrap">${pageHead(t[cat])}<div class="zlist">
    ${LISTS[cat].map(([k, def]) => {
      const z = Z[k], goal = store.targets[k] ?? def, cur = store.counts[k] || 0;
      return `<button class="zitem" type="button" data-go="#one/${cat}/${k}">
        <p class="ar" lang="ar" dir="rtl">${z.ar}</p>
        <div class="zmeta"><b>${esc(z.t.kz)}</b><span>${cur ? cur + ' / ' : ''}${goal > 0 ? goal : '∞'}</span></div>
        <small>${esc(z.m[lang])}</small>
      </button>`;
    }).join('')}</div></div>`;
  show('list'); $('#list').scrollTop = 0;
}

/* ---------- счётчик ---------- */
const beads = new Beads($('#beads'));
const fx = new Fx($('#fx'));
const S = { kind: '', id: '', cat: '', steps: [], idx: 0, count: 0, target: 0, locked: false, groups: 1 };
let bgFlip = false, raf = 0, lastT = 0, wake = null;

function loop(ts) {
  const dt = Math.min(0.05, (ts - lastT) / 1000 || 0.016); lastT = ts;
  beads.step(dt); beads.draw(); fx.frame(dt);
  raf = requestAnimationFrame(loop);
}
function startLoop() { if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(loop); } }
function stopLoop() { cancelAnimationFrame(raf); raf = 0; }
async function keepAwake() { try { if (navigator.wakeLock && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch (e) {} }
function releaseWake() { try { wake && wake.release(); } catch (e) {} wake = null; }
document.addEventListener('visibilitychange', () => {
  if (!$('#counter').classList.contains('active')) return;
  if (document.hidden) stopLoop(); else { startLoop(); keepAwake(); }
});
window.addEventListener('resize', () => { if ($('#counter').classList.contains('active')) { beads.resize(); fx.resize(); fx.setScene(S.scene); fitText(); } });

function setBg(scene) {
  const a = $('#bgA'), b = $('#bgB'), on = bgFlip ? a : b, off = bgFlip ? b : a;
  on.style.backgroundImage = `url(img/bg/${scene}.webp)`;
  on.classList.add('on'); off.classList.remove('on'); bgFlip = !bgFlip;
  S.scene = scene; fx.setScene(scene);
}
function sizeClass(ar) { const n = ar.replace(/[ً-ْٰۖ-ۭ]/g, '').length; return n <= 22 ? 's1' : n <= 62 ? 's2' : n <= 130 ? 's3' : 's4'; }

function paintStep(animate) {
  const t = L(), lang = store.lang, st = S.steps[S.idx], z = Z[st.key], box = $('#cText');
  const fill = () => {
    $('#cAr').textContent = z.ar; $('#cTr').textContent = z.t.kz; $('#cMn').textContent = z.m[lang];
    box.className = 'c-text ' + sizeClass(z.ar); box.scrollTop = 0; fitText();
  };
  if (animate) { box.classList.add('out'); setTimeout(fill, 300); } else fill();
  if (S.scene !== st.scene || !animate) setBg(st.scene);
  S.target = st.n;
  beads.set(S.count, S.target, true);
  if (S.kind === 'seq') {
    const title = S.id.startsWith('prayer') ? t.prayer : t[S.id];
    $('#cLabel').textContent = `${title} · ${st.g} ${t.of} ${S.groups}`;
    $('#cDots').innerHTML = Array.from({ length: S.groups }, (_, i) => `<i class="${i + 1 < st.g ? 'done' : i + 1 === st.g ? 'cur' : ''}"></i>`).join('');
  } else { $('#cLabel').textContent = t[S.cat]; $('#cDots').innerHTML = ''; }
  $('#cRing').classList.remove('done');
  paintCount();
}
function paintCount() {
  const c = $('#cCount'), n = S.count, tg = S.target;
  c.textContent = n; c.className = n > 9999 ? 'huge' : n > 999 ? 'big' : '';
  $('#cTarget').textContent = tg > 0 ? `/ ${tg}` : '∞';
  const p = tg > 0 ? Math.min(1, n / tg) : (n % 33) / 33;
  $('#ringFg').style.strokeDashoffset = 289.03 * (1 - p);
  $('#ringDot').style.transform = `rotate(${p * 360}deg)`;
  $('#ringDot').style.opacity = p > 0 ? 1 : 0;
}
function paintChrome() {
  const t = L();
  $('#btnBack').innerHTML = icon('back'); $('#btnBack').setAttribute('aria-label', t.back);
  $('#btnReset').innerHTML = icon('reset'); $('#btnReset').setAttribute('aria-label', t.reset);
  $('#btnGoal').innerHTML = icon('goal'); $('#btnGoal').setAttribute('aria-label', t.goal);
  $('#btnGoal').hidden = S.kind !== 'one';
  $('#btnSound').innerHTML = icon(store.sound ? 'sound' : 'mute'); $('#btnSound').setAttribute('aria-label', t.sound); $('#btnSound').setAttribute('aria-pressed', store.sound);
  $('#tapZone').setAttribute('aria-label', '+1');
  $('#cHint').textContent = t.hint; $('#cHint').classList.toggle('hide', store.hintSeen >= 12);
  $('#doneTl').textContent = t.accepted;
}
function enterCounter() {
  $('#cDone').hidden = true; S.locked = false;
  show('counter'); beads.resize(); fx.resize();
  paintChrome(); paintStep(false); startLoop(); keepAwake();
}
function openSeq(id) {
  const steps = SEQ[id].map(([key, n, scene, g]) => ({ key, n, scene, g }));
  Object.assign(S, { kind: 'seq', id, cat: '', steps, idx: 0, count: 0, groups: steps[steps.length - 1].g, scene: '' });
  enterCounter();
}
function openOne(cat, key) {
  const def = LISTS[cat].find((x) => x[0] === key) || [key, 33, 'forest'];
  const n = store.targets[key] ?? def[1];
  let count = store.counts[key] || 0; if (n > 0 && count >= n) count = 0;
  Object.assign(S, { kind: 'one', id: key, cat, steps: [{ key, n, scene: def[2], g: 1 }], idx: 0, count, groups: 1, scene: '' });
  enterCounter();
}

function tap() {
  if (S.locked || !$('#cDone').hidden) return;
  Sound.unlock();
  S.count++; addCount(1);
  if (S.kind === 'one') store.counts[S.id] = S.count;
  beads.set(S.count, S.target); beads.tap();
  Sound.click(); haptic(10);
  const plus = $('#cPlus'); plus.classList.remove('go'); void plus.offsetWidth; plus.classList.add('go');
  const ring = $('#cRing'); ring.classList.add('bump'); setTimeout(() => ring.classList.remove('bump'), 120);
  paintCount();
  if (store.hintSeen < 12 && ++store.hintSeen >= 12) $('#cHint').classList.add('hide');
  if (S.target > 0 && S.count >= S.target) {
    S.locked = true; ring.classList.add('done'); haptic([30, 50, 30]);
    const last = S.idx >= S.steps.length - 1;
    last ? Sound.finish() : Sound.chime();
    setTimeout(last ? finish : nextStep, last ? 1100 : 850);
  } else if (S.target <= 0 && S.count % 33 === 0) { Sound.chime(); haptic([30, 50, 30]); }
}
function nextStep() {
  S.idx++; S.count = 0; paintStep(true);
  setTimeout(() => { $('#cText').classList.remove('out'); S.locked = false; }, 340);
}
function finish() {
  const t = L(), seq = S.kind === 'seq';
  if (seq && S.id.startsWith('prayer')) store.sessions++;
  if (!seq) store.counts[S.id] = 0;
  save(true);
  $('#doneTitle').textContent = seq && S.id.startsWith('prayer') ? t.doneTitle : t.doneZikr;
  $('#doneBtns').innerHTML = `<button class="btn" type="button" data-done="again">${t.again}</button>
    ${seq ? '' : `<button class="btn ghost" type="button" data-done="cont">${t.cont}</button>`}
    <button class="btn ghost" type="button" data-done="home">${t.home}</button>`;
  $('#cDone').hidden = false;
  $('#doneBtns button').focus({ preventScroll: true });
}
$('#doneBtns').addEventListener('click', (e) => {
  const a = e.target.closest('[data-done]'); if (!a) return;
  const act = a.dataset.done;
  if (act === 'home') return go('#home');
  $('#cDone').hidden = true; S.locked = false;
  if (act === 'again') { S.idx = 0; S.count = 0; if (S.kind === 'one') store.counts[S.id] = 0; paintStep(false); }
  if (act === 'cont') { S.count = S.target; S.steps[0].n = 0; store.targets[S.id] = 0; store.counts[S.id] = S.count; save(true); paintStep(false); }
});

$('#tapZone').addEventListener('pointerdown', (e) => { e.preventDefault(); tap(); });
$('#tapZone').addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) tap(); } });
$('#tapZone').addEventListener('contextmenu', (e) => e.preventDefault());
$('#btnBack').addEventListener('click', () => { save(true); back(); });
$('#btnSound').addEventListener('click', () => { store.sound = !store.sound; Sound.on = store.sound; save(true); Sound.unlock(); Sound.click(); paintChrome(); });
$('#btnReset').addEventListener('click', () => {
  if (S.kind === 'seq') { S.idx = 0; S.count = 0; S.locked = false; paintStep(false); }
  else { S.count = 0; store.counts[S.id] = 0; save(true); S.locked = false; beads.set(0, S.target); paintCount(); $('#cRing').classList.remove('done'); }
});

/* ---------- выбор цели ---------- */
let goalPick = 33;
function openGoal() {
  const t = L(); goalPick = S.target;
  $('#sheetTitle').textContent = t.goal; $('#goalCustomLabel').textContent = t.custom;
  $('#sheetCancel').textContent = t.cancel; $('#sheetSave').textContent = t.save;
  $('#goalCustom').value = [33, 99, 100, 1000, 0].includes(goalPick) ? '' : goalPick;
  paintChips(); $('#sheet').hidden = false;
}
function paintChips() {
  $('#goalChips').innerHTML = [33, 99, 100, 1000, 0].map((n) => `<button type="button" data-n="${n}" aria-pressed="${goalPick === n}">${n || '∞ ' + L().noLimit}</button>`).join('');
}
$('#btnGoal').addEventListener('click', openGoal);
$('#goalChips').addEventListener('click', (e) => { const b = e.target.closest('[data-n]'); if (b) { goalPick = +b.dataset.n; $('#goalCustom').value = ''; paintChips(); } });
$('#goalCustom').addEventListener('input', (e) => { const v = Math.floor(+e.target.value); if (v > 0) { goalPick = Math.min(100000, v); paintChips(); } });
$('#sheetCancel').addEventListener('click', () => { $('#sheet').hidden = true; });
$('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') $('#sheet').hidden = true; });
$('#sheetSave').addEventListener('click', () => {
  store.targets[S.id] = goalPick; S.steps[0].n = goalPick; S.target = goalPick;
  if (goalPick > 0 && S.count >= goalPick) { S.count = 0; store.counts[S.id] = 0; }
  save(true); $('#sheet').hidden = true; S.locked = false; paintStep(false);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (!$('#sheet').hidden) $('#sheet').hidden = true; } });

/* ---------- напоминания (через календарь телефона) ---------- */
function renderRemind() {
  const t = L();
  $('#remind').innerHTML = `<div class="wrap">${pageHead(t.reminders)}
    <div class="panel">
      <p>${t.remText}</p>
      <div class="times">${store.reminders.map((v, i) => `
        <div class="time-row"><input type="time" value="${v}" data-i="${i}" aria-label="${t.reminders} ${i + 1}">
        <button class="icon-btn" type="button" data-del="${i}" aria-label="${t.remDel}">${icon('trash')}</button></div>`).join('')}</div>
      <button class="btn ghost block" type="button" id="remAdd" ${store.reminders.length >= 5 ? 'disabled' : ''}>${icon('plus')}${t.remAdd}</button>
      <button class="btn block" type="button" id="remExport" ${store.reminders.length ? '' : 'disabled'}>${icon('cal')}${t.remExport}</button>
      <p style="margin-top:14px">${t.remHow}</p>
    </div></div>`;
  show('remind');
}
$('#remind').addEventListener('change', (e) => { const i = e.target.dataset.i; if (i != null && e.target.value) { store.reminders[i] = e.target.value; save(true); } });
$('#remind').addEventListener('click', (e) => {
  const d = e.target.closest('[data-del]');
  if (d) { store.reminders.splice(+d.dataset.del, 1); save(true); return renderRemind(); }
  if (e.target.closest('#remAdd')) { store.reminders.push('13:00'); save(true); return renderRemind(); }
  if (e.target.closest('#remExport')) exportCalendar();
});
function exportCalendar() {
  const t = L(), now = new Date(), p = (n) => String(n).padStart(2, '0');
  const ymd = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}`;
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const text = (s) => s.replace(/([,;\\])/g, '\\$1');
  const ev = [...new Set(store.reminders)].sort().map((hm) => [
    'BEGIN:VEVENT', `UID:tasbih-${hm.replace(':', '')}@tasbih.app`, `DTSTAMP:${stamp}`,
    `DTSTART:${ymd}T${hm.replace(':', '')}00`, 'DURATION:PT5M', 'RRULE:FREQ=DAILY',
    `SUMMARY:${text(t.remTitle)}`, `DESCRIPTION:${text(t.remBody)}`, 'TRANSP:TRANSPARENT',
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${text(t.remTitle)}`, 'TRIGGER:PT0S', 'END:VALARM', 'END:VEVENT'
  ].join('\r\n'));
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tasbih//PWA//RU', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', ...ev, 'END:VCALENDAR'].join('\r\n');
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = 'tasbih-reminders.ics';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ---------- запуск ---------- */
Sound.on = store.sound;
document.addEventListener('pointerdown', () => Sound.unlock(), { once: true });
route();
/* офлайн-кэш включается только на настоящем сайте (https), а не при разработке на localhost */
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

/* ---------- подгонка текста: уменьшаем шрифт, пока дуа не поместится целиком ---------- */
function fitText() {
  const box = $('#cText'), els = [$('#cAr'), $('#cTr'), $('#cMn')];
  els.forEach((el) => { el.style.fontSize = ''; el.style.lineHeight = ''; });
  const base = els.map((el) => parseFloat(getComputedStyle(el).fontSize));
  const min = [17, 12.5, 12];
  for (let k = 0.95; k >= 0.55 && box.scrollHeight > box.clientHeight + 1; k -= 0.05) {
    els.forEach((el, i) => { el.style.fontSize = Math.max(min[i], base[i] * k) + 'px'; });
    els[0].style.lineHeight = k < 0.8 ? '1.85' : '';
  }
}
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if ($('#counter').classList.contains('active')) fitText(); });

/* когда телефон скачал новую версию — один раз перезагружаем страницу, чтобы она сразу применилась */
if ('serviceWorker' in navigator) {
  let hadController = !!navigator.serviceWorker.controller, reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !reloaded) { reloaded = true; save(true); location.reload(); }
    hadController = true;
  });
}
