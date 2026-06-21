const crypto = require('crypto');

class RelayTransport {
  constructor(options = {}) {
    this.authSecret = options.authSecret || process.env.AUTH_SECRET || crypto.randomBytes(32).toString('hex');
    this.nodes = parseRelayNodes(options.nodes || process.env.RELAY_NODES || '', this.authSecret);
    this.timeoutMs = Number(options.timeoutMs || process.env.RELAY_TIMEOUT_MS || 5000);
  }

  async route(payload) {
    if (!payload.sealed_envelope) throw new Error('A sealed envelope is required for relay transport.');
    const envelopeHash = digest(JSON.stringify(payload.sealed_envelope));
    let chainHash = digest(`ignis-relay:${payload.submission_id}:${payload.bundle_hash}`);
    const receipts = [];
    for (const node of this.nodes) {
      const hop = {
        version: 1,
        node_id: node.id,
        role: node.role,
        region: node.region,
        submission_id: payload.submission_id,
        bundle_hash: payload.bundle_hash,
        envelope_hash: envelopeHash,
        sealed_envelope: payload.sealed_envelope,
        previous_hash: chainHash,
        nonce: crypto.randomBytes(16).toString('base64url'),
        timestamp: new Date().toISOString(),
      };
      const receipt = node.url
        ? await this.forward(node, hop)
        : createReceipt(hop, node.secret);
      verifyReceipt(receipt, node.secret);
      if (receipt.previous_hash !== chainHash || receipt.node_id !== node.id) {
        throw new Error(`Relay ${node.id} returned a receipt outside the expected chain.`);
      }
      chainHash = receipt.receipt_hash;
      receipts.push(publicReceipt(receipt));
    }
    return {
      status: 'delivered',
      policy: 'ingress -> mixer -> exit',
      path: receipts.map(item => item.node_id),
      receipts,
      route_hash: chainHash,
      delivered_at: new Date().toISOString(),
      network_isolation: this.productionReady() ? 'independent-origins' : 'embedded-preview',
    };
  }

  async forward(node, hop) {
    const body = JSON.stringify(hop);
    const timestamp = Date.now().toString();
    const nonce = crypto.randomBytes(12).toString('base64url');
    const signature = hmac(node.secret, `${timestamp}.${nonce}.${body}`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${node.url.replace(/\/$/, '')}/relay/v1/forward`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Relay-Node': node.id,
          'X-Relay-Timestamp': timestamp,
          'X-Relay-Nonce': nonce,
          'X-Relay-Signature': signature,
        },
        body,
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Relay ${node.id} returned HTTP ${response.status}.`);
      return response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  verifyInbound(headers, rawBody, replayStore) {
    const nodeId = String(headers['x-relay-node'] || '');
    const node = this.nodes.find(item => item.id === nodeId);
    if (!node) throw new Error('Unknown relay node.');
    const timestamp = String(headers['x-relay-timestamp'] || '');
    const nonce = String(headers['x-relay-nonce'] || '');
    const signature = String(headers['x-relay-signature'] || '');
    if (!timestamp || Math.abs(Date.now() - Number(timestamp)) > 60_000) throw new Error('Relay timestamp expired.');
    if (!nonce || replayStore.some(item => item.nonce === nonce)) throw new Error('Relay nonce replayed.');
    const expected = hmac(node.secret, `${timestamp}.${nonce}.${rawBody}`);
    if (!safeEqual(signature, expected)) throw new Error('Relay signature invalid.');
    replayStore.unshift({ nonce, node_id: nodeId, expires_at: new Date(Date.now() + 120_000).toISOString() });
    if (replayStore.length > 2000) replayStore.length = 2000;
    return node;
  }

  accept(node, hop) {
    if (hop.node_id !== node.id) throw new Error('Relay hop node mismatch.');
    return createReceipt(hop, node.secret);
  }

  productionReady() {
    const origins = new Set(this.nodes.map(item => {
      try { return item.url ? new URL(item.url).origin : ''; } catch { return ''; }
    }).filter(Boolean));
    return this.nodes.length >= 3 && origins.size >= 3 && this.nodes.every(item => item.url?.startsWith('https://'));
  }

  status() {
    return {
      nodes: this.nodes.map(({ secret, ...node }) => ({ ...node, mode: node.url ? 'network' : 'embedded' })),
      production_ready: this.productionReady(),
      guarantee: this.productionReady()
        ? 'network relay transport configured; independent audit still required'
        : 'cryptographic relay pipeline active; independent network origins are not configured',
    };
  }
}

function parseRelayNodes(value, authSecret) {
  let input = [];
  try {
    input = value ? JSON.parse(value) : [];
  } catch {
    throw new Error('RELAY_NODES must be valid JSON.');
  }
  const defaults = [
    { id: 'relay-tyo-01', region: 'Tokyo', role: 'ingress' },
    { id: 'relay-sgp-04', region: 'Singapore', role: 'mixer' },
    { id: 'relay-ams-09', region: 'Amsterdam', role: 'exit' },
  ];
  return (input.length ? input : defaults).map((node, index) => ({
    id: String(node.id || defaults[index]?.id || `relay-${index + 1}`),
    region: String(node.region || 'undisclosed'),
    role: String(node.role || ['ingress', 'mixer', 'exit'][index] || 'mixer'),
    url: String(node.url || ''),
    secret: String(node.secret || hmac(authSecret, `relay-key:${node.id || index}`)),
  }));
}

function createReceipt(hop, secret) {
  const { sealed_envelope: envelope, ...metadata } = hop;
  if (!envelope || metadata.envelope_hash !== digest(JSON.stringify(envelope))) {
    throw new Error('Relay sealed envelope hash mismatch.');
  }
  const receipt = { ...metadata, accepted_at: new Date().toISOString() };
  receipt.receipt_hash = digest(JSON.stringify(receipt));
  receipt.signature = hmac(secret, receipt.receipt_hash);
  return receipt;
}

function verifyReceipt(receipt, secret) {
  if (!receipt?.receipt_hash) throw new Error('Relay receipt verification failed.');
  const { receipt_hash: storedHash, signature, ...payload } = receipt;
  const computedHash = digest(JSON.stringify(payload));
  if (!safeEqual(storedHash, computedHash) || !safeEqual(signature, hmac(secret, storedHash))) {
    throw new Error('Relay receipt verification failed.');
  }
}

function publicReceipt(receipt) {
  const { nonce, ...result } = receipt;
  return result;
}

function digest(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function hmac(secret, value) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { RelayTransport };
