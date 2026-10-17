// Tous les jours : rappel si aucune séance depuis X jours (appelée par Vercel Cron)
const L = require('./_lib');

module.exports = L.route('GET', async (req, res, host) => {
  const redis = L.getRedis();
  const meta = (await redis.get('overload:meta')) || {};
  const d = Number(meta.inactiveDays) || 0;
  if (!d || !meta.lastSessionAt) return res.json({ sent: false, reason: 'désactivé ou aucune séance' });
  const now = Date.now(), DAY = 864e5;
  const days = Math.floor((now - Number(meta.lastSessionAt)) / DAY);
  const since = now - (Number(meta.lastRemindedAt) || 0);
  if (days < d || since < d * DAY - 2 * 36e5) return res.json({ sent: false, days });
  const out = await L.sendAll({ title: 'Overload', body: days + ' jours sans séance. On reprend ?', tag: 'inactive', url: '/' }, host);
  await redis.set('overload:meta', { ...meta, lastRemindedAt: now });
  res.json({ sent: true, days, ...out });
}, { cron: true });
