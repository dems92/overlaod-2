// Appelée par QStash à l'heure prévue : envoie la notification (fin de repos ou alerte) à l'appareil concerné
const L = require('./_lib');

module.exports = L.route('POST', async (req, res, host) => {
  const b = req.body || {}, redis = L.getRedis();
  const sub = b.dev && (await redis.hget('overload:subs', String(b.dev)));
  if (!sub) return res.json({ skipped: true });
  const meta = (await redis.hget('overload:dmeta', String(b.dev))) || {};
  const only = { [b.dev]: sub };
  if (b.kind === 'alert') {
    if (meta.alertPush === false) return res.json({ skipped: true });
    return res.json(await L.sendAll({ title: b.title || '2:30 de repos', body: b.body || 'C’est le moment de reprendre la série.', tag: 'rest-alert', url: '/' }, host, only));
  }
  if (meta.restPush === false) return res.json({ skipped: true });
  res.json(await L.sendAll({ title: 'Repos terminé', body: 'C’est reparti : prochaine série.', tag: 'rest', url: '/' }, host, only));
});
