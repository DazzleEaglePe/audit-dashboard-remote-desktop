const crypto = require('crypto');

function requireAdmin(req, res, next) {
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected) {
    return res.status(500).json({ error: 'ADMIN_API_TOKEN no configurado en el servidor' });
  }
  
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  // Comparación en tiempo constante (evita timing attacks)
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  
  next();
}

module.exports = { requireAdmin };
