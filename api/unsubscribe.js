// Retire l'appareil
const crypto = require('crypto');
const L = require('./_lib');

module.exports = L.route('POST', async (req, res) => {
  const endpoint = (req.body || {}).endpoint;
  if (endpoint) await L.getRedis().hdel('overload:subs', crypto.createHash('sha1').update(endpoint).digest('hex'));
  res.json({ ok: true });
});
