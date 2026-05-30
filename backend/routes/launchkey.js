// routes/launchkey.js — Launch Key utility
// Must hold $IGNIS to forge a token on Ignis
const express    = require('express');
const router     = express.Router();
const { ethers } = require('ethers');
const dbModule   = require('../db');
function getDb() { return dbModule.getDB(); }

// Minimum $IGNIS balance required to forge (set in .env)
const MIN_IGNIS_TO_LAUNCH = process.env.MIN_IGNIS_TO_LAUNCH || '1000';
const IGNIS_CONTRACT      = process.env.IGNIS_CONTRACT || null;

async function getForgeBalance(provider, walletAddress) {
  if (!IGNIS_CONTRACT || !walletAddress) {
    return { balance: '0', formatted: 0, simulated: true };
  }
  try {
    const erc20 = new ethers.Contract(
      IGNIS_CONTRACT,
      ['function balanceOf(address) view returns (uint256)',
       'function decimals() view returns (uint8)',
       'function symbol() view returns (string)'],
      provider
    );
    const [bal, dec] = await Promise.all([erc20.balanceOf(walletAddress), erc20.decimals()]);
    const formatted = parseFloat(ethers.utils.formatUnits(bal, dec));
    return { balance: bal.toString(), formatted, simulated: false };
  } catch(e) {
    return { balance: '0', formatted: 0, simulated: true, error: e.message };
  }
}

// ── GET /api/launchkey/check/:address ────────────────────────────────────────
router.get('/check/:address', async (req, res) => {
  const { address } = req.params;

  if (!ethers.utils.isAddress(address)) {
    return res.status(400).json({ error: 'invalid wallet address' });
  }

  const provider = req.app.locals.provider;
  const { balance, formatted, simulated, error } = await getForgeBalance(provider, address);
  const eligible = simulated ? true : formatted >= parseFloat(MIN_IGNIS_TO_LAUNCH);

  // Cache in DB
  getDb().upsertLaunchKey({ address: address.toLowerCase(), ignis_bal: formatted.toString(), eligible: eligible ? 1 : 0 });

  return res.json({
    ok: true,
    address,
    ignis_balance: formatted,
    min_required:  parseFloat(MIN_IGNIS_TO_LAUNCH),
    eligible,
    simulated,
    message: eligible
      ? `✓ eligible to forge — holding ${formatted} $IGNIS`
      : `✗ need ${MIN_IGNIS_TO_LAUNCH} $IGNIS to forge — you have ${formatted}`,
    ...(error ? { rpc_note: error } : {}),
  });
});

// ── GET /api/launchkey/threshold ─────────────────────────────────────────────
router.get('/threshold', (_req, res) => {
  return res.json({
    ok: true,
    min_forge_to_launch: parseFloat(MIN_IGNIS_TO_LAUNCH),
    forge_contract:      IGNIS_CONTRACT || 'not yet deployed',
    description:         'Hold this much $IGNIS to unlock token forging on Ignis',
  });
});

module.exports = router;
