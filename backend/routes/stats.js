// routes/stats.js — platform-level stats
const express = require('express');
const router  = express.Router();
const dbModule = require('../db');
function getDb() { return dbModule.getDB(); }

// GET /api/stats
router.get('/', (req, res) => {
  try {
    const db = getDb();

    const total     = (db.rawGet('SELECT COUNT(*) as n FROM tokens') || {}).n || 0;
    const today     = (db.rawGet("SELECT COUNT(*) as n FROM tokens WHERE date(created_at) = date('now')") || {}).n || 0;
    const week      = (db.rawGet("SELECT COUNT(*) as n FROM tokens WHERE created_at >= datetime('now', '-7 days')") || {}).n || 0;
    const deployers = (db.rawGet('SELECT COUNT(DISTINCT deployer) as n FROM tokens') || {}).n || 0;
    const bonds     = (db.rawGet("SELECT COUNT(*) as n FROM bonds WHERE status = 'active'") || {}).n || 0;
    const tips      = (db.rawGet('SELECT COUNT(*) as n FROM tips') || {}).n || 0;
    const tipVol    = (db.rawGet('SELECT COALESCE(SUM(CAST(amount_ignis AS REAL)),0) as v FROM tips') || {}).v || 0;
    const topTokens = db.rawAll('SELECT symbol, name, contract, created_at FROM tokens ORDER BY created_at DESC LIMIT 5');

    return res.json({
      ok: true,
      stats: {
        tokens_total:       total,
        tokens_today:       today,
        tokens_week:        week,
        unique_deployers:   deployers,
        active_bonds:       bonds,
        total_tips:         tips,
        total_ignis_tipped: parseFloat(tipVol).toFixed(4),
        recent_tokens:      topTokens,
        platform:           'Ignis',
        network:            'Base Mainnet (8453)',
      },
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
