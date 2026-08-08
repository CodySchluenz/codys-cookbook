// Validates every recipe in site/recipes against the schema (canonical copy:
// .claude/skills/add-recipe/SKILL.md) and checks site/index.json stays in sync.
// Usage: node scripts/validate.mjs   → exit 0 valid, exit 1 with per-file problems.
import { readdir, readFile } from 'node:fs/promises';

const DIFFICULTIES = new Set(['easy', 'medium', 'project']);
const problems = [];
const fail = (file, msg) => problems.push(`${file}: ${msg}`);
const isStr = (v) => typeof v === 'string' && v.length > 0;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function checkRecipe(file, r) {
  if (!isStr(r.id)) fail(file, 'missing/invalid id');
  else {
    if (`${r.id}.json` !== file) fail(file, `id "${r.id}" does not match filename`);
    if (!/^[a-z0-9-]+$/.test(r.id)) fail(file, 'id must be kebab-case');
  }
  for (const k of ['title', 'description']) if (!isStr(r[k])) fail(file, `missing/invalid ${k}`);
  if (!Array.isArray(r.tags) || r.tags.length === 0 || !r.tags.every(isStr)) fail(file, 'tags must be a non-empty string array');
  for (const k of ['servings', 'activeMinutes', 'totalMinutes']) if (!isNum(r[k]) || r[k] <= 0) fail(file, `missing/invalid ${k}`);
  if (!DIFFICULTIES.has(r.difficulty)) fail(file, 'difficulty must be easy|medium|project');
  if (r.photo !== null && r.photo !== undefined && !isStr(r.photo)) fail(file, 'photo must be a path string or null');
  if (!Array.isArray(r.ingredientGroups) || r.ingredientGroups.length === 0) fail(file, 'ingredientGroups required');
  else for (const [gi, g] of r.ingredientGroups.entries()) {
    if (g.name !== null && !isStr(g.name)) fail(file, `group ${gi}: name must be a string or null`);
    if (!Array.isArray(g.items) || g.items.length === 0) { fail(file, `group ${gi}: items required`); continue; }
    for (const [ii, it] of g.items.entries()) {
      if (it.qty !== null && !isNum(it.qty)) fail(file, `item ${gi}:${ii}: qty must be a number or null`);
      if (it.unit !== null && it.unit !== undefined && !isStr(it.unit)) fail(file, `item ${gi}:${ii}: unit must be a string or null`);
      if (!isStr(it.item)) fail(file, `item ${gi}:${ii}: missing item name`);
    }
  }
  if (!Array.isArray(r.steps) || r.steps.length === 0) fail(file, 'steps required');
  else for (const [i, s] of r.steps.entries()) {
    if (!isStr(s.text)) fail(file, `step ${i}: missing text`);
    if (s.minutes !== undefined && (!isNum(s.minutes) || s.minutes <= 0)) fail(file, `step ${i}: minutes must be a positive number`);
    if (s.why !== undefined && !isStr(s.why)) fail(file, `step ${i}: why must be a string`);
  }
  if (r.notes !== undefined && (!Array.isArray(r.notes) || !r.notes.every((n) => isStr(n?.title) && isStr(n?.body))))
    fail(file, 'notes must be an array of {title, body}');
  if (r.plating !== undefined && r.plating !== null && !isStr(r.plating)) fail(file, 'plating must be a string');
  if (r.variations !== undefined && (!Array.isArray(r.variations) || !r.variations.every(isStr)))
    fail(file, 'variations must be a string array');
  if (r.elevations !== undefined && (!Array.isArray(r.elevations) || !r.elevations.every(isStr)))
    fail(file, 'elevations must be a string array');
  if (r.pairings !== undefined && (!Array.isArray(r.pairings) || !r.pairings.every(isStr)))
    fail(file, 'pairings must be a string array');
  if (r.pairsWith !== undefined && (!Array.isArray(r.pairsWith) || !r.pairsWith.every(isStr)))
    fail(file, 'pairsWith must be an array of recipe id strings');
}

const files = (await readdir('site/recipes')).filter((f) => f.endsWith('.json')).sort();
const recipes = new Map();
for (const file of files) {
  let r;
  try { r = JSON.parse(await readFile(`site/recipes/${file}`, 'utf8')); }
  catch (e) { fail(file, `not valid JSON: ${e.message}`); continue; }
  checkRecipe(file, r);
  recipes.set(r.id, r);
}

for (const [id, r] of recipes) {
  for (const pid of r.pairsWith ?? []) {
    if (pid === id) fail(`${id}.json`, 'pairsWith must not reference itself');
    else if (!recipes.has(pid)) fail(`${id}.json`, `pairsWith references unknown recipe "${pid}"`);
  }
}

try {
  const index = JSON.parse(await readFile('site/index.json', 'utf8'));
  const expected = files.map((f) => recipes.get(f.replace(/\.json$/, ''))).filter(Boolean).map((r) => ({
    id: r.id, title: r.title, description: r.description, tags: r.tags,
    totalMinutes: r.totalMinutes, difficulty: r.difficulty, photo: r.photo ?? null,
    ingredients: (r.ingredientGroups ?? []).flatMap((g) => (g.items ?? []).map((i) => i.item)),
  }));
  const norm = (x) => JSON.stringify([...x].sort((a, b) => String(a.id).localeCompare(String(b.id))));
  if (norm(index) !== norm(expected)) fail('index.json', 'out of sync with site/recipes — regenerate entries to match');
} catch (e) { fail('index.json', `unreadable: ${e.message}`); }

if (problems.length) {
  console.error(`✗ ${problems.length} problem(s):`);
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log(`✓ ${files.length} recipes valid, index.json in sync`);
