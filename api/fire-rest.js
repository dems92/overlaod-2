// Appelée par QStash à l'heure prévue : envoie la notification (fin de repos ou alerte)
const L = require('./_lib');

module.exports = L.route('POST', async (req, res, host) => {
  const b = req.body || {};
  const meta = (await L.getRedis().get('overload:meta')) || {};
  if (b.kind === 'alert') {
    if (meta.alertPush === false) return res.json({ skipped: true });
    const out = await L.sendAll({ title: b.title || '2:30 de repos', body: b.body || 'C’est le moment de reprendre la série.', tag: 'rest-alert', url: '/' }, host);
    return res.json(out);
  }
  if (meta.restPush === false) return res.json({ skipped: true });
  const out = await L.sendAll({ title: 'Repos terminé', body: 'C’est reparti : prochaine série.', tag: 'rest', url: '/' }, host);
  res.json(out);
});
