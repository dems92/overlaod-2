// Réglages des rappels + date de la dernière séance, propres à chaque appareil
const L = require('./_lib');

const cleanMeta = (b, meta = {}) => {
  if ('inactiveDays' in b) meta.inactiveDays = Math.max(0, Math.min(60, Number(b.inactiveDays) || 0));
  if ('restPush' in b) meta.restPush = !!b.restPush;
  if ('alertPush' in b) meta.alertPush = !!b.alertPush;
  if (b.lastSessionAt) meta.lastSessionAt = Number(b.lastSessionAt);
  return meta;
};

module.exports = L.route('POST', async (req, res, host, dev) => {
  const meta = cleanMeta(req.body || {}, dev.meta);
  await L.getRedis().hset('overload:dmeta', { [dev.id]: meta });
  res.json({ ok: true, meta });
}, { device: true });
