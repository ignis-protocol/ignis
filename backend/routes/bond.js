// routes/bond.js — Repo Bond utility
// Builder bonds $IGNIS to their repo on launch
// Repo inactive 90 days → slashed to treasury
const express   = require('express');
const router    = express.Router();
const { ethers } = require('ethers');
const db        = require('../db');
const { requireAuth } = require('./auth');

// Minimum $IGNIS to bond (configurable)
const MIN_BOND  = process.env.MIN_BOND_IGNIS  || '100';
// $IGNIS contract on Base mainnet (set in .env once deployed)
const IGNIS_CONTRACT = process.env.IGNIS_CONTRACT || null;

// ── helpers ───────────────────────────────────────────────────────────────────
function daysAgo(dateStr) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

// Optional: verify $IGNIS balance on-chain
async function verifyForgeBalance(provider, walletAddress, minAmount) {
  if (!IGNIS_CONTRACT || !walletAddress) return { ok: true, balance: '0', simulated: true };
  try {
    const erc20 = new ethers.Contract(
      IGNIS_CONTRACT,
      ['function balanceOf(address) view returns (uint256)',
       'function decimals() view returns (uint8)'],
      provider
    );
    const [bal, dec] = await Promise.all([erc20.balanceOf(walletAddress), erc20.decimals()]);
    const formatted = parseFloat(ethers.utils.formatUnits(bal, dec));
    return { ok: formatted >= parseFloat(minAmount), balance: formatted.toString() };
  } catch(e) {
    return { ok: true, balance: '0', simulated: true, error: e.message };
  }
}

// ── POST /api/bond — create a repo bond ──────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  const { repo, token_contract, bonder, amount_ignis, tx_hash } = req.body;

  if (!repo)           return res.status(400).json({ error: 'repo required (e.g. owner/repo)' });
  if (!bonder)         return res.status(400).json({ error: 'bonder wallet address required' });
  if (!amount_ignis)   return res.status(400).json({ error: 'amount_ignis required' });
  if (parseFloat(amount_ignis) < parseFloat(MIN_BOND)) {
    return res.status(400).json({ error: `minimum bond is ${MIN_BOND} $IGNIS` });
  }

  // Check if repo already has active bond
  const existing = getDb().getBondByRepo(repo);
  if (existing) {
    return res.status(409).json({ error: 'repo already has an active bond', bond: existing });
  }

  // Verify $IGNIS balance (on-chain if contract set, simulated otherwise)
  const provider = req.app.locals.provider;
  const balCheck = await verifyForgeBalance(provider, bonder, amount_ignis);
  if (!balCheck.ok) {
    return res.status(422).json({
      error: `insufficient $IGNIS — need ${amount_ignis}, have ${balCheck.balance}`,
      balance: balCheck.balance,
    });
  }

  try {
    const id = getDb().insertBond({
      repo,
      token_contract: token_contract || '',
      bonder:         bonder.toLowerCase(),
      amount_ignis:   amount_ignis.toString(),
      tx_hash:        tx_hash || null,
    });

    const bond = getDb().getBondByRepo(repo);
    return res.status(201).json({
      ok: true,
      bond,
      message: `${amount_ignis} $IGNIS bonded to ${repo} — stay active or lose your bond`,
      slash_condition: 'repo inactive for 90 days',
      simulated: balCheck.simulated || false,
    });
  } catch(e) {
    console.error('[POST /bond]', e.message);
    return res.status(500).json({ error: 'database error' });
  }
});

// ── GET /api/bond/:repo — get bond for a repo ─────────────────────────────────
router.get('/:repo(*)', (req, res) => {
  const repo = req.params.repo;
  const bond = getDb().getBondByRepo(repo);
  if (!bond) return res.status(404).json({ error: 'no active bond for this repo' });

  const inactive_days = daysAgo(bond.last_commit_at);
  const days_until_slash = Math.max(0, 90 - inactive_days);

  return res.json({
    ok: true,
    bond: {
      ...bond,
      inactive_days,
      days_until_slash,
      at_risk: inactive_days > 60,
    },
  });
});

// ── GET /api/bond/bonder/:address — bonds by wallet ──────────────────────────
router.get('/bonder/:address', (req, res) => {
  const bonds = getDb().getBondsByBonder(req.params.address);
  return res.json({ ok: true, bonds });
});

// ── GET /api/bond — list all active bonds ─────────────────────────────────────
router.get('/', (req, res) => {
  const bonds = getDb().listActiveBonds();
  return res.json({ ok: true, bonds, total: bonds.length });
});

// ── POST /api/bond/ping — update last_commit_at (called on new gitlawb push) ──
router.post('/ping', (req, res) => {
  const { repo, secret } = req.body;
  // In production, verify gitlawb webhook secret
  if (!repo) return res.status(400).json({ error: 'repo required' });
  getDb().updateBondCommit(repo);
  return res.json({ ok: true, message: `bond timer reset for ${repo}` });
});

// ── POST /api/bond/slash — run slash check (call via cron) ───────────────────
router.post('/slash', (req, res) => {
  const stale = getDb().getStaleBonds();
  const slashed = [];

  for (const bond of stale) {
    getDb().slashBond(bond.id);
    slashed.push({
      id:     bond.id,
      repo:   bond.repo,
      bonder: bond.bonder,
      amount: bond.amount_ignis,
      inactive_days: daysAgo(bond.last_commit_at),
    });
    // In production: transfer $IGNIS to treasury wallet on-chain
    console.log(`[SLASH] repo=${bond.repo} bonder=${bond.bonder} amount=${bond.amount_ignis}`);
  }

  return res.json({
    ok: true,
    slashed,
    message: slashed.length
      ? `${slashed.length} bond(s) slashed — repos were inactive 90+ days`
      : 'no bonds to slash',
  });
});

// ── POST /api/bond/release/:id — release a bond (bonder calls this) ──────────
router.post('/release/:id', (req, res) => {
  const { bonder } = req.body;
  const bond = db.getDb().prepare('SELECT * FROM bonds WHERE id = ?').get(Number(req.params.id));
  if (!bond) return res.status(404).json({ error: 'bond not found' });
  if (bond.bonder !== bonder?.toLowerCase()) return res.status(403).json({ error: 'not your bond' });
  if (bond.status !== 'active') return res.status(400).json({ error: `bond is ${bond.status}` });

  getDb().releaseBond(bond.id);
  return res.json({ ok: true, message: `${bond.amount_ignis} $IGNIS bond released from ${bond.repo}` });
});

module.exports = router;
