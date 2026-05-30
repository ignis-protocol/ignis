// routes/bankr.js — bankr.bot Agent API integration
// Per-user API key: each user brings their own bankr.bot key
// so their 57% fee share goes directly to their own bankr wallet.
const express = require('express');
const router  = express.Router();
const dbModule = require('../db');
function getDb() { return dbModule.getDB(); }

const BANKR_API_BASE = 'https://api.bankr.bot/agent';
const POLL_INTERVAL  = 2500;
const POLL_TIMEOUT   = 80;

// ── resolve which key to use ──────────────────────────────────────────────────
// Priority: user-supplied key > BANKR_API_KEY env (platform fallback)
function resolveKey(reqBody = {}) {
  const userKey = reqBody.apiKey;
  const envKey  = process.env.BANKR_API_KEY;
  const key = userKey || envKey;
  if (!key || key === 'bk_your_key_here') {
    throw new Error('No bankr.bot API key — get yours free at bankr.bot/api');
  }
  return key;
}

// ── helpers ───────────────────────────────────────────────────────────────────
async function bankrPost(path, body, apiKey) {
  const resp = await fetch(`${BANKR_API_BASE}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => resp.statusText);
    throw new Error(`bankr.bot ${resp.status}: ${text}`);
  }
  return resp.json();
}

async function bankrGet(path, apiKey) {
  const resp = await fetch(`${BANKR_API_BASE}${path}`, {
    headers: { 'X-API-Key': apiKey },
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => resp.statusText);
    throw new Error(`bankr.bot ${resp.status}: ${text}`);
  }
  return resp.json();
}

function buildLaunchPrompt(data) {
  const parts = [
    `Launch a token on Base with the following details:`,
    `Name: ${data.name}`,
    `Symbol: ${data.symbol}`,
  ];
  if (data.description) parts.push(`Description: ${data.description}`);
  if (data.website)     parts.push(`Website: ${data.website}`);
  if (data.twitter)     parts.push(`Twitter: ${data.twitter}`);
  parts.push('Please deploy this as a fair launch on Base mainnet.');
  return parts.join('\n');
}

// ── POST /api/bankr/launch ────────────────────────────────────────────────────
// body: { apiKey (user's own key), name, symbol, ... }
// If apiKey is provided: 57% fee → user's bankr wallet
// If not: falls back to platform BANKR_API_KEY (fee → platform wallet)
router.post('/launch', async (req, res) => {
  const { name, symbol, description, website, twitter,
          gitlawb_repo, vesting, governance } = req.body;

  if (!name)   return res.status(400).json({ error: 'name required' });
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  let apiKey;
  try { apiKey = resolveKey(req.body); } catch(e) {
    return res.status(503).json({ error: e.message });
  }

  const usingUserKey = !!req.body.apiKey;
  const prompt = buildLaunchPrompt({ name, symbol, description, website, twitter });

  try {
    const { jobId } = await bankrPost('/prompt', { prompt }, apiKey);
    if (!jobId) return res.status(502).json({ error: 'bankr.bot did not return a jobId' });

    return res.json({
      ok: true,
      jobId,
      fee_recipient: usingUserKey ? 'your bankr wallet (57% of swaps)' : 'platform wallet',
      message: 'launch job submitted',
    });
  } catch(e) {
    console.error('[POST /bankr/launch]', e.message);
    const status = e.message.includes('401') ? 401
                 : e.message.includes('403') ? 403 : 502;
    return res.status(status).json({ error: e.message });
  }
});

// ── GET /api/bankr/job/:jobId ─────────────────────────────────────────────────
// Pass apiKey as query param or x-api-key header to use user's key
router.get('/job/:jobId', async (req, res) => {
  let apiKey;
  try { apiKey = resolveKey({ apiKey: req.headers['x-api-key'] || req.query.apiKey }); }
  catch(e) { return res.status(400).json({ error: e.message }); }

  try {
    const job = await bankrGet(`/job/${req.params.jobId}`, apiKey);
    return res.json({ ok: true, job });
  } catch(e) {
    return res.status(502).json({ error: e.message });
  }
});

// ── POST /api/bankr/save ──────────────────────────────────────────────────────
router.post('/save', async (req, res) => {
  const { contract, tx_hash, block_number, deployer,
          name, symbol, description, website, twitter,
          gitlawb_repo, vesting, governance } = req.body;

  if (!name || !symbol) return res.status(400).json({ error: 'name and symbol required' });

  const contractKey = contract || `bankr-${Date.now()}`;
  const existing = getDb().getToken(contractKey);
  if (existing) return res.status(409).json({ error: 'already registered', token: existing });

  try {
    const tokenId = getDb().insertToken({
      contract:     contractKey.toLowerCase(),
      tx_hash:      (tx_hash || '').toLowerCase(),
      block_number: Number(block_number) || 0,
      deployer:     (deployer || 'bankr.bot').toLowerCase(),
      name, symbol: symbol.toUpperCase(), supply: '0', decimals: 18,
      description:  description  || null,
      website:      website      || null,
      twitter:      twitter      || null,
      gitlawb_repo: gitlawb_repo || null,
      lp_alloc: '100', vesting: vesting || null,
      governance: governance || null, chain_id: 8453,
    });
    getDb().logLaunch(tokenId, 'BANKR_LAUNCH', { contract, deployer });
    return res.status(201).json({ ok: true });
  } catch(e) {
    console.error('[POST /bankr/save]', e.message);
    return res.status(500).json({ error: 'database error' });
  }
});

// ── GET /api/bankr/status ─────────────────────────────────────────────────────
router.get('/status', (_req, res) => {
  const envKey = process.env.BANKR_API_KEY;
  const platformConfigured = !!(envKey && envKey !== 'bk_your_key_here');
  return res.json({
    ok: true,
    configured: platformConfigured,
    // Always tell users to bring their own key for fee ownership
    fee_model: 'bring-your-own-key',
    hint: 'Get your free API key at bankr.bot/api — 57% of swap fees go to your wallet',
  });
});

// ── POST /api/bankr/prompt — raw prompt (power users) ────────────────────────
router.post('/prompt', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt required' });
  let apiKey;
  try { apiKey = resolveKey(req.body); } catch(e) {
    return res.status(503).json({ error: e.message });
  }
  try {
    const { jobId } = await bankrPost('/prompt', { prompt }, apiKey);
    // poll inline for /prompt convenience
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL));
      const job = await bankrGet(`/job/${jobId}`, apiKey);
      if (job.status === 'completed') return res.json({ ok: true, response: job.response });
      if (job.status === 'failed')    return res.json({ ok: false, error: job.error });
    }
    return res.json({ ok: false, error: 'timeout' });
  } catch(e) {
    return res.status(502).json({ error: e.message });
  }
});

module.exports = router;
