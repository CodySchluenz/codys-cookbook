// Cody's Cookbook — hash router + rendering. No framework, no build.
// Screens: home (#/) and recipe (#/recipe/<id> — full version in Task 4).
import { scaleQty, formatQty } from './scale.js';

const state = {
  index: null,          // parsed index.json, cached for the session
  search: '',
  activeTags: new Set(),
  factor: 1,            // serving scale factor for the open recipe
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
  try { return JSON.parse(localStorage.getItem(cookKey(id))) ?? { ing: [], steps: [] }; }
  catch { return { ing: [], steps: [] }; }
}

function writeCook(id, done) {
  localStorage.setItem(cookKey(id), JSON.stringify(done));
}

async function renderRecipe(id) {
  if (state.timerRecipeId !== id) stopAllTimers();
  state.timerRecipeId = id;
  state.factor = 1;
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
  try {
    drawRecipe(r);
    await acquireWakeLock();
  } catch (err) {
    app.innerHTML = errorCard("This recipe's data looks malformed.", err);
  }
}

const servingsLabel = (s, f) => `Serves ${formatQty(scaleQty(s, f))}`;

function drawRecipe(r) {
  document.title = r.title;
  const done = readCook(r.id);
  const f = state.factor;
  const ings = r.ingredientGroups.map((g, gi) => `
    ${g.name ? `<h3 class="group-title">${esc(g.name)}</h3>` : ''}
    ${g.items.map((it, ii) => {
      const key = `${gi}:${ii}`;
      const qty = formatQty(scaleQty(it.qty, f));
      return `<button class="ing ${done.ing.includes(key) ? 'done' : ''}" data-key="${key}">
        <span class="ing-qty">${qty}${it.unit ? ' ' + esc(it.unit) : ''}</span>
        <span class="ing-name">${esc(it.item)}${it.note ? ` <em>· ${esc(it.note)}</em>` : ''}</span>
      </button>`;
    }).join('')}`).join('');
  const steps = r.steps.map((s, i) => `
    <li class="step ${done.steps.includes(i) ? 'done' : ''}" data-step="${i}">
      <button class="step-text">${esc(s.text)}</button>
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
      <p class="card-meta">${servingsLabel(r.servings, f)} · ${r.activeMinutes} min active · ${r.totalMinutes} min total · ${esc(r.difficulty)}</p>
      <div class="scaler" id="scaler">
        ${[0.5, 1, 2].map((v) => `<button data-f="${v}" class="${f === v ? 'on' : ''}">${v === 0.5 ? '½×' : v + '×'}</button>`).join('')}
        <button data-f="minus">−</button>
        <button data-f="plus">+</button>
      </div>
    </header>
    <section><h2>Ingredients</h2>${ings}</section>
    <section><h2>Steps</h2><ol class="steps">${steps}</ol></section>
    ${r.plating ? `<section class="plate-card"><h2>Plating</h2><p>${esc(r.plating)}</p></section>` : ''}
    ${(r.notes ?? []).length ? `<section><h2>Notes</h2>${r.notes.map((n) =>
      `<details class="note"><summary>${esc(n.title)}</summary><p>${esc(n.body)}</p></details>`).join('')}</section>` : ''}
    ${(r.variations ?? []).length ? `<section><h2>Variations</h2>${r.variations.map((v) =>
      `<div class="note"><p>${esc(v)}</p></div>`).join('')}</section>` : ''}
    ${r.source ? `<p class="card-meta">Source: ${esc(r.source)}</p>` : ''}`;
  wireRecipe(r);
  syncTimerButtons();
}

function wireRecipe(r) {
  const done = readCook(r.id);
  for (const el of app.querySelectorAll('.ing')) {
    el.addEventListener('click', () => {
      const key = el.dataset.key;
      const i = done.ing.indexOf(key);
      if (i >= 0) done.ing.splice(i, 1); else done.ing.push(key);
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
  for (const el of app.querySelectorAll('.step-timer')) {
    el.addEventListener('click', () => toggleTimer(Number(el.dataset.step), Number(el.dataset.minutes)));
  }
}

// --- Cooking-session hooks: bodies land in Task 5; call sites exist from Task 4. ---
function stopAllTimers() {}
function toggleTimer(stepIdx, minutes) {}
function syncTimerButtons() {}
async function acquireWakeLock() {}
function releaseWakeLock() {}
