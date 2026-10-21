// Création de compte, connexion et déconnexion (adresse e-mail + mot de passe)
const L = require('./_lib');
const A = require('./_acct');

module.exports = A.route(['POST'], async (req, res) => {
  const b = req.body || {};
  const redis = L.getRedis();
  if (b.action === 'logout') { await A.dropToken(req); return res.json({ ok: true }); }
  if (await A.limited(req)) return res.status(429).json({ error: 'Trop d’essais, réessaie dans 15 minutes' });
  const email = String(b.email || '').trim().toLowerCase(), pw = String(b.password || '');
  if (!A.validEmail(email)) return res.status(400).json({ error: 'Adresse e-mail invalide' });
  if (pw.length < 6 || pw.length > 200) return res.status(400).json({ error: 'Mot de passe : 6 caractères minimum' });
  const uid = A.userId(email), key = 'ov:user:' + uid;
  const user = await redis.get(key);
  if (b.action === 'register') {
    if (user) return res.status(409).json({ error: 'Un compte existe déjà avec cette adresse' });
    await redis.set(key, { email, ...A.hashPw(pw), createdAt: Date.now() });
  } else if (b.action === 'login') {
    if (!user || !A.checkPw(pw, user)) return res.status(401).json({ error: 'E-mail ou mot de passe incorrect' });
  } else return res.status(400).json({ error: 'action' });
  const token = await A.newToken(uid);
  const bak = await redis.get('ov:bak:' + uid);
  res.json({ token, email, hasBackup: !!bak, updatedAt: bak ? bak.updatedAt : null });
});
