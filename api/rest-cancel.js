// Annule une notification de repos programmée
const L = require('./_lib');

module.exports = L.route('POST', async (req, res) => {
  const id = (req.body || {}).id;
  if (id && process.env.QSTASH_TOKEN) {
    const base = process.env.QSTASH_URL || 'https://qstash.upstash.io';
    await fetch(base + '/v2/messages/' + encodeURIComponent(id), {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + process.env.QSTASH_TOKEN }
    }).catch(() => {});
  }
  res.json({ ok: true });
});
