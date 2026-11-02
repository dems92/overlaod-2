// Création de compte (profil obligatoire), connexion, mise à jour du profil et déconnexion
const L = require('./_lib');
const A = require('./_acct');

const SEX = ['h', 'f', 'a'], GOAL = ['perte', 'masse', 'maintien'];
const name = v => String(v || '').replace(/s+/g, ' ').trim().slice(0, 40);
// profil saisi à l'inscription : tous les champs sont obligatoires
function cleanProfile(p) {
  p = p || {};
  const o = { first: name(p.first), last: name(p.last), sex: String(p.sex || ''), goal: String(p.goal || '') };
  if (!o.first || !o.last) return { error: 'Prénom et nom obligatoires' };
  if (!SEX.includes(o.sex)) return { error: 'Indique ton sexe' };
  if (!GOAL.includes(o.goal)) return { error: 'Choisis ton objectif' };
  return { profile: o };
}
const addAid = (user, aid) => {
  aid = String(aid || '');
  if (!/^[a-z0-9]{6,40}$/.test(aid)) return;
  user.aids = [aid, ...(user.aids || []).filter(x => x !== aid)].slice(0, 10);
};

// /api/ev (statistiques d'usage) passe par cette fonction : le plan gratuit de Vercel limite à 12 fonctions
const ev = require('./_ev');
module.exports = (req, res) => (req.query && req.query.ev ? ev : acct)(req, res);
const acct = A.route(['POST'], async (req, res) => {
  const b = req.body || {};
  const redis = L.getRedis();
  if (b.action === 'logout') { await A.dropToken(req); return res.json({ ok: true }); }
  // compléter ou modifier son profil (compte déjà connecté)
  if (b.action === 'profile') {
    const uid = await A.tokenUser(req);
    if (!uid) return res.status(401).json({ error: 'Session expirée : reconnecte-toi' });
    const key = 'ov:user:' + uid, user = await redis.get(key);
    if (!user) return res.status(401).json({ error: 'Session expirée : reconnecte-toi' });
    const c = cleanProfile(b.profile);
    if (c.error) return res.status(400).json({ error: c.error });
    if (!b.consent && !user.consentAt) return res.status(400).json({ error: 'Accepte l’utilisation de tes données pour continuer' });
    user.profile = c.profile; user.consentAt = user.consentAt || Date.now(); addAid(user, b.aid);
    await redis.set(key, user);
    return res.json({ ok: true, email: user.email, profile: user.profile });
  }
  if (await A.limited(req)) return res.status(429).json({ error: 'Trop d’essais, réessaie dans 15 minutes' });
  const email = String(b.email || '').trim().toLowerCase(), pw = String(b.password || '');
  if (!A.validEmail(email)) return res.status(400).json({ error: 'Adresse e-mail invalide' });
  if (pw.length < 6 || pw.length > 200) return res.status(400).json({ error: 'Mot de passe : 6 caractères minimum' });
  const uid = A.userId(email), key = 'ov:user:' + uid;
  let user = await redis.get(key);
  if (b.action === 'register') {
    if (user) return res.status(409).json({ error: 'Un compte existe déjà avec cette adresse' });
    const c = cleanProfile(b.profile);
    if (c.error) return res.status(400).json({ error: c.error });
    if (!b.consent) return res.status(400).json({ error: 'Accepte l’utilisation de tes données pour continuer' });
    user = { email, ...A.hashPw(pw), createdAt: Date.now(), profile: c.profile, consentAt: Date.now() };
  } else if (b.action === 'login') {
    if (!user || !A.checkPw(pw, user)) return res.status(401).json({ error: 'E-mail ou mot de passe incorrect' });
    user.lastLogin = Date.now();
  } else return res.status(400).json({ error: 'action' });
  addAid(user, b.aid);
  await redis.set(key, user);
  const token = await A.newToken(uid);
  const bak = await redis.get('ov:bak:' + uid);
  res.json({ token, email, profile: user.profile || null, hasBackup: !!bak, updatedAt: bak ? bak.updatedAt : null });
});
