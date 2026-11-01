// Import par IA : une note ou des captures d'écran de séances → séances reliées au catalogue (exercices, séries, reps, poids)
// Clé à mettre dans Vercel : GEMINI_API_KEY (gratuite sur https://aistudio.google.com/apikey), GEMINI_MODEL en option
const crypto = require('crypto');
const L = require('./_lib');

const API = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODELS = [process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite', 'gemini-3.8-flash'];
const MAX_IMAGES = 4, MAX_IMAGE = 2.5e6, MAX_TEXT = 12000;

const SYSTEM = `Tu convertis les notes d'entraînement de musculation d'un utilisateur (texte collé ou captures d'écran d'une autre app, d'un carnet, d'une note de téléphone, d'un tableau…) en séances pour l'application Overload.

Pour chaque séance trouvée :
- name : le nom donné par l'utilisateur (« Pecs », « Push », « Séance A », « Lundi »…). S'il n'y en a pas, nomme-la d'après les muscles travaillés (ex. « Pectoraux · Triceps »).
- rest_seconds : temps de repos entre séries s'il est indiqué (« 2 min » → 120), sinon 0.
- exercises : dans l'ordre de la note.

Pour chaque exercice :
- original : le texte tel qu'écrit par l'utilisateur.
- catalog_name : le nom EXACT (copié caractère pour caractère) de l'exercice du catalogue qui correspond, en tenant compte des abréviations, de l'argot de salle, des fautes, de l'anglais et du matériel (ex. « DC » ou « bench » → développé couché à la barre ; « DC halt » → la version haltères ; « tirage vertical » ou « lat pull » → tirage poitrine/vertical à la poulie). Choisis la variante la plus proche par le matériel et l'angle. Laisse "" seulement si rien dans le catalogue ne correspond vraiment.
- new_name : si catalog_name est "", un nom propre en français pour créer l'exercice (sinon "").
- group : le groupe musculaire principal, parmi la liste fournie.
- sets : nombre de séries. Si les séries sont détaillées une par une (« 80x10, 85x8, 85x8 »), compte-les. Si rien n'est indiqué, mets 3.
- reps : répétitions par série (la plus fréquente si elles varient ; pour une fourchette « 8-12 », prends le haut). Si rien n'est indiqué, mets 10.
- weight_kg : la charge de travail principale en kg (convertis les livres : lbs × 0,4536, arrondi à 0,5). 0 si non indiquée ou au poids du corps.
- set_weights_kg : la charge de chaque série si elles diffèrent (même longueur que sets), sinon [].
- note : une précision utile et courte si besoin (tempo, superset, dégressive, « poids incertain sur la capture »…), sinon "".

Ne devine pas des chiffres qui n'apparaissent pas. Ignore ce qui n'est pas de la musculation (repas, sommeil…), sauf le cardio que tu peux reprendre comme exercice s'il est au catalogue.
message : une phrase courte en français pour l'utilisateur (ce que tu as compris, ou ce qui manque). Si aucune séance n'est lisible, renvoie sessions vide et explique pourquoi dans message.`;

const schema = groups => ({
  type: 'object',
  additionalProperties: false,
  required: ['sessions', 'message'],
  properties: {
    message: { type: 'string' },
    sessions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'rest_seconds', 'exercises'],
        properties: {
          name: { type: 'string' },
          rest_seconds: { type: 'integer' },
          exercises: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['original', 'catalog_name', 'new_name', 'group', 'sets', 'reps', 'weight_kg', 'set_weights_kg', 'note'],
              properties: {
                original: { type: 'string' },
                catalog_name: { type: 'string' },
                new_name: { type: 'string' },
                group: { type: 'string', enum: groups },
                sets: { type: 'integer' },
                reps: { type: 'integer' },
                weight_kg: { type: 'number' },
                set_weights_kg: { type: 'array', items: { type: 'number' } },
                note: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }
});

const clamp = (n, a, b, d) => { n = Number(n); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d; };
const kg = n => Math.round(clamp(n, 0, 1000, 0) * 2) / 2;

module.exports = L.route('POST', async (req, res) => {
  if (!process.env.GEMINI_API_KEY) return res.status(501).json({ error: 'L’import IA n’est pas encore activé sur le serveur (clé GEMINI_API_KEY manquante)' });
  const b = req.body || {};
  const text = typeof b.text === 'string' ? b.text.slice(0, MAX_TEXT).trim() : '';
  const images = (Array.isArray(b.images) ? b.images : []).slice(0, MAX_IMAGES)
    .map(u => /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(String(u)))
    .filter(m => m && m[2].length <= MAX_IMAGE);
  if (!text && !images.length) return res.status(400).json({ error: 'Colle une note ou ajoute une capture' });
  // catalogue de l'utilisateur : { groupe: [noms] }
  const cat = b.catalog && typeof b.catalog === 'object' ? b.catalog : {};
  const groups = Object.keys(cat).filter(g => typeof g === 'string' && g.length <= 40).slice(0, 30);
  const names = new Set();
  const catText = groups.map(g => {
    const list = (Array.isArray(cat[g]) ? cat[g] : []).filter(n => typeof n === 'string' && n.length <= 80).slice(0, 400);
    list.forEach(n => names.add(n));
    return `## ${g}\n${list.join('\n')}`;
  }).join('\n\n').slice(0, 60000);
  if (!groups.length || !names.size) return res.status(400).json({ error: 'catalogue manquant' });

  // limites d'usage : 8 imports par quart d'heure et par appareil réseau, 400 par jour pour tout le monde
  if (await L.limited(req, 'ai', 8)) return res.status(429).json({ error: 'Trop d’imports d’affilée, réessaie dans un quart d’heure' });
  const redis = L.getRedis(), dk = 'overload:ai:day:' + new Date().toISOString().slice(0, 10);
  const n = await redis.incr(dk);
  if (n === 1) await redis.expire(dk, 2 * 864e2);
  if (n > 400) return res.status(429).json({ error: 'Limite du jour atteinte, réessaie demain' });

  // generateContent : réponse directe ; schéma JSON complet, sinon le format OpenAPI plus ancien
  const sch = schema(groups);
  const body = (lite) => JSON.stringify({
    systemInstruction: { parts: [{ text: `${SYSTEM}\n\nGroupes musculaires possibles : ${groups.join(', ')}.\n\nCatalogue des exercices de l'utilisateur :\n\n${catText}` }] },
    contents: [{ role: 'user', parts: [
      ...images.map(m => ({ inlineData: { mimeType: m[1], data: m[2] } })),
      { text: text ? `Voici ma note :\n\n${text}` : 'Voici mes captures d’écran.' }
    ] }],
    generationConfig: { maxOutputTokens: 16000, responseMimeType: 'application/json',
      ...(lite ? { responseSchema: JSON.parse(JSON.stringify(sch, (k, v) => k === 'additionalProperties' ? undefined : v)) } : { responseJsonSchema: sch }) }
  });
  const t0 = Date.now();
  let r = null, j = {}, why = '';
  // modèle principal, puis un modèle plus léger si le premier est saturé ou trop lent ; 55 s au total
  outer: for (const model of MODELS) {
    for (const lite of [false, true]) {
      const left = 55000 - (Date.now() - t0);
      if (left < 5000) break outer;
      try {
        r = await fetch(`${API}/${model}:generateContent`, { method: 'POST', signal: AbortSignal.timeout(Math.min(left, 30000)),
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY }, body: body(lite) });
        j = await r.json().catch(() => ({}));
      } catch (e) { r = { ok: false, status: 504 }; j = {}; }
      why = String((j.error && j.error.message) || '').slice(0, 160);
      console.log('gemini', model, lite ? 'responseSchema' : 'responseJsonSchema', r.status, Date.now() - t0 + 'ms', why);
      if (r.ok) break outer;
      if (r.status === 400 && /schema|response_?json/i.test(why) && !lite) continue; // champ de schéma non reconnu : on réessaie
      if (![429, 500, 503, 504].includes(r.status)) break outer;
      break; // modèle suivant
    }
  }
  if (!r || !r.ok) {
    const st = r ? r.status : 504;
    if (st === 429) return res.status(429).json({ error: 'Quota gratuit de l’IA atteint, réessaie dans un moment' });
    if (st === 504) return res.status(504).json({ error: 'L’IA met trop de temps à répondre, réessaie (ou envoie moins de captures)' });
    if (st === 401 || st === 403 || (st === 400 && /api key/i.test(why))) return res.status(500).json({ error: 'Clé GEMINI_API_KEY refusée' });
    return res.status(502).json({ error: 'IA indisponible (' + st + (why ? ' : ' + why : '') + ')' });
  }
  const cand = (j.candidates || [])[0];
  if (!cand) return res.status(422).json({ error: 'L’IA n’a pas pu traiter ce contenu' + (j.promptFeedback && j.promptFeedback.blockReason ? ' (' + j.promptFeedback.blockReason + ')' : '') });
  if (cand.finishReason === 'MAX_TOKENS') return res.status(422).json({ error: 'Note trop longue : importe-la en plusieurs fois' });
  const raw = ((cand.content && cand.content.parts) || []).filter(p => p.text && !p.thought).map(p => p.text).join('');
  if (!raw) return res.status(422).json({ error: 'L’IA n’a pas pu traiter ce contenu (' + (cand.finishReason || 'vide') + ')' });
  let out;
  try { out = JSON.parse(raw); } catch (e) { return res.status(502).json({ error: 'Réponse de l’IA illisible, réessaie' }); }

  // nettoyage : seuls les noms exacts du catalogue sont reliés, le reste devient un exercice perso
  const sessions = (out.sessions || []).slice(0, 20).map(s => ({
    name: String(s.name || 'Séance importée').slice(0, 40),
    rest: clamp(s.rest_seconds, 0, 600, 0),
    exercises: (s.exercises || []).slice(0, 30).map(e => {
      const linked = names.has(e.catalog_name);
      const sets = Math.round(clamp(e.sets, 1, 12, 3));
      const ws = (e.set_weights_kg || []).slice(0, sets).map(kg);
      return {
        original: String(e.original || '').slice(0, 120),
        name: (linked ? e.catalog_name : String(e.new_name || e.original || 'Exercice').trim()).slice(0, 60),
        linked,
        group: groups.includes(e.group) ? e.group : groups[groups.length - 1],
        sets,
        reps: Math.round(clamp(e.reps, 1, 100, 10)),
        weight: kg(e.weight_kg),
        weights: ws.length === sets && ws.some(w => w !== ws[0]) ? ws : null,
        note: String(e.note || '').slice(0, 120)
      };
    }).filter(e => e.name)
  })).filter(s => s.exercises.length);
  res.json({ id: crypto.randomBytes(4).toString('hex'), message: String(out.message || '').slice(0, 300), sessions });
}, { public: true });
