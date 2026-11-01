// Outils communs aux fonctions du serveur Overload
const crypto = require('crypto');
const { Redis } = require('@upstash/redis');

const L = {};

function safeEq(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Base de données (Upstash Redis, connectée via Vercel)
L.getRedis = () => {
  if (L._redis) return L._redis;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('Base de données non connectée (Storage > Upstash Redis dans Vercel)');
  L._redis = new Redis({ url, token });
  return L._redis;
};

// Envoi des notifications (Web Push)
L.getPush = (host) => {
  if (L._push) return L._push;
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) throw new Error('Clés VAPID manquantes dans les variables Vercel');
  const wp = require('web-push');
  wp.setVapidDetails(process.env.VAPID_SUBJECT || ('https://' + (host || 'overload.vercel.app')), pub, priv);
  L._push = wp;
  return wp;
};

// Accès réservé au serveur (QStash) : clé OVERLOAD_KEY, jamais envoyée au téléphone
L.authed = (req) => {
  const k = process.env.OVERLOAD_KEY;
  return !!k && safeEq(req.headers['x-overload-key'] || '', k);
};
// Appel automatique de Vercel Cron (CRON_SECRET)
L.bearer = (req) => {
  const s = process.env.CRON_SECRET;
  return !!s && safeEq(req.headers.authorization || '', 'Bearer ' + s);
};

// Identifiant d'un appareil : empreinte de son adresse d'abonnement (connue de lui seul)
L.devId = endpoint => crypto.createHash('sha1').update(String(endpoint)).digest('hex');
L.device = async (req) => {
  const ep = (req.body || {}).endpoint;
  if (!ep || typeof ep !== 'string') return null;
  const id = L.devId(ep), redis = L.getRedis();
  const sub = await redis.hget('overload:subs', id);
  return sub ? { id, sub, meta: (await redis.hget('overload:dmeta', id)) || {} } : null;
};
// Limite d'appels par adresse IP
L.limited = async (req, name, max) => {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'local';
  const k = 'overload:rl:' + name + ':' + crypto.createHash('sha256').update(ip).digest('hex'), redis = L.getRedis();
  const n = await redis.incr(k);
  if (n === 1) await redis.expire(k, 900);
  return n > max;
};

// Envoie à un appareil ({ id: abonnement }) ou à tous
L.sendAll = async (payload, host, only) => {
  const redis = L.getRedis();
  const push = L.getPush(host);
  const subs = only || (await redis.hgetall('overload:subs')) || {};
  let sent = 0, failed = 0;
  await Promise.all(Object.entries(subs).map(async ([id, sub]) => {
    try {
      await push.sendNotification(sub, JSON.stringify(payload), { TTL: 600, urgency: 'high' });
      sent++;
    } catch (e) {
      failed++;
      if (e && (e.statusCode === 404 || e.statusCode === 410)) { await redis.hdel('overload:subs', id); await redis.hdel('overload:dmeta', id); }
    }
  }));
  return { sent, failed };
};

// Enveloppe : méthode, accès, erreurs lisibles
L.route = (method, handler, opts = {}) => async (req, res) => {
  try {
    if (req.method !== method) return res.status(405).json({ error: 'method' });
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    // appareil : reconnu par son abonnement, sans clé
    if (opts.device) {
      const dev = await L.device(req);
      if (!dev) return res.status(401).json({ error: 'appareil inconnu' });
      return await handler(req, res, host, dev);
    }
    if (opts.public) return await handler(req, res, host);
    const ok = L.authed(req) || (opts.cron && L.bearer(req));
    if (!ok) return res.status(401).json({ error: 'auth' });
    await handler(req, res, host);
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};

module.exports = L;
