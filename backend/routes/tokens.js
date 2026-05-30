// routes/tokens.js
const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');
const dbModule = require('../db');
function getDb() { return dbModule.getDB(); }

const BASE_CHAIN_ID = 8453;

// ── Validate a Base mainnet contract address via RPC ──────────────────────────
async function verifyOnChain(provider, contractAddress, expectedDeployer) {
  try {
    const code = await provider.getCode(contractAddress);
    if (!code || code === '0x') return { ok: false, reason: 'no contract at address' };

    // Optionally check deployer matches tx
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// ── POST /api/tokens — save a deployed token ─────────────────────────────────
router.post('/', async (req, res) => {
  const {
    contract, tx_hash, block_number, deployer,
    name, symbol, supply, decimals = 18,
    description, website, twitter, gitlawb_repo,
    lp_alloc, vesting, governance,
  } = req.body;

  // basic validation
  if (!contract || !tx_hash || !deployer || !name || !symbol || !supply) {
    return res.status(400).json({ error: 'missing required fields: contract, tx_hash, deployer, name, symbol, supply' });
  }

  if (!ethers.utils.isAddress(contract))  return res.status(400).json({ error: 'invalid contract address' });
  if (!ethers.utils.isAddress(deployer))  return res.status(400).json({ error: 'invalid deployer address' });

  // verify on Base mainnet
  const provider = req.app.locals.provider;
  const network  = await provider.getNetwork().catch(() => null);
  if (!network || network.chainId !== BASE_CHAIN_ID) {
    return res.status(503).json({ error: 'cannot reach Base mainnet RPC' });
  }

  const check = await verifyOnChain(provider, contract, deployer);
  if (!check.ok) return res.status(422).json({ error: `on-chain verification failed: ${check.reason}` });

  // check if already saved
  const existing = getDb().getToken(contract);
  if (existing) return res.status(409).json({ error: 'token already registered', token: existing });

  try {
    const tokenId = getDb().insertToken({
      contract:     contract.toLowerCase(),
      tx_hash:      tx_hash.toLowerCase(),
      block_number: Number(block_number) || 0,
      deployer:     deployer.toLowerCase(),
      name, symbol: symbol.toUpperCase(), supply: supply.toString(),
      decimals: Number(decimals),
      description:  description  || null,
      website:      website      || null,
      twitter:      twitter      || null,
      gitlawb_repo: gitlawb_repo || null,
      lp_alloc:     lp_alloc     || null,
      vesting:      vesting      || null,
      governance:   governance   || null,
      chain_id:     BASE_CHAIN_ID,
    });

    getDb().logLaunch(tokenId, 'DEPLOYED', { contract, deployer, block_number });

    const token = getDb().getToken(contract);
    return res.status(201).json({ ok: true, token });
  } catch (e) {
    if (e.message?.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'token already registered' });
    }
    console.error('[POST /tokens]', e.message);
    return res.status(500).json({ error: 'database error' });
  }
});

// ── GET /api/tokens — list all tokens ────────────────────────────────────────
router.get('/', (req, res) => {
  const limit  = Math.min(Number(req.query.limit)  || 20, 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const q      = req.query.q;

  if (q) {
    const tokens = getDb().searchTokens(q);
    return res.json({ tokens, total: tokens.length });
  }

  return res.json(getDb().listTokens(limit, offset));
});

// ── GET /api/tokens/recent ────────────────────────────────────────────────────
router.get('/recent', (req, res) => {
  return res.json({ tokens: getDb().recentActivity() });
});

// ── GET /api/tokens/deployer/:address ────────────────────────────────────────
router.get('/deployer/:address', (req, res) => {
  const { address } = req.params;
  if (!ethers.utils.isAddress(address)) return res.status(400).json({ error: 'invalid address' });
  return res.json({ tokens: getDb().getTokensByDeployer(address.toLowerCase()) });
});

// ── GET /api/tokens/:contractOrSymbol ────────────────────────────────────────
router.get('/:id', (req, res) => {
  const token = getDb().getToken(req.params.id);
  if (!token) return res.status(404).json({ error: 'token not found' });
  return res.json({ token });
});

module.exports = router;
