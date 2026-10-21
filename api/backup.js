// Sauvegarde en ligne du compte : GET pour la récupérer, PUT pour l'enregistrer
const L = require('./_lib');
const A = require('./_acct');

module.exports = A.route(['GET', 'PUT'], async (req, res) => {
  const uid = await A.tokenUser(req);
  if (!uid) return res.status(401).json({ error: 'Session expirée, reconnecte-toi' });
  const redis = L.getRedis(), key = 'ov:bak:' + uid;
  if (req.method === 'GET') return res.json((await redis.get(key)) || { data: null, updatedAt: null });
  const data = (req.body || {}).data;
  if (!data || typeof data !== 'object' || !Array.isArray(data.sessions)) return res.status(400).json({ error: 'Sauvegarde invalide' });
  const updatedAt = Date.now();
  await redis.set(key, { data, updatedAt });
  res.json({ ok: true, updatedAt });
});
