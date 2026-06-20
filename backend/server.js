// server.js - IGNIS anonymous code protocol API
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;
const BUILD = 'anonymous-code-protocol';

const relays = [
  { id: 'relay-jkt-01', region: 'Jakarta', role: 'ingress', latency_ms: 14, status: 'online' },
  { id: 'relay-sgp-04', region: 'Singapore', role: 'mixer', latency_ms: 18, status: 'online' },
  { id: 'relay-ams-09', region: 'Amsterdam', role: 'exit', latency_ms: 23, status: 'warming' },
];

const submissions = [];

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'OPTIONS'],
}));
app.use(express.json({ limit: '128kb' }));
app.use(express.urlencoded({ extended: false }));

app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too many requests - slow down' },
}));

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

function newId(prefix) {
  return `${prefix}_${Math.random().toString(16).slice(2, 10)}`;
}

function redactSubmission(body = {}) {
  const repo = String(body.repo || 'unlinked/repo').slice(0, 120);
  const summary = String(body.summary || 'sealed anonymous code submission').slice(0, 500);
  const session = String(body.session || newId('ash')).slice(0, 80);
  return {
    id: newId('sealed'),
    session,
    repo,
    summary,
    metadata_removed: true,
    review_mode: 'blind',
    status: 'queued',
    relay_path: relays.map(r => r.id),
    solana_proof: 'queued_after_acceptance',
    created_at: new Date().toISOString(),
  };
}

app.get('/', (_req, res) => res.json({
  name: 'IGNIS API',
  version: '0.1.0-alpha',
  build: BUILD,
  tagline: 'code without a face.',
  protocol: 'anonymous code contribution',
  settlement_layer: 'Solana',
  endpoints: [
    'GET  /health                 - service health',
    'GET  /api/relays             - relay network status',
    'POST /api/submissions        - create sealed anonymous submission',
    'GET  /api/submissions        - recent sealed submissions',
    'GET  /api/reviews            - blind review queue summary',
    'GET  /api/signal             - signal/reputation layer summary',
    'GET  /api/solana             - Solana proof and incentive layer status',
  ],
}));

app.get('/health', (_req, res) => res.json({
  status: 'ok',
  build: BUILD,
  relays_online: relays.filter(r => r.status === 'online').length,
  relays_total: relays.length,
  submissions: submissions.length,
  uptime: Math.floor(process.uptime()),
  ts: new Date().toISOString(),
}));

app.get('/api/relays', (_req, res) => res.json({
  ok: true,
  source: 'ignis-alpha',
  relays,
  policy: 'ingress -> mixer -> exit',
  note: 'Relay metrics are alpha control-plane data, not a production anonymity guarantee yet.',
}));

app.post('/api/submissions', (req, res) => {
  const submission = redactSubmission(req.body);
  submissions.unshift(submission);
  if (submissions.length > 50) submissions.length = 50;
  res.status(201).json({ ok: true, submission });
});

app.get('/api/submissions', (_req, res) => res.json({
  ok: true,
  submissions,
  total: submissions.length,
}));

app.get('/api/reviews', (_req, res) => res.json({
  ok: true,
  mode: 'blind',
  queue_depth: submissions.filter(s => s.status === 'queued').length,
  quorum_required: 3,
  visible_to_reviewers: ['diff', 'tests', 'submission summary', 'repo context'],
  hidden_from_reviewers: ['name', 'email', 'wallet', 'country', 'social graph', 'follower count'],
}));

app.get('/api/signal', (_req, res) => res.json({
  ok: true,
  identity_model: 'ephemeral local keypair',
  signal_inputs: ['accepted diffs', 'test pass rate', 'blind review score', 'reviewer quorum'],
  portable_score: 'planned',
  proof_target: 'Solana',
  incentive_layer: 'future IGNIS SPL rewards',
}));

app.get('/api/solana', (_req, res) => res.json({
  ok: true,
  network: process.env.SOLANA_CLUSTER || 'devnet-planned',
  wallet_auth: 'Phantom/Solana wallet support planned',
  proof_program: process.env.IGNIS_SIGNAL_PROGRAM || 'not_deployed',
  token_mint: process.env.IGNIS_TOKEN_MINT || 'not_deployed',
  uses: ['contribution receipts', 'reviewer staking', 'relay operator bonds', 'future reward distribution'],
}));

app.use((_req, res) => res.status(404).json({ error: 'route not found' }));

app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'internal server error' });
});

app.listen(PORT, () => {
  console.log(`
IGNIS API / v0.1.0-alpha
code without a face.
http://localhost:${PORT}
build: ${BUILD}
settlement layer: Solana
  `);
});

module.exports = app;
