// Enregistre l'appareil pour recevoir les notifications (sans clé : l'abonnement sert d'identifiant)
const L = require('./_lib');

const cleanMeta = (b, meta = {}) => {
  if ('inactiveDays' in b) meta.inactiveDays = Math.max(0, Math.min(60, Number(b.inactiveDays) || 0));
  if ('restPush' in b) meta.restPush = !!b.restPush;
  if ('alertPush' in b) meta.alertPush = !!b.alertPush;
  if (b.lastSessionAt) meta.lastSessionAt = Number(b.lastSessionAt);
  return meta;
};

module.exports = L.route('POST', async (req, res) => {
  const b = req.body || {}, sub = b.subscription;
  if (!sub || typeof sub.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint) || !sub.keys) return res.status(400).json({ error: 'abonnement invalide' });
  if (await L.limited(req, 'sub', 30)) return res.status(429).json({ error: 'Trop d’essais, réessaie dans un moment' });
  const id = L.devId(sub.endpoint), redis = L.getRedis();
  await redis.hset('overload:subs', { [id]: { endpoint: sub.endpoint, keys: sub.keys } });
  const meta = cleanMeta(b.meta || {}, (await redis.hget('overload:dmeta', id)) || {});
  await redis.hset('overload:dmeta', { [id]: meta });
  res.json({ ok: true });
}, { public: true });
