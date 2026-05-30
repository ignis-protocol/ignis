// routes/auth.js — wallet signature authentication
// Flow: GET /challenge → sign message in wallet → POST /verify → get session token
// Session token used for bond/tip operations
const express    = require('express');
const router     = express.Router();
const { ethers } = require('ethers');
const crypto     = require('crypto');
const db         = require('../db');

// ── GET /api/auth/challenge/:address ─────────────────────────────────────────
// Returns a nonce for the wallet to sign
router.get('/challenge/:address', (req, res) => {
  const { address } = req.params;

  if (!ethers.utils.isAddress(address)) {
    return res.status(400).json({ error: 'invalid wallet address' });
  }

  const nonce     = crypto.randomBytes(16).toString('hex');
  const message   = buildSignMessage(address.toLowerCase(), nonce);

  try {
    db.createAuthNonce(address, nonce);
    return res.json({
      ok: true,
      address,
      nonce,
      message,
      instructions: 'Sign this message with your wallet, then POST to /api/auth/verify',
    });
  } catch(e) {
    console.error('[GET /auth/challenge]', e.message);
    return res.status(500).json({ error: 'could not create challenge' });
  }
});

// ── POST /api/auth/verify ─────────────────────────────────────────────────────
// body: { address, nonce, signature }
// Returns: { token } — use as x-auth-token header for protected routes
router.post('/verify', async (req, res) => {
  const { address, nonce, signature } = req.body;

  if (!address || !nonce || !signature) {
    return res.status(400).json({ error: 'address, nonce, and signature required' });
  }

  if (!ethers.utils.isAddress(address)) {
    return res.status(400).json({ error: 'invalid address' });
  }

  // Fetch the stored nonce
  const record = db.getAuthNonce(nonce);
  if (!record) {
    return res.status(401).json({ error: 'nonce not found, expired, or already used' });
  }
  if (record.address !== address.toLowerCase()) {
    return res.status(401).json({ error: 'nonce does not belong to this address' });
  }

  // Verify the signature
  const message = buildSignMessage(address.toLowerCase(), nonce);
  let recovered;
  try {
    recovered = ethers.utils.verifyMessage(message, signature);
  } catch(e) {
    return res.status(401).json({ error: 'invalid signature format' });
  }

  if (recovered.toLowerCase() !== address.toLowerCase()) {
    return res.status(401).json({
      error: 'signature mismatch — wrong wallet signed this message',
      expected: address.toLowerCase(),
      got: recovered.toLowerCase(),
    });
  }

  // Issue session token (24hr)
  const token = crypto.randomBytes(32).toString('hex');
  db.activateSession(nonce, token);
  db.cleanExpiredSessions();

  return res.json({
    ok: true,
    token,
    address: address.toLowerCase(),
    expires_in: '24 hours',
    usage: 'Set header: x-auth-token: <token>',
  });
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
// Check who is authenticated via token
router.get('/me', (req, res) => {
  const token = req.headers['x-auth-token'];
  if (!token) return res.status(401).json({ error: 'x-auth-token header required' });

  const session = db.getSession(token);
  if (!session) return res.status(401).json({ error: 'invalid or expired session' });

  db.extendSession(token);
  return res.json({ ok: true, address: session.address, authenticated: true });
});

// ── MIDDLEWARE: requireAuth ───────────────────────────────────────────────────
// Use in other routes: router.post('/', requireAuth, handler)
function requireAuth(req, res, next) {
  const token = req.headers['x-auth-token'];
  if (!token) {
    return res.status(401).json({
      error: 'authentication required',
      hint: '1. GET /api/auth/challenge/:address  2. sign message  3. POST /api/auth/verify',
    });
  }

  const session = db.getSession(token);
  if (!session) {
    return res.status(401).json({ error: 'invalid or expired session — re-authenticate' });
  }

  db.extendSession(token);
  req.authAddress = session.address;
  next();
}

// ── helpers ───────────────────────────────────────────────────────────────────
function buildSignMessage(address, nonce) {
  return [
    'Ignis Authentication',
    '',
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    '',
    'Sign to prove wallet ownership.',
    'This request will not trigger a blockchain transaction or cost any gas fees.',
  ].join('\n');
}

router.requireAuth = requireAuth;
module.exports = router;
