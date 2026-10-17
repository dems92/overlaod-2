// Programme la notification « repos terminé » (envoi différé via QStash)
const L = require('./_lib');

module.exports = L.route('POST', async (req, res, host) => {
  if (!process.env.QSTASH_TOKEN) return res.status(500).json({ error: 'QSTASH_TOKEN manquant' });
  const meta = (await L.getRedis().get('overload:meta')) || {};
  if (meta.restPush === false) return res.json({ id: null });
  const sec = Math.min(3600, Math.max(1, Math.round(Number((req.body || {}).seconds) || 0)));
  const base = process.env.QSTASH_URL || 'https://qstash.upstash.io';
  const r = await fetch(base + '/v2/publish/https://' + host + '/api/fire-rest', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + process.env.QSTASH_TOKEN,
      'Upstash-Delay': sec + 's',
      'Upstash-Forward-x-overload-key': process.env.OVERLOAD_KEY,
      'Content-Type': 'application/json'
    },
    body: '{}'
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return res.status(502).json({ error: 'QStash : ' + (j.error || j.message || r.status) });
  res.json({ id: j.messageId || null });
});
