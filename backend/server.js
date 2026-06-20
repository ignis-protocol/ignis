// IGNIS API - anonymous code contribution protocol.
require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = Number(process.env.PORT || 3001);
const BUILD = 'anonymous-code-protocol';
const VERSION = '0.2.0-alpha';
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_HOURS || 72) * 60 * 60 * 1000;
const STORE_PATH = process.env.STORE_PATH || path.join(__dirname, 'data', 'ignis-store.json');

const relays = [
  { id: 'relay-jkt-01', region: 'Jakarta', role: 'ingress', latency_ms: 14, status: 'online' },
  { id: 'relay-sgp-04', region: 'Singapore', role: 'mixer', latency_ms: 18, status: 'online' },
  { id: 'relay-ams-09', region: 'Amsterdam', role: 'exit', latency_ms: 23, status: 'warming' },
];

const allowedOrigins = String(process.env.CORS_ORIGIN || '*')
  .split(',')
  .map(v => v.trim())
  .filter(Boolean);

const defaultStore = () => ({
  meta: { version: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  sessions: [],
  submissions: [],
  reviews: [],
});

let store = loadStore();

app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Ignis-Build', BUILD);
  next();
});

app.use(cors({
  origin(origin, cb) {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new ApiError(403, 'origin_not_allowed', 'Origin is not allowed by CORS policy.'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
}));
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_PER_MINUTE || 120),
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: { code: 'rate_limited', message: 'Too many requests. Slow down.' } },
}));

app.use((req, _res, next) => {
  req.requestId = crypto.randomUUID();
  console.log(`[${new Date().toISOString()}] ${req.requestId} ${req.method} ${req.path}`);
  next();
});

app.get('/', (req, res) => ok(res, req, {
  name: 'IGNIS API',
  version: VERSION,
  build: BUILD,
  tagline: 'code without a face.',
  protocol: 'anonymous code contribution',
  settlement_layer: 'Solana',
  phases: {
    active: ['backend foundation', 'anonymous session + sealed submission'],
    planned: ['blind review scoring', 'Solana proof receipts', 'IGNIS SPL incentive layer'],
  },
  endpoints: [
    'GET  /health',
    'POST /api/sessions',
    'GET  /api/sessions/:id',
    'GET  /api/relays',
    'POST /api/submissions',
    'GET  /api/submissions',
    'GET  /api/submissions/:id',
    'GET  /api/reviews',
    'GET  /api/signal',
    'GET  /api/solana',
  ],
}));

app.get('/health', (req, res) => ok(res, req, {
  status: 'ok',
  version: VERSION,
  build: BUILD,
  storage: {
    driver: 'json-file',
    path: STORE_PATH,
    writable: canWriteStore(),
  },
  relays_online: relays.filter(r => r.status === 'online').length,
  relays_total: relays.length,
  sessions: store.sessions.length,
  submissions: store.submissions.length,
  reviews: store.reviews.length,
  uptime: Math.floor(process.uptime()),
  ts: new Date().toISOString(),
}));

app.post('/api/sessions', (req, res, next) => {
  try {
    const now = new Date();
    const session = {
      id: newId('ash'),
      public_key: optionalText(req.body.public_key, 120),
      label: optionalText(req.body.label, 80) || 'ephemeral local identity',
      status: 'active',
      created_at: now.toISOString(),
      expires_at: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
    };
    store.sessions.unshift(session);
    trim(store.sessions, 200);
    persistStore();
    return ok(res.status(201), req, { session });
  } catch (err) {
    return next(err);
  }
});

app.get('/api/sessions/:id', (req, res, next) => {
  try {
    const session = findSession(req.params.id);
    if (!session) throw new ApiError(404, 'session_not_found', 'Session does not exist.');
    return ok(res, req, { session: serializeSession(session) });
  } catch (err) {
    return next(err);
  }
});

