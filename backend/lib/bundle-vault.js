const crypto = require('crypto');

class BundleVault {
  constructor(options = {}) {
    this.keys = parseKeys(options.keys || process.env.SEALED_BUNDLE_KEYS || '');
    this.activeKeyId = options.activeKeyId || process.env.SEALED_BUNDLE_ACTIVE_KEY_ID || '';

    if (!this.keys.size) {
      const fallback = options.fallbackSecret || process.env.AUTH_SECRET || '';
      if (!fallback) throw new Error('SEALED_BUNDLE_KEYS or AUTH_SECRET must be configured.');
      this.activeKeyId = 'derived-v1';
      this.keys.set(this.activeKeyId, crypto.createHash('sha256').update(`ignis-vault:${fallback}`).digest());
      console.warn('[VAULT] SEALED_BUNDLE_KEYS is unset; using an AUTH_SECRET-derived compatibility key.');
    }

    if (!this.activeKeyId) this.activeKeyId = this.keys.keys().next().value;
    if (!this.keys.has(this.activeKeyId)) {
      throw new Error(`SEALED_BUNDLE_ACTIVE_KEY_ID "${this.activeKeyId}" is not present in SEALED_BUNDLE_KEYS.`);
    }
  }

  encrypt(value, context = {}) {
    const key = this.keys.get(this.activeKeyId);
    const iv = crypto.randomBytes(12);
    const aad = Buffer.from(stableContext(context));
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(aad);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    return {
      version: 1,
      algorithm: 'aes-256-gcm',
      key_id: this.activeKeyId,
      iv: iv.toString('base64url'),
      tag: cipher.getAuthTag().toString('base64url'),
      ciphertext: ciphertext.toString('base64url'),
      context_hash: sha256(aad),
      encrypted_at: new Date().toISOString(),
    };
  }

  decrypt(envelope, context = {}) {
    if (!envelope || envelope.algorithm !== 'aes-256-gcm') throw new Error('Unsupported sealed bundle envelope.');
    const key = this.keys.get(envelope.key_id);
    if (!key) throw new Error(`Sealed bundle key "${envelope.key_id}" is unavailable.`);
    const aad = Buffer.from(stableContext(context));
    if (envelope.context_hash !== sha256(aad)) throw new Error('Sealed bundle context mismatch.');
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(envelope.iv, 'base64url'),
    );
    decipher.setAAD(aad);
    decipher.setAuthTag(Buffer.from(envelope.tag, 'base64url'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, 'base64url')),
      decipher.final(),
    ]);
    return JSON.parse(plaintext.toString('utf8'));
  }

  status() {
    return {
      configured: this.keys.size > 0,
      active_key_id: this.activeKeyId,
      available_key_ids: [...this.keys.keys()],
      algorithm: 'aes-256-gcm',
    };
  }
}

function parseKeys(value) {
  const keys = new Map();
  String(value).split(',').map(item => item.trim()).filter(Boolean).forEach(entry => {
    const separator = entry.indexOf(':');
    if (separator < 1) return;
    const id = entry.slice(0, separator).trim();
    const material = entry.slice(separator + 1).trim();
    const key = decodeKey(material);
    if (id && key) keys.set(id, key);
  });
  return keys;
}

function decodeKey(value) {
  try {
    const decoded = /^[0-9a-f]{64}$/i.test(value)
      ? Buffer.from(value, 'hex')
      : Buffer.from(value, 'base64');
    return decoded.length === 32 ? decoded : null;
  } catch {
    return null;
  }
}

function stableContext(context) {
  return JSON.stringify(Object.keys(context).sort().reduce((result, key) => {
    result[key] = context[key];
    return result;
  }, {}));
}

function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

module.exports = { BundleVault, parseKeys };
