// Vidéos MuscleWiki via l'API officielle : recherche d'exercice + jeton de lecture temporaire (15 min)
// Clé à mettre dans Vercel : MUSCLEWIKI_KEY (offre Testing ou plus, https://api.musclewiki.com)
const L = require('./_lib');
const A = require('./_acct');
const BASE = 'https://api.musclewiki.com';

async function mw(path, opt = {}) {
  const r = await fetch(BASE + path, { ...opt, headers: { 'X-API-Key': process.env.MUSCLEWIKI_KEY, 'Content-Type': 'application/json' } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.detail || j.error || j.message || 'MuscleWiki ' + r.status); e.status = r.status; throw e; }
  return j;
}
const text = s => typeof s === 'string' ? s : (s && (s.text || s.step || s.description)) || '';

module.exports = A.route(['GET'], async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!process.env.MUSCLEWIKI_KEY) return res.status(501).json({ error: 'nokey' });
  const q = String((req.query || {}).q || '').trim().slice(0, 200);
  if (q.length < 2) return res.status(400).json({ error: 'Recherche trop courte' });
  // les infos d'exercice peuvent être gardées 30 jours (conditions MuscleWiki), jamais les vidéos
  const ck = 'ov:mw:' + q.toLowerCase();
  let list = null;
  try { list = await L.getRedis().get(ck); } catch (e) {}
  if (!list) {
    try {
      const r = await mw('/search?q=' + encodeURIComponent(q) + '&limit=6');
      const arr = Array.isArray(r) ? r : (r.results || r.exercises || []);
      list = arr.map(x => ({
        id: x.id, name: x.name, difficulty: x.difficulty || null,
        steps: Array.isArray(x.steps) ? x.steps.map(text).filter(Boolean) : [],
        videos: (x.videos || []).filter(v => v && v.url).map(v => ({ url: v.url, angle: v.angle, gender: v.gender }))
      }));
    } catch (e) {
      return res.status(e.status === 429 ? 429 : 502).json({ error: e.status === 429 ? 'Quota MuscleWiki du mois atteint' : e.status === 401 || e.status === 403 ? 'Clé MuscleWiki refusée' : String(e.message) });
    }
    try { await L.getRedis().set(ck, list, { ex: 30 * 86400 }); } catch (e) {}
  }
  let token = null;
  if (list.some(x => x.videos.length)) {
    try { const t = await mw('/media/token', { method: 'POST', body: '{}' }); token = t.token || t.access_token || null; } catch (e) {}
  }
  res.json({ results: list, token, base: BASE });
});