app.get('/api/relays', (req, res) => ok(res, req, {
  source: 'ignis-alpha',
  relays,
  policy: 'ingress -> mixer -> exit',
  guarantee: 'alpha control-plane simulation, not a production anonymity guarantee yet',
}));

app.post('/api/submissions', (req, res, next) => {
  try {
    const submission = createSubmission(req.body || {});
    store.submissions.unshift(submission);
    const review = createReview(submission);
    store.reviews.unshift(review);
    trim(store.submissions, 500);
    trim(store.reviews, 500);
    persistStore();
    return ok(res.status(201), req, { submission, review });
  } catch (err) {
    return next(err);
  }
});

app.get('/api/submissions', (req, res) => {
  const limit = clampInt(req.query.limit, 1, 100, 25);
  return ok(res, req, {
    submissions: store.submissions.slice(0, limit),
    total: store.submissions.length,
  });
});

app.get('/api/submissions/:id', (req, res, next) => {
  try {
    const submission = store.submissions.find(item => item.id === req.params.id);
    if (!submission) throw new ApiError(404, 'submission_not_found', 'Submission does not exist.');
    const review = store.reviews.find(item => item.submission_id === submission.id) || null;
    return ok(res, req, { submission, review });
  } catch (err) {
    return next(err);
  }
});

app.get('/api/reviews', (req, res) => {
  const queued = store.reviews.filter(item => item.status === 'queued');
  return ok(res, req, {
    mode: 'blind',
    queue_depth: queued.length,
    quorum_required: 3,
    queue: queued.slice(0, clampInt(req.query.limit, 1, 100, 25)),
    visible_to_reviewers: ['diff_hash', 'tests', 'submission summary', 'repo context'],
    hidden_from_reviewers: ['name', 'email', 'wallet', 'country', 'social graph', 'follower count'],
  });
});

app.get('/api/signal', (req, res) => {
  const accepted = store.submissions.filter(item => item.status === 'accepted').length;
  const queued = store.submissions.filter(item => item.status === 'queued').length;
  const sessions = store.sessions.length;
  const baseScore = store.submissions.length ? Math.min(9.8, 6.4 + store.submissions.length * 0.18 + accepted * 0.6) : 0;
  return ok(res, req, {
    identity_model: 'ephemeral local keypair',
    signal_inputs: ['accepted diffs', 'test pass rate', 'blind review score', 'reviewer quorum'],
    totals: {
      sessions,
      submissions: store.submissions.length,
      queued,
      accepted,
      reviews: store.reviews.length,
    },
    portable_score: Number(baseScore.toFixed(1)),
    proof_target: 'Solana',
    incentive_layer: 'future IGNIS SPL rewards',
  });
});

app.get('/api/solana', (req, res) => ok(res, req, {
  network: process.env.SOLANA_CLUSTER || 'devnet',
  wallet_auth: 'Phantom/Solana wallet support planned',
  proof_program: process.env.IGNIS_SIGNAL_PROGRAM || 'not_deployed',
  token_mint: process.env.IGNIS_TOKEN_MINT || 'not_deployed',
  uses: ['contribution receipts', 'reviewer staking', 'relay operator bonds', 'future reward distribution'],
}));

app.use((req, res) => error(res, req, new ApiError(404, 'route_not_found', 'Route not found.')));
app.use((err, req, res, _next) => {
  console.error('[ERROR]', err);
  return error(res, req, err);
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`
IGNIS API / ${VERSION}
code without a face.
http://localhost:${PORT}
build: ${BUILD}
storage: ${STORE_PATH}
`);
  });
}

