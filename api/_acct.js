// Outils des comptes : mots de passe, jetons de connexion, limite d'essais
const crypto = require('crypto');
const L = require('./_lib');

const A = {};
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
A.userId = email => sha('overload:' + String(email).trim().toLowerCase());
A.validEmail = e => typeof e === 'string' && e.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

A.hashPw = (pw, salt = crypto.randomBytes(16).toString('hex')) =>
  ({ salt, hash: crypto.scryptSync(String(pw), salt, 64).toString('hex') });
A.checkPw = (pw, user) => {
  const h = Buffer.from(A.hashPw(pw, user.salt).hash, 'hex'), ref = Buffer.from(user.hash, 'hex');
  return h.length === ref.length && crypto.timingSafeEqual(h, ref);
};

const YEAR = 365 * 864e2;
A.newToken = async (uid) => {
  const t = crypto.randomBytes(32).toString('base64url');
  await L.getRedis().set('ov:tok:' + sha(t), uid, { ex: YEAR });
  return t;
};
A.tokenUser = async (req) => {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!m) return null;
  return (await L.getRedis().get('ov:tok:' + sha(m[1]))) || null;
};
A.dropToken = async (req) => {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (m) await L.getRedis().del('ov:tok:' + sha(m[1]));
};

// 20 essais par quart d'heure et par adresse IP
A.limited = async (req) => {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'local';
  const k = 'ov:rl:' + sha(ip), redis = L.getRedis();
  const n = await redis.incr(k);
  if (n === 1) await redis.expire(k, 900);
  return n > 20;
};

// Route publique (sans clé OVERLOAD_KEY), erreurs lisibles
A.route = (methods, handler) => async (req, res) => {
  try {
    if (!methods.includes(req.method)) return res.status(405).json({ error: 'method' });
    await handler(req, res);
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};

module.exports = A;
