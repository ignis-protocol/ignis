// routes/tips.js — Commit Currency utility
// Tip merged PRs with $IGNIS — on-chain proof of value per contributor
const express = require('express');
const router  = express.Router();
const dbModule = require('../db');
function getDb() { return dbModule.getDB(); }
const { requireAuth } = require('./auth');

const MIN_TIP = process.env.MIN_TIP_IGNIS || '1';

// ── POST /api/tips — tip a commit ────────────────────────────────────────────
// body: { repo, commit_hash, contributor, tipper, amount_ignis, tx_hash?, message? }
router.post('/', requireAuth, (req, res) => {
  const { repo, commit_hash, contributor, tipper, amount_ignis, tx_hash, message } = req.body;

  if (!repo)         return res.status(400).json({ error: 'repo required' });
  if (!commit_hash)  return res.status(400).json({ error: 'commit_hash required' });
  if (!contributor)  return res.status(400).json({ error: 'contributor address required' });
  if (!tipper)       return res.status(400).json({ error: 'tipper address required' });
  if (!amount_ignis) return res.status(400).json({ error: 'amount_ignis required' });

  if (parseFloat(amount_ignis) < parseFloat(MIN_TIP)) {
    return res.status(400).json({ error: `minimum tip is ${MIN_TIP} $IGNIS` });
  }

  if (contributor.toLowerCase() === tipper.toLowerCase()) {
    return res.status(400).json({ error: 'cannot tip your own commit' });
  }

  try {
    const id = getDb().insertTip({
      repo,
      commit_hash,
      contributor: contributor.toLowerCase(),
      tipper:      tipper.toLowerCase(),
      amount_ignis: amount_ignis.toString(),
      tx_hash:     tx_hash || null,
      message:     message || null,
    });

    const tips = getDb().getTipsByCommit(commit_hash);
    const total = tips.reduce((sum, t) => sum + parseFloat(t.amount_ignis), 0);

    return res.status(201).json({
      ok: true,
      tip_id: id,
      commit_hash,
      contributor,
      total_tipped_to_commit: total.toFixed(4),
      message: `${amount_ignis} $IGNIS tipped to ${contributor.slice(0,6)}... for commit ${commit_hash.slice(0,8)}`,
    });
  } catch(e) {
    console.error('[POST /tips]', e.message);
    return res.status(500).json({ error: 'database error' });
  }
});

// ── GET /api/tips/contributor/:address — tips earned by a contributor ─────────
router.get('/contributor/:address', (req, res) => {
  const tips  = getDb().getTipsByContributor(req.params.address);
  const total = tips.reduce((sum, t) => sum + parseFloat(t.amount_ignis), 0);
  return res.json({
    ok: true,
    contributor: req.params.address,
    tips,
    total_earned: total.toFixed(4),
    tip_count: tips.length,
  });
});

// ── GET /api/tips/repo/:repo — tips for a repo ───────────────────────────────
router.get('/repo/:repo(*)', (req, res) => {
  const tips = getDb().getTipsByRepo(req.params.repo);
  const total = tips.reduce((sum, t) => sum + parseFloat(t.amount_ignis), 0);

  // aggregate by contributor
  const byContributor = {};
  for (const t of tips) {
    if (!byContributor[t.contributor]) {
      byContributor[t.contributor] = { address: t.contributor, earned: 0, tip_count: 0 };
    }
    byContributor[t.contributor].earned     += parseFloat(t.amount_ignis);
    byContributor[t.contributor].tip_count  += 1;
  }

  return res.json({
    ok: true,
    repo: req.params.repo,
    tips,
    total_tipped: total.toFixed(4),
    contributors: Object.values(byContributor)
      .sort((a, b) => b.earned - a.earned),
  });
});

// ── GET /api/tips/commit/:hash — tips for a specific commit ──────────────────
router.get('/commit/:hash', (req, res) => {
  const tips  = getDb().getTipsByCommit(req.params.hash);
  const total = tips.reduce((sum, t) => sum + parseFloat(t.amount_ignis), 0);
  return res.json({ ok: true, commit_hash: req.params.hash, tips, total_tipped: total.toFixed(4) });
});

// ── GET /api/tips/leaderboard — top contributors by $IGNIS earned ─────────────
router.get('/leaderboard', (_req, res) => {
  const top = getDb().topContributors();
  return res.json({ ok: true, leaderboard: top });
});

module.exports = router;
