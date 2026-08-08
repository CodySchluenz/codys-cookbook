// Cody's Cookbook — hash router + rendering. No framework, no build.
// Screens: home (#/) and recipe (#/recipe/<id> — full version in Task 4).
import { scaleQty, formatQty, shoppingList } from './scale.js';

const state = {
  index: null,          // parsed index.json, cached for the session
  search: '',
  activeTags: new Set(),
  factor: 1,            // serving scale factor for the open recipe
  ingView: 'groups',   // 'groups' | 'shopping'
  timers: new Map(),    // stepIndex -> { end, minutes, tick } (Task 5)
  timerRecipeId: null,  // timers belong to one recipe at a time
  wakeLock: null,
};

const app = document.getElementById('app');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

window.addEventListener('hashchange', route);
route();

async function route() {
  const hash = location.hash || '#/';
  const m = hash.match(/^#\/recipe\/([a-z0-9-]+)$/);
  if (m) await renderRecipe(m[1]);
  else await renderHome();
}

async function loadIndex() {
  if (state.index) return state.index;
  const res = await fetch('index.json');
  if (!res.ok) throw new Error(`index.json: HTTP ${res.status}`);
  state.index = await res.json();
  return state.index;
}

async function renderHome() {
  releaseWakeLock();
  document.title = "Cody's Cookbook";
  let entries;
  try { entries = await loadIndex(); }
  catch (err) { app.innerHTML = errorCard('Could not load the recipe index.', err); return; }
  const allTags = [...new Set(entries.flatMap((e) => e.tags))].sort();
  app.innerHTML = `
    <header>
      <h1>Cody's Cookbook</h1>
      <input id="search" class="search" type="search" placeholder="Search recipes or ingredients…"
        value="${esc(state.search)}" autocomplete="off">
      <div class="chips">${allTags.map((t) =>
        `<button class="chip ${state.activeTags.has(t) ? 'on' : ''}" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}
      </div>
    </header>
    <main id="cards"></main>`;
  document.getElementById('search').addEventListener('input', (e) => {
    state.search = e.target.value;
    renderCards();
  });
  for (const chip of app.querySelectorAll('.chip')) {
    chip.addEventListener('click', () => {
      const t = chip.dataset.tag;
      if (state.activeTags.has(t)) state.activeTags.delete(t);
      else state.activeTags.add(t);
      chip.classList.toggle('on');
      renderCards();
    });
  }
  renderCards();
}

function renderCards() {
  const q = state.search.trim().toLowerCase();
  const hits = state.index.filter((e) => {
    if (![...state.activeTags].every((t) => e.tags.includes(t))) return false;
    if (!q) return true;
    return [e.title, e.description, ...e.tags, ...e.ingredients].join(' ').toLowerCase().includes(q);
  });
  document.getElementById('cards').innerHTML = hits.length
    ? hits.map(cardHtml).join('')
    : '<p class="empty">No recipes match.</p>';
}

function cardHtml(e) {
  return `
  <a class="card" href="#/recipe/${esc(e.id)}">
    ${e.photo ? `<img class="card-photo" src="${esc(e.photo)}" alt="">` : ''}
    <div class="card-body">
      <h2>${esc(e.title)}</h2>
      <p>${esc(e.description)}</p>
      <p class="card-meta">${e.totalMinutes} min · ${esc(e.difficulty)}</p>
    </div>
  </a>`;
}

function errorCard(message, err) {
  return `<div class="error-card">
    <h2>Something's off</h2>
    <p>${esc(message)}</p>
    <p class="card-meta">${esc(err?.message ?? '')}</p>
    <a class="btn" href="#/">Back to recipes</a>
  </div>`;
}

const cookKey = (id) => `cook:${id}`;

function readCook(id) {
  try {
    const d = JSON.parse(localStorage.getItem(cookKey(id))) ?? {};
    return {
      ing: Array.isArray(d.ing) ? d.ing : [],
      steps: Array.isArray(d.steps) ? d.steps : [],
      shop: Array.isArray(d.shop) ? d.shop : [],
    };
  } catch { return { ing: [], steps: [], shop: [] }; }
}

function writeCook(id, done) {
  localStorage.setItem(cookKey(id), JSON.stringify(done));
}

const notesKey = (id) => `notes:${id}`;
const readNotes = (id) => localStorage.getItem(notesKey(id)) ?? '';

function flashButton(id, msg) {
  const b = document.getElementById(id);
  if (!b) return;
  const old = b.textContent;
  b.textContent = msg;
  setTimeout(() => {
    const el = document.getElementById(id);
    if (el) el.textContent = old;
  }, 2000);
}

async function renderRecipe(id) {
  if (state.timerRecipeId !== id) stopAllTimers();
  state.timerRecipeId = id;
  state.factor = 1;
  state.ingView = 'groups';
  document.title = 'Loading…';
  let r;
  try {
    const res = await fetch(`recipes/${id}.json`);
    if (res.status === 404) {
      app.innerHTML = errorCard(`No recipe called "${id}".`, { message: 'Not found' });
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    r = await res.json();
  } catch (err) {
    app.innerHTML = errorCard(navigator.onLine === false
      ? "You're offline and this recipe isn't cached yet."
      : 'Could not load this recipe.', err);
    return;
  }
  try { await loadIndex(); } catch { /* pairs links degrade to nothing offline */ }
  try {
    drawRecipe(r);
    await acquireWakeLock();
  } catch (err) {
    app.innerHTML = errorCard("This recipe's data looks malformed.", err);
  }
}

const servingsLabel = (s, f) => `Serves ${formatQty(scaleQty(s, f))}`;

function pairsHtml(r) {
  const linked = (r.pairsWith ?? [])
    .map((id) => (state.index ?? []).find((e) => e.id === id))
    .filter(Boolean);
  const texts = r.pairings ?? [];
  if (!linked.length && !texts.length) return '';
  return `<section><h2>Pairs well with</h2>
    ${linked.map((e) => `<a class="pair-link" href="#/recipe/${esc(e.id)}">${esc(e.title)} →</a>`).join('')}
    ${texts.map((t) => `<div class="note"><p>${esc(t)}</p></div>`).join('')}
  </section>`;
}

function groupsHtml(r, done, f) {
  return r.ingredientGroups.map((g, gi) => `
    ${g.name ? `<h3 class="group-title">${esc(g.name)}</h3>` : ''}
    ${g.items.map((it, ii) => {
      const key = `${gi}:${ii}`;
      const qty = formatQty(scaleQty(it.qty, f));
      return `<button class="ing ${done.ing.includes(key) ? 'done' : ''}" data-key="${key}">
        <span class="ing-qty">${qty}${it.unit ? ' ' + esc(it.unit) : ''}</span>
        <span class="ing-name">${esc(it.item)}${it.note ? ` <em>· ${esc(it.note)}</em>` : ''}</span>
      </button>`;
    }).join('')}`).join('');
}

function shoppingHtml(r, done, f) {
  return shoppingList(r.ingredientGroups).map((row) => {
    const key = row.item.trim().toLowerCase();
    const qty = row.parts
      .map((p) => `${formatQty(scaleQty(p.qty, f))}${p.unit ? ' ' + esc(p.unit) : ''}`)
      .join(' + ');
    return `<button class="ing ${done.shop.includes(key) ? 'done' : ''}" data-shop="${esc(key)}">
      <span class="ing-qty">${qty}</span>
      <span class="ing-name">${esc(row.item)}${row.toTaste && !row.parts.length ? ' <em>· to taste</em>' : ''}</span>
    </button>`;
  }).join('');
}

function drawRecipe(r) {
  document.title = r.title;
  const done = readCook(r.id);
  const f = state.factor;
  const ings = state.ingView === 'shopping' ? shoppingHtml(r, done, f) : groupsHtml(r, done, f);
  const steps = r.steps.map((s, i) => `
    <li class="step ${done.steps.includes(i) ? 'done' : ''}" data-step="${i}">
      <button class="step-text">${esc(s.text)}</button>
      ${s.why ? `<p class="step-why">${esc(s.why)}</p>` : ''}
      ${s.minutes ? `<button class="step-timer" data-step="${i}" data-minutes="${s.minutes}">⏱ ${s.minutes} min</button>` : ''}
    </li>`).join('');
  app.innerHTML = `
    <nav class="top-bar">
      <a class="btn" href="#/">← Recipes</a>
      <button id="reset" class="btn subtle">Reset</button>
    </nav>
    <header>
      <h1>${esc(r.title)}</h1>
      <p>${esc(r.description)}</p>
      <p class="card-meta">${servingsLabel(r.servings, f)} · ${r.activeMinutes} min active · ${r.totalMinutes} min total · ${esc(r.difficulty)}${r.tags?.length ? ' · ' + r.tags.map((t) => esc(t)).join(', ') : ''}</p>
      <div class="scaler" id="scaler">
        ${[0.5, 1, 2].map((v) => `<button data-f="${v}" class="${f === v ? 'on' : ''}">${v === 0.5 ? '½×' : v + '×'}</button>`).join('')}
        <button data-f="minus">−</button>
        <button data-f="plus">+</button>
      </div>
    </header>
    ${(r.equipment ?? []).length ? `<section><h2>You'll need</h2><p class="equipment">${r.equipment.map((e) => esc(e)).join(' · ')}</p></section>` : ''}
    <section>
      <h2>Ingredients</h2>
      <div class="ing-toggle" id="ing-toggle">
        <button data-view="groups" class="${state.ingView === 'groups' ? 'on' : ''}">By component</button>
        <button data-view="shopping" class="${state.ingView === 'shopping' ? 'on' : ''}">Shopping list</button>
      </div>
      ${ings}
    </section>
    <section><h2>Steps</h2><ol class="steps">${steps}</ol></section>
    ${r.plating ? `<section class="plate-card"><h2>Plating</h2><p>${esc(r.plating)}</p></section>` : ''}
    ${(r.elevations ?? []).length ? `<section><h2>Elevate it</h2>${r.elevations.map((e) =>
      `<div class="note"><p>${esc(e)}</p></div>`).join('')}</section>` : ''}
    ${pairsHtml(r)}
    ${(r.notes ?? []).length ? `<section><h2>Notes</h2>${r.notes.map((n) =>
      `<details class="note"><summary>${esc(n.title)}</summary><p>${esc(n.body)}</p></details>`).join('')}</section>` : ''}
    ${(r.variations ?? []).length ? `<section><h2>Variations</h2>${r.variations.map((v) =>
      `<div class="note"><p>${esc(v)}</p></div>`).join('')}</section>` : ''}
    <section>
      <h2>My notes</h2>
      <textarea id="cook-notes" class="cook-notes" rows="4"
        placeholder="Jot anything — amounts to tweak, open questions, what you'd change…">${esc(readNotes(r.id))}</textarea>
      <div class="notes-actions">
        <button id="notes-send" class="btn-solid">Send to chef</button>
        <button id="notes-clear" class="btn subtle">Clear</button>
      </div>
    </section>
    ${r.source ? `<p class="card-meta">Source: ${esc(r.source)}</p>` : ''}`;
  wireRecipe(r);
  syncTimerButtons();
}

function wireRecipe(r) {
  const done = readCook(r.id);
  for (const el of app.querySelectorAll('.ing')) {
    el.addEventListener('click', () => {
      const list = el.dataset.shop !== undefined ? done.shop : done.ing;
      const key = el.dataset.shop ?? el.dataset.key;
      const i = list.indexOf(key);
      if (i >= 0) list.splice(i, 1); else list.push(key);
      writeCook(r.id, done);
      el.classList.toggle('done');
    });
  }
  for (const el of app.querySelectorAll('.step-text')) {
    el.addEventListener('click', () => {
      const li = el.closest('.step');
      const idx = Number(li.dataset.step);
      const at = done.steps.indexOf(idx);
      if (at >= 0) done.steps.splice(at, 1); else done.steps.push(idx);
      writeCook(r.id, done);
      li.classList.toggle('done');
    });
  }
  document.getElementById('reset').addEventListener('click', () => {
    localStorage.removeItem(cookKey(r.id));
    stopAllTimers();
    drawRecipe(r);
  });
  document.getElementById('scaler').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const v = b.dataset.f;
    if (v === 'minus') state.factor = Math.max(0.5, state.factor - 0.5);
    else if (v === 'plus') state.factor = Math.min(4, state.factor + 0.5);
    else state.factor = Number(v);
    drawRecipe(r); // re-render from original quantities — rounding never compounds
  });
  document.getElementById('ing-toggle').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.dataset.view === state.ingView) return;
    state.ingView = b.dataset.view;
    drawRecipe(r);
  });
  for (const el of app.querySelectorAll('.step-timer')) {
    el.addEventListener('click', () => toggleTimer(Number(el.dataset.step), Number(el.dataset.minutes)));
  }
  const ta = document.getElementById('cook-notes');
  ta.addEventListener('input', () => {
    if (ta.value.trim()) localStorage.setItem(notesKey(r.id), ta.value);
    else localStorage.removeItem(notesKey(r.id));
  });
  document.getElementById('notes-send').addEventListener('click', async () => {
    const body = ta.value.trim();
    if (!body) { flashButton('notes-send', 'Nothing to send yet'); return; }
    const text = `Cook notes for ${r.id} ("${r.title}"):\n${body}`;
    try {
      await navigator.clipboard.writeText(text);
      flashButton('notes-send', 'Copied — paste it to the chef');
    } catch {
      ta.select();
      flashButton('notes-send', 'Copy blocked — text selected, copy manually');
    }
  });
  document.getElementById('notes-clear').addEventListener('click', () => {
    localStorage.removeItem(notesKey(r.id));
    ta.value = '';
  });
}

// --- Timers: wall-clock based; each tick re-queries the DOM so re-renders
// and navigation can't orphan a countdown. State is in-memory by design. ---

function toggleTimer(stepIdx, minutes) {
  const existing = state.timers.get(stepIdx);
  if (existing) {                    // tapping a running timer cancels it
    clearInterval(existing.tick);
    state.timers.delete(stepIdx);
    syncTimerButtons();
    return;
  }
  ensureAudio();                     // must be created inside a user gesture
  const end = Date.now() + minutes * 60_000;
  const tick = setInterval(() => {
    if (Date.now() >= end) {
      clearInterval(tick);
      state.timers.delete(stepIdx);
      timerDone(stepIdx);
    }
    syncTimerButtons();
  }, 250);
  state.timers.set(stepIdx, { end, minutes, tick });
  syncTimerButtons();
}

function stopAllTimers() {
  for (const { tick } of state.timers.values()) clearInterval(tick);
  state.timers.clear();
}

function syncTimerButtons() {
  for (const btn of app.querySelectorAll('.step-timer')) {
    const t = state.timers.get(Number(btn.dataset.step));
    if (t) {
      const left = Math.max(0, t.end - Date.now());
      const m = Math.floor(left / 60_000);
      const s = String(Math.floor((left % 60_000) / 1000)).padStart(2, '0');
      btn.textContent = `${m}:${s}`;
      btn.classList.add('running');
    } else {
      btn.textContent = `⏱ ${btn.dataset.minutes} min`;
      btn.classList.remove('running');
    }
  }
}

function timerDone(stepIdx) {
  beep();
  navigator.vibrate?.([200, 100, 200, 100, 400]);
  const step = app.querySelector(`.step[data-step="${stepIdx}"]`);
  step?.classList.add('flash');
  setTimeout(() => step?.classList.remove('flash'), 4000);
}

let audioCtx = null;
function ensureAudio() {
  audioCtx ??= new (window.AudioContext ?? window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function beep() {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  for (let i = 0; i < 3; i++) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain).connect(audioCtx.destination);
    osc.frequency.value = 880;
    const t0 = audioCtx.currentTime + i * 0.45;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.4, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
    osc.start(t0);
    osc.stop(t0 + 0.4);
  }
}

// --- Wake lock: screen stays on while a recipe is open. Silently absent
// where unsupported; re-acquired when the app returns to the foreground. ---

async function acquireWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try { state.wakeLock = await navigator.wakeLock.request('screen'); }
  catch { /* denied or low battery — the app works without it */ }
}

function releaseWakeLock() {
  state.wakeLock?.release().catch(() => {});
  state.wakeLock = null;
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && location.hash.startsWith('#/recipe/')) {
    acquireWakeLock();
  }
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
