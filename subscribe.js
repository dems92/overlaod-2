// Enregistre l'appareil pour recevoir les notifications
const crypto = require('crypto');
const L = require('./_lib');

module.exports = L.route('POST', async (req, res) => {
  const sub = (req.body || {}).subscription;
  if (!sub || !sub.endpoint || !sub.keys) return res.status(400).json({ error: 'abonnement invalide' });
  const id = crypto.createHash('sha1').update(sub.endpoint).digest('hex');
  await L.getRedis().hset('overload:subs', { [id]: sub });
  res.json({ ok: true });
});
