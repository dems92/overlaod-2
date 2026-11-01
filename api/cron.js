// Tous les jours : rappel à chaque appareil sans séance depuis X jours (appelée par Vercel Cron)
const L = require('./_lib');

module.exports = L.route('GET', async (req, res, host) => {
  const redis = L.getRedis();
  const subs = (await redis.hgetall('overload:subs')) || {}, metas = (await redis.hgetall('overload:dmeta')) || {};
  const now = Date.now(), DAY = 864e5;
  let sent = 0, checked = 0;
  for (const [id, sub] of Object.entries(subs)) {
    const meta = metas[id] || {};
    const d = Number(meta.inactiveDays) || 0;
    if (!d || !meta.lastSessionAt) continue;
    checked++;
    const days = Math.floor((now - Number(meta.lastSessionAt)) / DAY);
    if (days < d || now - (Number(meta.lastRemindedAt) || 0) < d * DAY - 2 * 36e5) continue;
    const out = await L.sendAll({ title: 'Overload', body: days + ' jours sans séance. On reprend ?', tag: 'inactive', url: '/' }, host, { [id]: sub });
    sent += out.sent;
    await redis.hset('overload:dmeta', { [id]: { ...meta, lastRemindedAt: now } });
  }
  res.json({ devices: Object.keys(subs).length, checked, sent });
}, { cron: true });
