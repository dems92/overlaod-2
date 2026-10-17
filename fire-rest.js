// Appelée par QStash quand le repos est terminé : envoie la notification
const L = require('./_lib');

module.exports = L.route('POST', async (req, res, host) => {
  const meta = (await L.getRedis().get('overload:meta')) || {};
  if (meta.restPush === false) return res.json({ skipped: true });
  const out = await L.sendAll({ title: 'Repos terminé', body: 'C’est reparti : prochaine série.', tag: 'rest', url: '/' }, host);
  res.json(out);
});
