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

// Replaced wholesale by Task 4.
async function renderRecipe(id) {
  app.innerHTML = `<nav class="top-bar"><a class="btn" href="#/">← Recipes</a></nav>
    <p class="empty">Recipe screen coming in Task 4 (${esc(id)}).</p>`;
}

// --- Cooking-session hooks: bodies land in Task 5; call sites exist from Task 4. ---
function stopAllTimers() {}
function toggleTimer(stepIdx, minutes) {}
function syncTimerButtons() {}
async function acquireWakeLock() {}
function releaseWakeLock() {}
