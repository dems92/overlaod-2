// Statistiques d'usage anonymes (identifiant aléatoire d'appareil, aucun e-mail) lues par le tableau de bord KPI
const L = require('./_lib');

const K = 'overload:kpi:';
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const EVTS = ['ai_import', 'ai_save', 'account_new', 'account_login'];
const str = (s, n) => String(s == null ? '' : s).slice(0, n);
const int = (n, a, b) => { n = Math.round(Number(n)); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : a; };

module.exports = L.route('POST', async (req, res) => {
  const b = req.body || {};
  const aid = str(b.aid, 40);
  if (!/^[a-z0-9]{8,40}$/.test(aid) || !DAY.test(b.day || '')) return res.status(400).json({ error: 'ev' });
  if (await L.limited(req, 'ev', 200)) return res.status(429).json({ error: 'trop d’envois' });
  const redis = L.getRedis(), now = Date.now(), h = int(b.h, 0, 23), wd = int(b.wd, 0, 6);
  const dev = (await redis.hget(K + 'dev', aid)) || { first: now, opens: 0, days: [] };
  dev.last = now;
  if (!dev.days.includes(b.day)) dev.days = [...dev.days, b.day].sort().slice(-400);

  if (b.type === 'open') {
    dev.opens = (dev.opens || 0) + 1;
    dev.plat = ['ios', 'android', 'desktop'].includes(b.plat) ? b.plat : 'desktop';
    dev.pwa = b.pwa ? 1 : 0; dev.push = b.push ? 1 : 0; dev.acct = b.acct ? 1 : 0;
    dev.hist = int(b.n, 0, 99999); dev.tpl = int(b.tpl, 0, 9999);
    await redis.hincrby(K + 'oh', wd + '|' + h, 1);
  } else if (b.type === 'session') {
    const s = b.s || {}, id = str(s.id, 24);
    if (!id) return res.status(400).json({ error: 'ev' });
    const rec = {
      aid, day: b.day, h, wd, t: int(s.t, 0, 9e15), dur: int(s.dur, 0, 6 * 3600), hiit: s.hiit ? 1 : 0, tpl: s.tpl ? 1 : 0,
      gym: str(s.gym, 40), rt: int(s.rt, 0, 900),
      rests: (Array.isArray(s.rests) ? s.rests : []).slice(0, 120).map(r => int(r, 0, 900)),
      ex: (Array.isArray(s.ex) ? s.ex : []).slice(0, 40).filter(Array.isArray)
        .map(e => [str(e[0], 60), str(e[1], 30), int(e[2], 0, 50), int(e[3], 0, 5000), int(e[4], 0, 1e6), Math.round(Math.min(1000, Math.max(0, Number(e[5]) || 0)) * 2) / 2])
    };
    await redis.hset(K + 'ses', { [id]: rec });
  } else if (b.type === 'evt') {
    if (!EVTS.includes(b.name)) return res.status(400).json({ error: 'ev' });
    await redis.hincrby(K + 'evt', b.day + '|' + b.name, int(b.n, 1, 50));
  } else return res.status(400).json({ error: 'ev' });

  await redis.hset(K + 'dev', { [aid]: dev });
  res.json({ ok: true });
}, { public: true });
