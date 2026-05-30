// routes/stats.js — platform-level stats
const express = require('express');
const router  = express.Router();
const dbModule = require('../db');
function getDb() { return dbModule.getDB(); }

// GET /api/stats
router.get('/', (req, res) => {
  try {
    const raw       = getDb().db;
    const total     = raw.prepare(`SELECT COUNT(*) as n FROM tokens`).get().n;
    const today     = raw.prepare(`SELECT COUNT(*) as n FROM tokens WHERE date(created_at) = date('now')`).get().n;
    const week      = raw.prepare(`SELECT COUNT(*) as n FROM tokens WHERE created_at >= datetime('now', '-7 days')`).get().n;
    const deployers = raw.prepare(`SELECT COUNT(DISTINCT deployer) as n FROM tokens`).get().n;
    const bonds     = raw.prepare(`SELECT COUNT(*) as n FROM bonds WHERE status = 'active'`).get().n;
    const tips      = raw.prepare(`SELECT COUNT(*) as n FROM tips`).get().n;
    const tipVol    = raw.prepare(`SELECT COALESCE(SUM(CAST(amount_ignis AS REAL)),0) as v FROM tips`).get().v;
    const topTokens = raw.prepare(`SELECT symbol, name, contract, created_at FROM tokens ORDER BY created_at DESC LIMIT 5`).all();

    return res.json({
      ok: true,
      stats: {
        tokens_total:     total,
        tokens_today:     today,
        tokens_week:      week,
        unique_deployers: deployers,
        active_bonds:     bonds,
        total_tips:       tips,
        total_forge_tipped: parseFloat(tipVol).toFixed(4),
        recent_tokens:    topTokens,
        platform:         'Ignis',
        network:          'Base Mainnet (8453)',
      },
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