function createSubmission(body) {
  const sessionId = requiredText(body.session || body.session_id, 'session', 80);
  const session = findSession(sessionId);
  if (!session) throw new ApiError(404, 'session_not_found', 'Create an anonymous session before submitting.');
  if (isExpired(session.expires_at)) throw new ApiError(410, 'session_expired', 'Session has expired. Create a new one.');

  const repo = requiredText(body.repo, 'repo', 140);
  const summary = requiredText(body.summary, 'summary', 700);
  const diffHash = optionalText(body.diff_hash, 96) || hash(`${sessionId}:${repo}:${summary}:${Date.now()}`);
  const metadataReport = stripMetadataPreview(body.metadata || {});

  return {
    id: newId('sealed'),
    session: session.id,
    repo,
    summary,
    diff_hash: diffHash,
    metadata_removed: true,
    metadata_report: metadataReport,
    review_mode: 'blind',
    status: 'queued',
    relay_path: relays.map(r => r.id),
    solana_proof: 'queued_after_acceptance',
    created_at: new Date().toISOString(),
  };
}

function createReview(submission) {
  return {
    id: newId('review'),
    submission_id: submission.id,
    status: 'queued',
    quorum_required: 3,
    reviewers_requested: 3,
    reviewers_responded: 0,
    score: null,
    visible_fields: ['repo', 'summary', 'diff_hash', 'tests'],
    hidden_fields: ['session', 'wallet', 'email', 'name', 'country', 'social graph'],
    created_at: new Date().toISOString(),
  };
}

function stripMetadataPreview(metadata) {
  const keys = ['author', 'email', 'timezone', 'hostname', 'username', 'ip', 'remote_url', 'editor_path'];
  const present = keys.filter(key => Object.prototype.hasOwnProperty.call(metadata, key));
  return {
    removed_fields: present.length ? present : ['author', 'email', 'timezone', 'hostname'],
    retained_fields: ['repo', 'summary', 'diff_hash'],
  };
}

function loadStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) return defaultStore();
    const parsed = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    return {
      ...defaultStore(),
      ...parsed,
      meta: { ...defaultStore().meta, ...(parsed.meta || {}) },
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      submissions: Array.isArray(parsed.submissions) ? parsed.submissions : [],
      reviews: Array.isArray(parsed.reviews) ? parsed.reviews : [],
    };
  } catch (err) {
    console.error('[STORE] failed to load store, starting empty:', err.message);
    return defaultStore();
  }
}

function persistStore() {
  store.meta.updated_at = new Date().toISOString();
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  const tempPath = `${STORE_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(store, null, 2));
  fs.renameSync(tempPath, STORE_PATH);
}

function canWriteStore() {
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.accessSync(path.dirname(STORE_PATH), fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function findSession(id) {
  return store.sessions.find(item => item.id === id);
}

function serializeSession(session) {
  return {
    ...session,
    expired: isExpired(session.expires_at),
  };
}

function requiredText(value, field, max) {
  const text = String(value || '').trim();
  if (!text) throw new ApiError(400, 'validation_error', `${field} is required.`);
  if (text.length > max) throw new ApiError(400, 'validation_error', `${field} must be ${max} characters or less.`);
  return text;
}

function optionalText(value, max) {
  if (value === undefined || value === null) return '';
  return String(value).trim().slice(0, max);
}

function clampInt(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function trim(list, max) {
  if (list.length > max) list.length = max;
}

function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(5).toString('hex')}`;
}

function hash(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function isExpired(iso) {
  return new Date(iso).getTime() <= Date.now();
}

function ok(res, req, data) {
  return res.json({ ok: true, request_id: req.requestId, ...data });
}

function error(res, req, err) {
  const status = err.status || 500;
  const code = err.code || 'internal_error';
  const message = status >= 500 ? 'Internal server error.' : err.message;
  return res.status(status).json({ ok: false, request_id: req.requestId, error: { code, message } });
}

function ApiError(status, code, message) {
  Error.captureStackTrace(this, ApiError);
  this.name = 'ApiError';
  this.status = status;
  this.code = code;
  this.message = message;
}
ApiError.prototype = Object.create(Error.prototype);
ApiError.prototype.constructor = ApiError;

module.exports = app;
