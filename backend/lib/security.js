const crypto = require('crypto');

function createTokenService(secret) {
  const signingSecret = secret || crypto.randomBytes(32).toString('hex');
  if (!secret) console.warn('[AUTH] AUTH_SECRET is unset; tokens will reset when the process restarts.');

  return {
    issue(payload, ttlSeconds) {
      const now = Math.floor(Date.now() / 1000);
      const body = { ...payload, iat: now, exp: now + ttlSeconds, jti: crypto.randomUUID() };
      const encoded = Buffer.from(JSON.stringify(body)).toString('base64url');
      return `${encoded}.${sign(encoded, signingSecret)}`;
    },
    verify(token, expectedType) {
      const [encoded, signature] = String(token || '').split('.');
      if (!encoded || !signature || !safeEqual(signature, sign(encoded, signingSecret))) return null;
      try {
        const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
        if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
        if (expectedType && payload.type !== expectedType) return null;
        return payload;
      } catch {
        return null;
      }
    },
  };
}

function sign(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

function safeEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function canonicalHash(value) {
  return sha256(stableStringify(value));
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

module.exports = { canonicalHash, createTokenService, sha256 };
