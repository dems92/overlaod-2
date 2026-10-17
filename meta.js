// Réglages des rappels + date de la dernière séance
const L = require('./_lib');

module.exports = L.route('POST', async (req, res) => {
  const b = req.body || {};
  const redis = L.getRedis();
  const meta = (await redis.get('overload:meta')) || {};
  if ('inactiveDays' in b) meta.inactiveDays = Math.max(0, Math.min(60, Number(b.inactiveDays) || 0));
  if ('restPush' in b) meta.restPush = !!b.restPush;
  if (b.lastSessionAt) meta.lastSessionAt = Number(b.lastSessionAt);
  await redis.set('overload:meta', meta);
  res.json({ ok: true, meta });
});
