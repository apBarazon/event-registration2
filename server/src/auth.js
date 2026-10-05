const crypto = require('crypto');

const SECRET = process.env.AUTH_SECRET || 'dev-secret-change-me';
const sign = (body) => crypto.createHmac('sha256', SECRET).update(body).digest('base64url');

// Stateless login token: base64(payload).signature (no extra dependency needed)
function makeToken(user) {
  const body = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + 7 * 24 * 3600 * 1000 })).toString('base64url');
  return `${body}.${sign(body)}`;
}

function readToken(token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig || sig !== sign(body)) return null;
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  return payload.exp > Date.now() ? payload : null;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}

function checkPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  return crypto.scryptSync(password, salt, 64).toString('hex') === hash;
}

module.exports = { makeToken, readToken, hashPassword, checkPassword };
