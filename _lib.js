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

// Accès protégé par la clé OVERLOAD_KEY
L.authed = (req) => {
  const k = process.env.OVERLOAD_KEY;
  return !!k && safeEq(req.headers['x-overload-key'] || '', k);
};
// Appel automatique de Vercel Cron (CRON_SECRET)
L.bearer = (req) => {
  const s = process.env.CRON_SECRET;
  return !!s && safeEq(req.headers.authorization || '', 'Bearer ' + s);
};

L.sendAll = async (payload, host) => {
  const redis = L.getRedis();
  const push = L.getPush(host);
  const subs = (await redis.hgetall('overload:subs')) || {};
  let sent = 0, failed = 0;
  await Promise.all(Object.entries(subs).map(async ([id, sub]) => {
    try {
      await push.sendNotification(sub, JSON.stringify(payload), { TTL: 600, urgency: 'high' });
      sent++;
    } catch (e) {
      failed++;
      if (e && (e.statusCode === 404 || e.statusCode === 410)) await redis.hdel('overload:subs', id);
    }
  }));
  return { sent, failed };
};

// Enveloppe : méthode, accès, erreurs lisibles
L.route = (method, handler, opts = {}) => async (req, res) => {
  try {
    if (req.method !== method) return res.status(405).json({ error: 'method' });
    const ok = L.authed(req) || (opts.cron && L.bearer(req));
    if (!ok) return res.status(401).json({ error: 'auth' });
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    await handler(req, res, host);
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};

module.exports = L;
