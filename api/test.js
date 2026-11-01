// Envoie une notification de test à cet appareil
const L = require('./_lib');

module.exports = L.route('POST', async (req, res, host, dev) => {
  res.json(await L.sendAll({ title: 'Overload', body: 'Les notifications fonctionnent.', tag: 'test', url: '/' }, host, { [dev.id]: dev.sub }));
}, { device: true });
