// Household API. Static assets are served by the assets config before this
// worker runs, so only non-asset requests (/api/*) reach fetch().

const enc = new TextEncoder();

async function keyOk(req, env) {
  const given = req.headers.get('x-household-key') ?? '';
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(given)),
    crypto.subtle.digest('SHA-256', enc.encode(env.HOUSEHOLD_KEY)),
  ]);
  return crypto.subtle.timingSafeEqual(a, b);
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return json({ error: 'not found' }, 404);
    try {
      if (!env.HOUSEHOLD_KEY) return json({ error: 'household key not configured yet' }, 503);
      if (!(await keyOk(req, env))) return json({ error: 'bad household key' }, 401);

      if (url.pathname === '/api/list' && req.method === 'GET') {
        const listed = await env.HOUSEHOLD.list({ prefix: 'item:' });
        const items = await Promise.all(listed.keys.map(async (k) => {
          const v = await env.HOUSEHOLD.get(k.name, 'json');
          return v && { key: k.name, ...v };
        }));
        return json(items.filter(Boolean));
      }

      if (url.pathname === '/api/list' && req.method === 'POST') {
        const body = await req.json().catch(() => null);
        const item = (body?.item ?? '').toString().trim().slice(0, 120);
        const note = (body?.note ?? '').toString().trim().slice(0, 200);
        const addedBy = (body?.addedBy ?? '').toString().trim().slice(0, 40);
        if (!item) return json({ error: 'item required' }, 400);
        const key = `item:${Date.now()}:${crypto.randomUUID()}`;
        const entry = { item, note, addedBy, addedAt: new Date().toISOString() };
        await env.HOUSEHOLD.put(key, JSON.stringify(entry));
        return json({ key, ...entry }, 201);
      }

      if (url.pathname === '/api/list' && req.method === 'DELETE') {
        const body = await req.json().catch(() => null);
        const key = (body?.key ?? '').toString();
        if (!key.startsWith('item:')) return json({ error: 'bad key' }, 400);
        await env.HOUSEHOLD.delete(key);
        return json({ ok: true });
      }

      return json({ error: 'not found' }, 404);
    } catch (err) {
      return json({ error: 'server error', detail: String(err?.message ?? err) }, 500);
    }
  },
};
