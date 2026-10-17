// Envoie une notification de test
const L = require('./_lib');

module.exports = L.route('POST', async (req, res, host) => {
  const out = await L.sendAll({ title: 'Overload', body: 'Les notifications fonctionnent.', tag: 'test', url: '/' }, host);
  res.json(out);
});
