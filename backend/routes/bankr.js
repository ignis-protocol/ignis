// routes/bankr.js — bankr.bot integration
// Preferred path: Partner Token Launch Deploy API, with creator fees routed to
// the user's connected wallet. Fallback: Agent API prompt with a user key.
const express = require('express');
const router  = express.Router();
const { ethers } = require('ethers');
const dbModule = require('../db');
function getDb() { return dbModule.getDB(); }

const BANKR_AGENT_API_BASE = 'https://api.bankr.bot/agent';
const BANKR_TOKEN_API_BASE = 'https://api.bankr.bot/token-launches';
const POLL_INTERVAL  = 2500;
const POLL_TIMEOUT   = 80;
const BANKR_PARTNER_KEY = process.env.BANKR_PARTNER_KEY || null;

function hasPartnerKey() {
  return !!(BANKR_PARTNER_KEY && BANKR_PARTNER_KEY !== 'bk_ptr_your_key_here');
}

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
function parseBankrError(text, status) {
  let parsed = null;
  try { parsed = JSON.parse(text); } catch (_) {}

  const code = parsed?.error || parsed?.code || '';
  const message = parsed?.message || text || `bankr.bot ${status}`;

  if (code === 'subscription_required' || /subscription_required|Bankr Club|LLM credits/i.test(message)) {
    return {
      code: 'subscription_required',
      message: 'Bankr Agent API requires Bankr Club or LLM credits. Ignis will use Bankr Deploy API automatically once BANKR_PARTNER_KEY is configured.',
      bankr_message: message,
    };
  }

  return { code: code || `bankr_${status}`, message };
}

async function bankrPost(path, body, apiKey) {
  const resp = await fetch(`${BANKR_AGENT_API_BASE}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => resp.statusText);
    const normalized = parseBankrError(text, resp.status);
    const err = new Error(normalized.message);
    err.status = resp.status;
    err.code = normalized.code;
    err.details = normalized;
    throw err;
  }
  return resp.json();
}

async function bankrGet(path, apiKey) {
  const resp = await fetch(`${BANKR_AGENT_API_BASE}${path}`, {
    headers: { 'X-API-Key': apiKey },
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => resp.statusText);
    const normalized = parseBankrError(text, resp.status);
    const err = new Error(normalized.message);
    err.status = resp.status;
    err.code = normalized.code;
    err.details = normalized;
    throw err;
  }
  return resp.json();
}

async function bankrDeploy(body) {
  const resp = await fetch(`${BANKR_TOKEN_API_BASE}/deploy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Partner-Key': BANKR_PARTNER_KEY,
    },
    body: JSON.stringify(body),
  });

  const text = await resp.text();
  let json = null;
  try { json = text ? JSON.parse(text) : {}; } catch (_) {}

  if (!resp.ok) {
    const normalized = parseBankrError(text, resp.status);
    const err = new Error(normalized.message);
    err.status = resp.status;
    err.code = normalized.code;
    err.details = normalized;
    throw err;
  }

  return json || {};
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
// body: { name, symbol, fee_recipient, apiKey?, ... }
// Preferred: BANKR_PARTNER_KEY deploys and routes 57% creator fee to fee_recipient.
// Fallback: user/platform Agent API key submits a natural-language launch prompt.
router.post('/launch', async (req, res) => {
  const { name, symbol, description, website, twitter,
          gitlawb_repo, vesting, governance, fee_recipient, simulateOnly } = req.body;

  if (!name)   return res.status(400).json({ error: 'name required' });
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  if (hasPartnerKey()) {
    if (!fee_recipient) {
      return res.status(400).json({ error: 'fee_recipient wallet required for Bankr partner deploy' });
    }
    if (!ethers.utils.isAddress(fee_recipient)) {
      return res.status(400).json({ error: 'invalid fee_recipient wallet address' });
    }

    try {
      const launch = await bankrDeploy({
        tokenName: name,
        tokenSymbol: symbol,
        feeRecipient: {
          type: 'wallet',
          value: fee_recipient,
        },
        ...(description ? { description } : {}),
        ...(website ? { website } : {}),
        ...(twitter ? { twitter } : {}),
        ...(simulateOnly ? { simulateOnly: true } : {}),
      });

      return res.status(simulateOnly ? 200 : 201).json({
        ok: true,
        mode: 'partner_deploy',
        launch,
        contract: launch.tokenAddress || launch.contract || launch.address || null,
        tx_hash: launch.txHash || launch.transactionHash || null,
        fee_recipient,
        fee_model: '57% creator share routed to user wallet',
        message: simulateOnly ? 'launch simulated' : 'token deployed',
      });
    } catch(e) {
      console.error('[POST /bankr/launch partner]', e.message);
      return res.status(e.status || 502).json({
        error: e.message,
        code: e.code || 'bankr_partner_error',
        details: e.details || null,
      });
    }
  }

  let apiKey;
  try { apiKey = resolveKey(req.body); } catch(e) {
    return res.status(503).json({
      error: 'Bankr partner deploy is not configured yet, and no fallback Bankr Agent API key was provided.',
      code: 'bankr_not_configured',
      hint: 'Add BANKR_PARTNER_KEY for no-gas user launches, or provide a Bankr Agent API key with Bankr Club/LLM credits.',
    });
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
    const status = e.status || (e.message.includes('401') ? 401
                 : e.message.includes('403') ? 403 : 502);
    return res.status(status).json({
      error: e.message,
      code: e.code || 'bankr_agent_error',
      details: e.details || null,
    });
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
  const partnerConfigured = hasPartnerKey();
  return res.json({
    ok: true,
    configured: partnerConfigured || platformConfigured,
    partner_configured: partnerConfigured,
    agent_configured: platformConfigured,
    fee_model: partnerConfigured ? 'partner-deploy-fee-recipient' : 'agent-api-fallback',
    hint: partnerConfigured
      ? 'Bankr Deploy API is enabled — 57% creator share routes to the connected wallet.'
      : 'Bankr partner deploy is pending. Agent API fallback requires Bankr Club or LLM credits.',
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
