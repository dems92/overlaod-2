// Retire l'appareil
const L = require('./_lib');

module.exports = L.route('POST', async (req, res, host, dev) => {
  const redis = L.getRedis();
  await redis.hdel('overload:subs', dev.id);
  await redis.hdel('overload:dmeta', dev.id);
  res.json({ ok: true });
}, { device: true });
