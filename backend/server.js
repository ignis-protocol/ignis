// server.js — Ignis API server
require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const { ethers } = require('ethers');
const rateLimit  = require('express-rate-limit');

const tokensRoute    = require('./routes/tokens');
const networkRoute   = require('./routes/network');
const statsRoute     = require('./routes/stats');
const bankrRoute     = require('./routes/bankr');
const bondRoute      = require('./routes/bond');
const tipsRoute      = require('./routes/tips');
const launchKeyRoute = require('./routes/launchkey');
const gitlawbRoute   = require('./routes/gitlawb');
const authRoute      = require('./routes/auth');
const bondWatcher    = require('./workers/bondWatcher');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── PROVIDER ─────────────────────────────────────────────────────────────────
const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const provider = new ethers.providers.JsonRpcProvider(RPC_URL, {
  chainId: 8453,
  name: 'base',
});

// attach provider to app locals so routes can access it
app.locals.provider = provider;

// verify connection on boot
provider.getNetwork()
  .then(n  => console.log(`✓ RPC connected — chain ${n.chainId} (${n.name})`))
  .catch(e => console.warn(`⚠ RPC warning: ${e.message} — some features may be limited`));

// ── MIDDLEWARE ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'OPTIONS'],
}));

app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: false }));

// rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 60,               // 60 req/min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too many requests — slow down' },
});
app.use(limiter);

// request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ── ROUTES ────────────────────────────────────────────────────────────────────
app.get('/', (_req, res) => res.json({
  name:    'Ignis API',
  version: '0.1.0',
  tagline: 'forge tokens from code.',
  network: 'Base Mainnet (8453)',
  endpoints: [
    'GET  /api/tokens             — list all forged tokens',
    'POST /api/tokens             — register a deployed token',
    'GET  /api/tokens/recent      — recent activity',
    'GET  /api/tokens/:id         — token by contract address or symbol',
    'GET  /api/tokens/deployer/:address — tokens by deployer wallet',
    'GET  /api/network            — Base network stats',
    'GET  /api/network/gas        — live gas prices',
    'GET  /api/network/block/:n   — block info',
    'GET  /api/network/tx/:hash   — transaction info',
    'GET  /api/stats              — platform stats',
    'POST /api/bankr/launch       — launch token via bankr.bot (no Twitter)',
    'GET  /api/bankr/job/:jobId   — poll bankr job status',
    'POST /api/bankr/save         — save confirmed launch to registry',
    'POST /api/bankr/wallet       — check bankr wallet info',
    'POST /api/bankr/prompt       — raw bankr.bot prompt',
    '── UTILITIES ──────────────────────────────',
    'GET  /api/launchkey/check/:address — check $IGNIS balance for forge access',
    'GET  /api/launchkey/threshold      — minimum $IGNIS required',
    'POST /api/bond                     — bond $IGNIS to a repo',
    'GET  /api/bond/:repo               — get repo bond status',
    'GET  /api/bond/bonder/:address     — bonds by wallet',
    'GET  /api/bond                     — list all active bonds',
    'POST /api/bond/ping                — reset inactivity timer (gitlawb webhook)',
    'POST /api/bond/slash               — run slash check (cron)',
    'POST /api/tips                     — tip a commit with $IGNIS',
    'GET  /api/tips/contributor/:addr   — tips earned by address',
    'GET  /api/tips/repo/:repo          — tips for a repo',
    'GET  /api/tips/commit/:hash        — tips for a commit',
    'GET  /api/tips/leaderboard         — top contributors by $IGNIS earned',
    'GET  /health                 — health check',
  ],
}));

app.get('/health', async (_req, res) => {
  let rpc_ok = false;
  let block   = null;
  try {
    block  = await provider.getBlockNumber();
    rpc_ok = true;
  } catch (_) {}
  res.json({
    status:   rpc_ok ? 'ok' : 'degraded',
    rpc:      rpc_ok ? 'connected' : 'unreachable',
    block,
    uptime:   Math.floor(process.uptime()),
    ts:       new Date().toISOString(),
  });
});

app.use('/api/tokens',    tokensRoute);
app.use('/api/network',   networkRoute);
app.use('/api/stats',     statsRoute);
app.use('/api/bankr',     bankrRoute);
app.use('/api/bond',      bondRoute);
app.use('/api/tips',      tipsRoute);
app.use('/api/launchkey', launchKeyRoute);
app.use('/api/gitlawb',   gitlawbRoute);
app.use('/api/auth',      authRoute);

// 404
app.use((_req, res) => res.status(404).json({ error: 'route not found' }));

// global error handler
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'internal server error' });
});

// ── START ─────────────────────────────────────────────────────────────────────
const dbModule = require('./db');

dbModule.init().then(() => {
  console.log('✓ Database initialized');
  app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════╗
║  Ignis API  ·  v0.1.0-alpha          ║
║  forge tokens from code.                ║
╠══════════════════════════════════════════╣
║  http://localhost:${PORT}                   ║
║  network: Base Mainnet (8453)           ║
║  rpc: ${RPC_URL.slice(0, 34).padEnd(34)} ║
╚══════════════════════════════════════════╝
    `);
    bondWatcher.start();
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

module.exports = app;
