const auth = require('./_auth');
const panel = require('./_dropipanel');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!auth.valid(req)) return res.status(401).json({ error: 'Sesión requerida' });
  if (req.method !== 'GET' && !/application\/json/.test(req.headers['content-type'] || '') && req.method !== 'DELETE')
    return res.status(415).json({ error: 'Se espera JSON' });
  return panel.handle(req, res);
};
