require('dotenv').config();

const crypto = require('crypto');
const path = require('path');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const nacl = require('tweetnacl');
const bs58Module = require('bs58');
const { PublicKey } = require('@solana/web3.js');
const { IgnisStorage } = require('./lib/storage');
const { canonicalHash, createTokenService, sha256 } = require('./lib/security');
const { SolanaAnchor } = require('./lib/solana-anchor');
const { sanitizeDiff } = require('./lib/sanitizer');
const { BundleVault } = require('./lib/bundle-vault');
const { enforceSubmissionQuota, inspectDiff } = require('./lib/abuse-controls');
const { RelayTransport } = require('./lib/relay-transport');

const bs58 = bs58Module.default || bs58Module;
const app = express();
const PORT = Number(process.env.PORT || 3001);
const BUILD = 'anonymous-code-protocol';
const VERSION = '0.6.0-alpha';
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_HOURS || 72) * 60 * 60 * 1000;
const REVIEW_QUORUM = oddQuorum(process.env.REVIEW_QUORUM);
const REVIEWER_KEYS = parseReviewerKeys(
  process.env.REVIEWER_API_KEYS || '',
  process.env.REVIEWER_API_KEYS_PREVIOUS || '',
);
const WALLET_CHALLENGE_TTL_MS = Number(process.env.WALLET_CHALLENGE_TTL_MINUTES || 5) * 60 * 1000;
const AUTH_TOKEN_TTL_SECONDS = Number(process.env.AUTH_TOKEN_TTL_MINUTES || 30) * 60;
const REVIEWER_TOKEN_TTL_SECONDS = Number(process.env.REVIEWER_TOKEN_TTL_MINUTES || 30) * 60;
const STORE_PATH = process.env.STORE_PATH || path.join(__dirname, 'data', 'ignis-store.json');
const storage = new IgnisStorage({ filePath: STORE_PATH, databaseUrl: process.env.DATABASE_URL });
const tokens = createTokenService(process.env.AUTH_SECRET);
const vault = new BundleVault({ fallbackSecret: process.env.AUTH_SECRET });
const relayTransport = new RelayTransport({ authSecret: process.env.AUTH_SECRET });
const BUNDLE_RETENTION_DAYS = Number(process.env.BUNDLE_RETENTION_DAYS || 30);
const solana = new SolanaAnchor({
  cluster: process.env.SOLANA_CLUSTER || 'devnet',
  rpcUrl: process.env.SOLANA_RPC_URL,
  secretKey: process.env.SOLANA_ANCHOR_SECRET_KEY,
});
const defaultCorsOrigins = [
  'https://ignis-protocol.com',
  'https://www.ignis-protocol.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];
const allowedOrigins = String(process.env.CORS_ORIGIN || defaultCorsOrigins.join(',')).split(',').map(v => v.trim()).filter(Boolean);
const TRUST_PROXY_HOPS = Number(process.env.TRUST_PROXY_HOPS || 1);

app.disable('x-powered-by');
app.set('trust proxy', TRUST_PROXY_HOPS);
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-Ignis-Build', BUILD);
  next();
});
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new ApiError(403, 'origin_not_allowed', 'Origin is not allowed by CORS policy.'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Reviewer-Key'],
}));
app.use(express.json({ limit: process.env.REQUEST_BODY_LIMIT || '384kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_PER_MINUTE || 120),
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: { code: 'rate_limited', message: 'Too many requests. Slow down.' } },
}));
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_PER_10_MINUTES || 30),
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: { code: 'auth_rate_limited', message: 'Too many authentication attempts.' } },
});
app.use(async (req, _res, next) => {
  try {
    await storage.ready;
    await migrateSensitiveState();
    if (pruneRetention()) await storage.persist();
    req.requestId = crypto.randomUUID();
    console.log(`[${new Date().toISOString()}] ${req.requestId} ${req.method} ${req.path}`);
    next();
  } catch (error) {
    next(error);
  }
});

app.get('/', (req, res) => ok(res, req, {
  name: 'IGNIS API',
  version: VERSION,
  build: BUILD,
  tagline: 'code without a face.',
  protocol: 'anonymous code contribution',
  phases: {
    active: [
      'anonymous sessions + sealed submissions',
      'diff intake + metadata sanitizer',
      'encrypted sealed-bundle retention',
      'signed relay transport receipts',
      'abuse scanning + submission quotas',
      'tamper-evident audit trail',
      'blind review + quorum settlement',
      'wallet signature authentication',
      'verifiable proof receipts',
      'Solana devnet anchor queue',
    ],
    excluded: ['IGNIS coin', 'staking', 'rewards', 'mainnet'],
  },
  endpoints: [
    'POST /api/reviewer/session',
    'GET  /api/reviewer/me',
    'POST /api/wallet/challenge',
    'POST /api/wallet/verify',
    'POST /api/sessions',
    'POST /api/sanitize',
    'POST /api/submissions',
    'GET  /api/submissions/:id/status',
    'GET  /api/reviews',
    'POST /api/reviews/:id/votes',
    'GET  /api/proofs/:id',
    'POST /api/proofs/verify',
    'POST /api/proofs/:id/anchor',
    'GET  /api/signal',
    'GET  /api/solana',
    'GET  /api/security',
    'GET  /api/readiness',
  ],
}));

app.get('/health', (req, res) => {
  const state = storage.state;
  return ok(res, req, {
    status: 'ok',
    version: VERSION,
    build: BUILD,
    storage: { driver: storage.driver, writable: storage.isWritable() },
    relays_online: relayTransport.status().nodes.length,
    relays_total: relayTransport.status().nodes.length,
    relay_production_ready: relayTransport.productionReady(),
    sealed_bundle_encryption: vault.status().algorithm,
    sessions: state.sessions.length,
    submissions: state.submissions.length,
    reviews: state.reviews.length,
    proofs: state.proofs.length,
    anchors_pending: state.anchor_jobs.filter(item => item.status === 'pending').length,
    review_quorum: REVIEW_QUORUM,
    reviewers_configured: REVIEWER_KEYS.size,
    reviewer_keys_in_grace: [...REVIEWER_KEYS.values()].filter(item => item.status === 'grace').length,
    solana_anchor_configured: solana.status().configured,
    audit_chain_valid: verifyAuditChain(),
    uptime: Math.floor(process.uptime()),
    ts: new Date().toISOString(),
  });
});

app.get('/api/readiness', (req, res) => {
  const report = readinessReport();
  return ok(res.status(report.ready ? 200 : 503), req, report);
});

app.post('/api/reviewer/session', authLimiter, asyncHandler(async (req, res) => {
  const reviewer = authenticateReviewerKey(req.body.key || req.get('X-Reviewer-Key'));
  const token = tokens.issue({
    type: 'reviewer',
    sub: reviewer.id,
    label: reviewer.label,
    key_id: reviewer.key_id,
  }, REVIEWER_TOKEN_TTL_SECONDS);
  audit('reviewer_session_created', { reviewer_id: reviewer.id, key_id: reviewer.key_id, key_status: reviewer.status });
  await storage.persist();
  return ok(res.status(201), req, {
    token,
    reviewer: { id: reviewer.id, label: reviewer.label, key_id: reviewer.key_id, key_status: reviewer.status },
    expires_in: REVIEWER_TOKEN_TTL_SECONDS,
  });
}));

app.get('/api/reviewer/me', requireReviewer, (req, res) => ok(res, req, {
  reviewer: {
    id: req.reviewer.id,
    label: req.reviewer.label,
    key_id: req.reviewer.key_id || null,
    key_status: req.reviewer.status || 'session',
  },
  queue_depth: storage.state.reviews.filter(item => item.status === 'queued').length,
}));

app.post('/api/wallet/challenge', authLimiter, asyncHandler(async (req, res) => {
  const wallet = normalizeWallet(req.body.wallet);
  const sessionId = optionalText(req.body.session_id, 80);
  if (sessionId && !findSession(sessionId)) throw new ApiError(404, 'session_not_found', 'Session does not exist.');
  const now = new Date();
  const challenge = {
    id: newId('challenge'),
    wallet_hash: sha256(wallet),
    wallet,
    session_id: sessionId || null,
    nonce: crypto.randomBytes(18).toString('base64url'),
    domain: optionalText(req.body.domain, 120) || 'ignis-protocol.com',
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + WALLET_CHALLENGE_TTL_MS).toISOString(),
    used_at: null,
  };
  challenge.message = walletMessage(challenge);
  storage.state.wallet_challenges.unshift(challenge);
  pruneTransient();
  await storage.persist();
  return ok(res.status(201), req, {
    challenge: {
      id: challenge.id,
      wallet,
      message: challenge.message,
      expires_at: challenge.expires_at,
    },
  });
}));

app.post('/api/wallet/verify', authLimiter, asyncHandler(async (req, res) => {
  const challenge = storage.state.wallet_challenges.find(item => item.id === req.body.challenge_id);
  if (!challenge) throw new ApiError(404, 'challenge_not_found', 'Wallet challenge does not exist.');
  if (challenge.used_at) throw new ApiError(409, 'challenge_used', 'Wallet challenge has already been used.');
  if (isExpired(challenge.expires_at)) throw new ApiError(410, 'challenge_expired', 'Wallet challenge has expired.');
  const signature = decodeSignature(requiredText(req.body.signature, 'signature', 200));
  const publicKey = new PublicKey(challenge.wallet).toBytes();
  const message = new TextEncoder().encode(challenge.message);
  if (!nacl.sign.detached.verify(message, signature, publicKey)) {
    throw new ApiError(401, 'signature_invalid', 'Wallet signature is invalid.');
  }
  challenge.used_at = new Date().toISOString();
  const verifiedWallet = challenge.wallet;
  const walletCommitment = sha256(`ignis-wallet:${verifiedWallet}:${challenge.nonce}`);
  if (challenge.session_id) linkWallet(challenge.session_id, walletCommitment);
  const token = tokens.issue({
    type: 'wallet',
    sub: walletCommitment,
    session_id: challenge.session_id,
  }, AUTH_TOKEN_TTL_SECONDS);
  audit('wallet_verified', { wallet_commitment: walletCommitment, session_id: challenge.session_id });
  challenge.wallet = null;
  challenge.message = null;
  challenge.nonce = null;
  await storage.persist();
  return ok(res, req, {
    token,
    wallet: verifiedWallet,
    wallet_commitment: walletCommitment,
    session_id: challenge.session_id,
    expires_in: AUTH_TOKEN_TTL_SECONDS,
  });
}));

app.get('/api/wallet/me', requireWallet, (req, res) => ok(res, req, {
  wallet_commitment: req.wallet.sub,
  session_id: req.wallet.session_id || null,
  expires_at: new Date(req.wallet.exp * 1000).toISOString(),
}));

app.post('/api/sessions', asyncHandler(async (req, res) => {
  const now = new Date();
  const session = {
    id: newId('ash'),
    public_key: optionalText(req.body.public_key, 120),
    label: optionalText(req.body.label, 80) || 'ephemeral local identity',
    status: 'active',
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
  };
  storage.state.sessions.unshift(session);
  trim(storage.state.sessions, 500);
  await storage.persist();
  return ok(res.status(201), req, { session });
}));

app.get('/api/sessions/:id', (req, res, next) => {
  try {
    const session = findSession(req.params.id);
    if (!session) throw new ApiError(404, 'session_not_found', 'Session does not exist.');
    return ok(res, req, { session: { ...session, expired: isExpired(session.expires_at) } });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/relays', (req, res) => ok(res, req, {
  source: 'ignis-protocol',
  relays: relayTransport.status().nodes,
  policy: 'ingress -> mixer -> exit',
  production_ready: relayTransport.productionReady(),
  guarantee: relayTransport.status().guarantee,
}));

app.get('/api/security', (req, res) => ok(res, req, {
  sealed_bundles: {
    encryption: vault.status().algorithm,
    active_key_id: vault.status().active_key_id,
    retention_days: BUNDLE_RETENTION_DAYS,
  },
  relay: relayTransport.status(),
  abuse_controls: {
    secret_scanning: true,
    malware_heuristics: true,
    submission_quotas: true,
  },
  audit: {
    tamper_evident: true,
    chain_valid: verifyAuditChain(),
    events: storage.state.audit_events.length,
  },
  assurance: 'Security controls are active. An independent audit is still required before anonymity guarantees.',
}));

app.post('/api/sanitize', asyncHandler(async (req, res) => {
  const result = sanitizeDiff(req.body.diff || req.body.diff_text || req.body.patch || '', { previewBytes: 8000 });
  return ok(res, req, {
    sanitized: {
      original_hash: result.original_hash,
      sanitized_hash: result.sanitized_hash,
      sanitized_diff: result.sanitized_diff,
      report: result.report,
      preview: result.preview,
    },
  });
}));

app.post('/api/submissions', asyncHandler(async (req, res) => {
  const submission = await createSubmission(req.body || {});
  storage.state.submissions.unshift(submission);
  const review = createReview(submission);
  storage.state.reviews.unshift(review);
  trim(storage.state.submissions, 1000);
  trim(storage.state.reviews, 1000);
  audit('submission_created', {
    submission_id: submission.id,
    review_id: review.id,
    route_hash: submission.relay.route_hash,
    bundle_hash: submission.sanitized_hash,
  });
  await storage.persist();
  return ok(res.status(201), req, {
    submission: serializeSubmission(submission, { includeSession: true }),
    review: serializeReview(review),
  });
}));

app.get('/api/submissions', requireReviewer, (req, res) => ok(res, req, {
  submissions: storage.state.submissions
    .slice(0, clampInt(req.query.limit, 1, 100, 25))
    .map(item => serializeSubmission(item)),
  total: storage.state.submissions.length,
}));

app.get('/api/submissions/:id', (req, res, next) => {
  try {
    const submission = findSubmission(req.params.id);
    if (!submission) throw new ApiError(404, 'submission_not_found', 'Submission does not exist.');
    const review = storage.state.reviews.find(item => item.submission_id === submission.id) || null;
    const proof = storage.state.proofs.find(item => item.submission_id === submission.id) || null;
    return ok(res, req, {
      submission: serializeSubmission(submission),
      review: review ? serializeReview(review) : null,
      proof: proof ? serializeProof(proof) : null,
    });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/submissions/:id/status', (req, res, next) => {
  try {
    const submission = findSubmission(req.params.id);
    if (!submission) throw new ApiError(404, 'submission_not_found', 'Submission does not exist.');
    const review = storage.state.reviews.find(item => item.submission_id === submission.id) || null;
    const proof = storage.state.proofs.find(item => item.submission_id === submission.id) || null;
    return ok(res, req, {
      submission: serializeSubmission(submission),
      review: review ? serializeReview(review) : null,
      proof: proof ? { id: proof.id, anchor: proof.anchor, issued_at: proof.issued_at } : null,
    });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/reviews', requireReviewer, (req, res) => {
  const status = optionalText(req.query.status, 20) || 'queued';
  const reviews = storage.state.reviews.filter(item => status === 'all' || item.status === status);
  return ok(res, req, {
    mode: 'blind',
    queue_depth: storage.state.reviews.filter(item => item.status === 'queued').length,
    quorum_required: REVIEW_QUORUM,
    queue: reviews.slice(0, clampInt(req.query.limit, 1, 100, 25))
      .map(review => serializeReview(review, { includeBundle: true })),
    privacy: {
      visible: ['diff_hash', 'tests', 'submission summary', 'repo context'],
      hidden: ['session', 'wallet', 'email', 'name', 'country', 'social graph'],
    },
  });
});

app.get('/api/reviews/:id', requireReviewer, (req, res, next) => {
  try {
    const review = findReview(req.params.id);
    if (!review) throw new ApiError(404, 'review_not_found', 'Review does not exist.');
    return ok(res, req, { review: serializeReview(review, { includeBundle: true }) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/reviews/:id/votes', requireReviewer, asyncHandler(async (req, res) => {
  const review = findReview(req.params.id);
  if (!review) throw new ApiError(404, 'review_not_found', 'Review does not exist.');
  if (review.status !== 'queued') throw new ApiError(409, 'review_settled', 'Review is already settled.');
  if (review.votes.some(vote => vote.reviewer_id === req.reviewer.id)) {
    throw new ApiError(409, 'duplicate_vote', 'This reviewer has already voted on the review.');
  }
  const vote = {
    id: newId('vote'),
    reviewer_id: req.reviewer.id,
    decision: requiredEnum(req.body.decision, 'decision', ['accept', 'reject']),
    score: requiredInt(req.body.score, 'score', 1, 10),
    note: optionalText(req.body.note, 500),
    created_at: new Date().toISOString(),
  };
  review.votes.push(vote);
  settleReview(review);
  audit('review_vote_cast', { review_id: review.id, reviewer_id: req.reviewer.id });
  await storage.persist();
  if (review.status === 'accepted') void processAnchorQueue();
  return ok(res.status(201), req, {
    vote: { decision: vote.decision, score: vote.score, note: vote.note, created_at: vote.created_at },
    review: serializeReview(review, { includeBundle: true }),
  });
}));

app.get('/api/audit', requireReviewer, (req, res) => ok(res, req, {
  valid: verifyAuditChain(),
  events: storage.state.audit_events
    .slice(0, clampInt(req.query.limit, 1, 250, 50))
    .map(({ data, ...event }) => ({ ...event, data: sanitizeAuditData(data) })),
}));

app.get('/api/proofs', (req, res) => ok(res, req, {
  proofs: storage.state.proofs
    .slice(0, clampInt(req.query.limit, 1, 100, 25))
    .map(serializeProof),
  total: storage.state.proofs.length,
}));

app.get('/api/proofs/:id', (req, res, next) => {
  try {
    const proof = findProof(req.params.id);
    if (!proof) throw new ApiError(404, 'proof_not_found', 'Proof receipt does not exist.');
    return ok(res, req, { proof: serializeProof(proof), valid: verifyProofIntegrity(proof) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/proofs/verify', (req, res, next) => {
  try {
    const proof = findProof(req.body.proof_id);
    if (!proof) throw new ApiError(404, 'proof_not_found', 'Proof receipt does not exist.');
    const suppliedHash = optionalText(req.body.proof_hash, 100);
    const integrityValid = verifyProofIntegrity(proof);
    return ok(res, req, {
      valid: integrityValid && (!suppliedHash || suppliedHash === proof.proof_hash),
      proof: serializeProof(proof),
      checks: {
        receipt_integrity: integrityValid,
        supplied_hash: suppliedHash ? suppliedHash === proof.proof_hash : null,
        solana_anchor: proof.anchor.status,
      },
    });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/proofs/:id/anchor', requireReviewer, asyncHandler(async (req, res) => {
  const proof = findProof(req.params.id);
  if (!proof) throw new ApiError(404, 'proof_not_found', 'Proof receipt does not exist.');
  queueAnchor(proof, true);
  await storage.persist();
  await processAnchorQueue();
  return ok(res, req, { proof: serializeProof(proof), solana: solana.status() });
}));

app.get('/api/signal', (req, res) => {
  const state = storage.state;
  const accepted = state.submissions.filter(item => item.status === 'accepted').length;
  const rejected = state.submissions.filter(item => item.status === 'rejected').length;
  const queued = state.submissions.filter(item => item.status === 'queued').length;
  const settled = state.reviews.filter(item => item.status !== 'queued');
  const acceptedScores = settled.filter(item => item.status === 'accepted').map(item => item.score);
  const portableScore = acceptedScores.length
    ? acceptedScores.reduce((sum, value) => sum + value, 0) / acceptedScores.length
    : 0;
  return ok(res, req, {
    identity_model: 'ephemeral session with optional private wallet commitment',
    signal_inputs: ['accepted diffs', 'blind review score', 'reviewer quorum', 'proof receipt'],
    totals: {
      sessions: state.sessions.length,
      submissions: state.submissions.length,
      queued,
      accepted,
      rejected,
      reviews: state.reviews.length,
      settled_reviews: settled.length,
      reviewer_votes: state.reviews.reduce((sum, item) => sum + item.votes.length, 0),
      proofs: state.proofs.length,
      anchors_confirmed: state.proofs.filter(item => item.anchor.status === 'confirmed').length,
    },
    portable_score: Number(portableScore.toFixed(1)),
    confidence: signalConfidence(accepted, settled.length),
    proof_target: 'Solana devnet',
    incentive_layer: 'none in current scope',
  });
});

app.get('/api/solana', (req, res) => {
  const status = solana.status();
  return ok(res, req, {
    ...status,
    wallet_auth: 'live via signMessage challenge verification',
    proof_receipts: 'live',
    anchor_queue: {
      pending: storage.state.anchor_jobs.filter(item => item.status === 'pending').length,
      failed: storage.state.anchor_jobs.filter(item => item.status === 'failed').length,
      confirmed: storage.state.proofs.filter(item => item.anchor.status === 'confirmed').length,
    },
    token_mint: 'none in current scope',
  });
});

app.use((req, res) => error(res, req, new ApiError(404, 'route_not_found', 'Route not found.')));
app.use((err, req, res, _next) => {
  if (!err.status || err.status >= 500) console.error('[ERROR]', err);
  return error(res, req, err);
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`IGNIS API / ${VERSION}\nhttp://localhost:${PORT}\nstorage: ${storage.driver}`);
    setInterval(() => void processAnchorQueue(), Number(process.env.ANCHOR_POLL_MS || 60000)).unref();
  });
}

async function createSubmission(body) {
  const sessionId = requiredText(body.session || body.session_id, 'session', 80);
  const session = findSession(sessionId);
  if (!session) throw new ApiError(404, 'session_not_found', 'Create an anonymous session before submitting.');
  if (isExpired(session.expires_at)) throw new ApiError(410, 'session_expired', 'Session has expired.');
  const quota = enforceSubmissionQuota(storage.state.submissions, session.id);
  if (!quota.allowed) {
    audit('submission_quota_blocked', { session_hash: sha256(session.id), quota });
    throw new ApiError(429, 'submission_quota_exceeded', 'Submission quota exceeded for this ephemeral session.');
  }
  const repo = requiredText(body.repo, 'repo', 140);
  const summary = requiredText(body.summary, 'summary', 700);
  const sanitized = sanitizeDiff(body.diff || body.diff_text || body.patch || '');
  const abuse = inspectDiff(sanitized.sanitized_diff);
  if (abuse.blocked) {
    audit('submission_abuse_blocked', {
      session_hash: sha256(session.id),
      sanitized_hash: sanitized.sanitized_hash,
      findings: abuse.findings.map(({ type, severity }) => ({ type, severity })),
    });
    throw new ApiError(422, 'unsafe_diff_rejected', 'The diff was rejected by protocol abuse controls.');
  }
  if (storage.state.submissions.some(item => item.sanitized_hash === sanitized.sanitized_hash)) {
    throw new ApiError(409, 'duplicate_submission', 'This sanitized diff has already been submitted.');
  }
  const id = newId('sealed');
  const encryptedBundle = vault.encrypt({
    sanitized_diff: sanitized.sanitized_diff,
    metadata_report: sanitized.report,
  }, bundleContext(id, sanitized.sanitized_hash));
  const relay = await relayTransport.route({
    submission_id: id,
    bundle_hash: sanitized.sanitized_hash,
    sealed_envelope: encryptedBundle,
  });
  return {
    id,
    session: session.id,
    repo,
    summary,
    diff_hash: sanitized.sanitized_hash,
    original_hash: sanitized.original_hash,
    sanitized_hash: sanitized.sanitized_hash,
    encrypted_bundle: encryptedBundle,
    bundle_key_id: encryptedBundle.key_id,
    metadata_removed: true,
    metadata_report_summary: summarizeMetadataReport(sanitized.report),
    abuse_report: abuse,
    review_mode: 'blind',
    status: 'queued',
    relay,
    relay_path: relay.path,
    proof_status: 'awaiting_acceptance',
    created_at: new Date().toISOString(),
  };
}

function createReview(submission) {
  return {
    id: newId('review'),
    submission_id: submission.id,
    status: 'queued',
    quorum_required: REVIEW_QUORUM,
    reviewers_requested: REVIEW_QUORUM,
    reviewers_responded: 0,
    score: null,
    decision: null,
    votes: [],
    created_at: new Date().toISOString(),
    settled_at: null,
  };
}

function settleReview(review) {
  review.reviewers_responded = review.votes.length;
  if (review.votes.length < review.quorum_required) return;
  review.score = Number((review.votes.reduce((sum, vote) => sum + vote.score, 0) / review.votes.length).toFixed(1));
  const accepts = review.votes.filter(vote => vote.decision === 'accept').length;
  review.decision = accepts > review.votes.length / 2 ? 'accepted' : 'rejected';
  review.status = review.decision;
  review.settled_at = new Date().toISOString();
  const submission = findSubmission(review.submission_id);
  submission.status = review.decision;
  submission.review_score = review.score;
  submission.review_id = review.id;
  submission.settled_at = review.settled_at;
  if (review.status === 'accepted') {
    const proof = createProof(submission, review);
    storage.state.proofs.unshift(proof);
    submission.proof_status = 'issued';
    submission.proof_id = proof.id;
    queueAnchor(proof);
  } else {
    submission.proof_status = 'not_eligible';
  }
  submission.retention_expires_at = new Date(Date.now() + BUNDLE_RETENTION_DAYS * 86400000).toISOString();
}

function createProof(submission, review) {
  const walletLink = storage.state.wallet_links.find(item => item.session_id === submission.session);
  const payload = {
    protocol: 'IGNIS',
    version: 1,
    submission_id: submission.id,
    diff_hash: submission.diff_hash,
    review_id: review.id,
    decision: review.decision,
    score: review.score,
    quorum: review.votes.length,
    settled_at: review.settled_at,
    owner_commitment: walletLink?.wallet_commitment || null,
  };
  return {
    id: newId('proof'),
    ...payload,
    proof_hash: canonicalHash(payload),
    issued_at: new Date().toISOString(),
    anchor: { status: 'pending', signature: null, explorer_url: null, anchored_at: null, error: null },
  };
}

function verifyProofIntegrity(proof) {
  const payload = {
    protocol: proof.protocol,
    version: proof.version,
    submission_id: proof.submission_id,
    diff_hash: proof.diff_hash,
    review_id: proof.review_id,
    decision: proof.decision,
    score: proof.score,
    quorum: proof.quorum,
    settled_at: proof.settled_at,
    owner_commitment: proof.owner_commitment,
  };
  return canonicalHash(payload) === proof.proof_hash;
}

function queueAnchor(proof, force = false) {
  let job = storage.state.anchor_jobs.find(item => item.proof_id === proof.id);
  if (job && !force) return job;
  if (!job) {
    job = { id: newId('anchor'), proof_id: proof.id, attempts: 0, status: 'pending', next_attempt_at: new Date().toISOString() };
    storage.state.anchor_jobs.unshift(job);
  } else {
    job.status = 'pending';
    job.next_attempt_at = new Date().toISOString();
  }
  proof.anchor.status = solana.status().configured ? 'queued' : 'awaiting_signer';
  return job;
}

let anchorWorkerRunning = false;
async function processAnchorQueue() {
  if (anchorWorkerRunning || !solana.status().configured) return;
  anchorWorkerRunning = true;
  try {
    const jobs = storage.state.anchor_jobs.filter(item =>
      item.status === 'pending' && new Date(item.next_attempt_at).getTime() <= Date.now());
    for (const job of jobs.slice(0, 5)) {
      const proof = findProof(job.proof_id);
      if (!proof || proof.anchor.status === 'confirmed') {
        job.status = 'complete';
        continue;
      }
      job.attempts += 1;
      proof.anchor.status = 'broadcasting';
      try {
        Object.assign(proof.anchor, await solana.anchor(proof), { status: 'confirmed', error: null });
        job.status = 'complete';
        audit('proof_anchored', { proof_id: proof.id, signature: proof.anchor.signature });
      } catch (error) {
        proof.anchor.status = 'retrying';
        proof.anchor.error = String(error.message).slice(0, 300);
        job.status = job.attempts >= 5 ? 'failed' : 'pending';
        job.next_attempt_at = new Date(Date.now() + Math.min(3600000, 15000 * (2 ** job.attempts))).toISOString();
      }
      await storage.persist();
    }
  } finally {
    anchorWorkerRunning = false;
  }
}

function serializeSubmission(submission, options = {}) {
  const result = { ...submission };
  delete result.session;
  delete result.encrypted_bundle;
  delete result.sanitized_diff;
  delete result.metadata_report;
  result.metadata_report = submission.metadata_report_summary || null;
  result.bundle_encrypted = Boolean(submission.encrypted_bundle);
  if (options.includeSession) result.session = submission.session;
  return result;
}

function serializeReview(review, options = {}) {
  const submission = findSubmission(review.submission_id);
  const settled = review.status !== 'queued';
  const decisions = review.votes.reduce((result, vote) => {
    result[vote.decision] += 1;
    return result;
  }, { accept: 0, reject: 0 });
  const result = {
    id: review.id,
    submission_id: review.submission_id,
    status: review.status,
    decision: review.decision,
    quorum_required: review.quorum_required,
    reviewers_responded: review.votes.length,
    votes_remaining: Math.max(0, review.quorum_required - review.votes.length),
    decisions: settled ? decisions : null,
    score: settled ? review.score : null,
    created_at: review.created_at,
    settled_at: review.settled_at,
  };
  if (settled) result.feedback = review.votes.map(({ decision, score, note, created_at }) => ({ decision, score, note, created_at }));
  if (options.includeBundle && submission) {
    const bundle = openSubmissionBundle(submission);
    result.bundle = {
      repo: submission.repo,
      summary: submission.summary,
      diff_hash: submission.diff_hash,
      sanitized_hash: submission.sanitized_hash,
      sanitized_diff: bundle.sanitized_diff,
      metadata_report: bundle.metadata_report,
      metadata_removed: submission.metadata_removed,
      relay_path: submission.relay_path,
      relay_receipts: submission.relay?.receipts || [],
      route_hash: submission.relay?.route_hash || null,
      abuse_report: submission.abuse_report,
      retention_expires_at: submission.retention_expires_at || null,
    };
  }
  return result;
}

function serializeProof(proof) {
  return {
    id: proof.id,
    protocol: proof.protocol,
    version: proof.version,
    submission_id: proof.submission_id,
    diff_hash: proof.diff_hash,
    review_id: proof.review_id,
    decision: proof.decision,
    score: proof.score,
    quorum: proof.quorum,
    proof_hash: proof.proof_hash,
    owner_commitment: proof.owner_commitment,
    issued_at: proof.issued_at,
    settled_at: proof.settled_at,
    anchor: { ...proof.anchor },
  };
}

function requireReviewer(req, _res, next) {
  try {
    const bearer = bearerToken(req);
    const payload = bearer ? tokens.verify(bearer, 'reviewer') : null;
    if (payload) {
      req.reviewer = { id: payload.sub, label: payload.label, key_id: payload.key_id, status: 'session' };
      return next();
    }
    req.reviewer = authenticateReviewerKey(req.get('X-Reviewer-Key'));
    return next();
  } catch (error) {
    return next(error);
  }
}

function requireWallet(req, _res, next) {
  const payload = tokens.verify(bearerToken(req), 'wallet');
  if (!payload) return next(new ApiError(401, 'wallet_auth_required', 'Valid wallet bearer token is required.'));
  req.wallet = payload;
  return next();
}

function authenticateReviewerKey(value) {
  if (!REVIEWER_KEYS.size) throw new ApiError(503, 'reviewers_not_configured', 'Reviewer access is not configured.');
  const key = String(value || '').trim();
  if (!key) throw new ApiError(401, 'reviewer_key_required', 'Reviewer key is required.');
  const reviewer = REVIEWER_KEYS.get(sha256(key));
  if (!reviewer) throw new ApiError(403, 'reviewer_key_invalid', 'Reviewer key is invalid.');
  return reviewer;
}

function walletMessage(challenge) {
  return [
    'IGNIS wallet authentication',
    `Domain: ${challenge.domain}`,
    `Wallet: ${challenge.wallet}`,
    `Nonce: ${challenge.nonce}`,
    `Issued At: ${challenge.created_at}`,
    `Expiration Time: ${challenge.expires_at}`,
    'Purpose: Link a private wallet commitment to an ephemeral IGNIS session.',
  ].join('\n');
}

function normalizeWallet(value) {
  try {
    return new PublicKey(requiredText(value, 'wallet', 80)).toBase58();
  } catch {
    throw new ApiError(400, 'wallet_invalid', 'Wallet must be a valid Solana public key.');
  }
}

function decodeSignature(value) {
  try {
    const decoded = /^[A-Za-z0-9+/]+={0,2}$/.test(value) && value.includes('=')
      ? Buffer.from(value, 'base64')
      : bs58.decode(value);
    if (decoded.length !== nacl.sign.signatureLength) throw new Error('invalid length');
    return new Uint8Array(decoded);
  } catch {
    throw new ApiError(400, 'signature_invalid_format', 'Signature must be base58 or base64 Ed25519 bytes.');
  }
}

function linkWallet(sessionId, walletCommitment) {
  const existing = storage.state.wallet_links.find(item => item.session_id === sessionId);
  if (existing) {
    existing.wallet_commitment = walletCommitment;
    existing.updated_at = new Date().toISOString();
  } else {
    storage.state.wallet_links.push({
      session_id: sessionId,
      wallet_commitment: walletCommitment,
      created_at: new Date().toISOString(),
    });
  }
}

function pruneTransient() {
  const state = storage.state;
  const challengeCount = state.wallet_challenges.length;
  state.wallet_challenges = state.wallet_challenges
    .filter(item => !isExpired(item.expires_at))
    .slice(0, 500);
  let changed = challengeCount !== state.wallet_challenges.length;
  if (state.audit_events.length > 1000) {
    state.audit_events.length = 1000;
    rebuildAuditChain();
    changed = true;
  }
  return changed;
}

function audit(type, data = {}) {
  const previous = storage.state.audit_events[0]?.event_hash || null;
  const event = {
    id: newId('audit'),
    type,
    data,
    previous_hash: previous,
    created_at: new Date().toISOString(),
  };
  event.event_hash = canonicalHash(event);
  storage.state.audit_events.unshift(event);
}

function verifyAuditChain() {
  const events = storage.state.audit_events;
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const expectedPrevious = events[index + 1]?.event_hash || null;
    const { event_hash: storedHash, ...payload } = event;
    if (event.previous_hash !== expectedPrevious || canonicalHash(payload) !== storedHash) return false;
  }
  return true;
}

function rebuildAuditChain() {
  for (let index = storage.state.audit_events.length - 1; index >= 0; index -= 1) {
    const event = storage.state.audit_events[index];
    event.previous_hash = storage.state.audit_events[index + 1]?.event_hash || null;
    const { event_hash: _old, ...payload } = event;
    event.event_hash = canonicalHash(payload);
  }
}

function sanitizeAuditData(data = {}) {
  return Object.fromEntries(Object.entries(data).filter(([key]) =>
    !['session', 'wallet', 'key', 'token', 'signature', 'nonce'].some(term => key.toLowerCase().includes(term))));
}

function readinessReport() {
  const state = storage.state;
  const relayStatus = relayTransport.status();
  const solanaStatus = solana.status();
  const queuedReviews = state.reviews.filter(item => item.status === 'queued').length;
  const pendingAnchors = state.anchor_jobs.filter(item => item.status === 'pending').length;
  const failedAnchors = state.anchor_jobs.filter(item => item.status === 'failed').length;
  const checks = [
    {
      id: 'storage',
      label: 'PostgreSQL storage',
      status: storage.driver === 'postgresql' && storage.isWritable() ? 'pass' : 'fail',
      detail: `${storage.driver} / ${storage.isWritable() ? 'writable' : 'read-only'}`,
      required: true,
    },
    {
      id: 'sealed_bundles',
      label: 'Sealed bundle encryption',
      status: vault.status().algorithm === 'aes-256-gcm' && Boolean(vault.status().active_key_id) ? 'pass' : 'fail',
      detail: `${vault.status().algorithm} / key ${vault.status().active_key_id || 'fallback'}`,
      required: true,
    },
    {
      id: 'relay_transport',
      label: 'Relay transport',
      status: relayTransport.productionReady() && relayStatus.nodes.length >= 3 ? 'pass' : 'fail',
      detail: `${relayStatus.nodes.length} network nodes`,
      required: true,
    },
    {
      id: 'reviewer_quorum',
      label: 'Reviewer quorum',
      status: REVIEWER_KEYS.size >= REVIEW_QUORUM ? 'pass' : 'fail',
      detail: `${REVIEWER_KEYS.size} configured / quorum ${REVIEW_QUORUM}`,
      required: true,
    },
    {
      id: 'audit_chain',
      label: 'Tamper-evident audit chain',
      status: verifyAuditChain() ? 'pass' : 'fail',
      detail: `${state.audit_events.length} events`,
      required: true,
    },
    {
      id: 'cors',
      label: 'Public CORS origins',
      status: allowedOrigins.includes('https://ignis-protocol.com') && allowedOrigins.includes('https://www.ignis-protocol.com') ? 'pass' : 'warn',
      detail: allowedOrigins.join(', '),
      required: false,
    },
    {
      id: 'solana_anchor',
      label: 'Solana anchor signer',
      status: solanaStatus.configured ? 'pass' : 'warn',
      detail: solanaStatus.configured ? `${solanaStatus.cluster} signer ready` : `${solanaStatus.cluster} signer not configured`,
      required: false,
    },
  ];
  const ready = checks.every(check => !check.required || check.status === 'pass');
  return {
    ready,
    status: ready ? (checks.some(check => check.status === 'warn') ? 'degraded' : 'ready') : 'blocked',
    version: VERSION,
    build: BUILD,
    checked_at: new Date().toISOString(),
    checks,
    metrics: {
      sessions: state.sessions.length,
      submissions: state.submissions.length,
      queued_reviews: queuedReviews,
      proofs: state.proofs.length,
      pending_anchors: pendingAnchors,
      failed_anchors: failedAnchors,
      uptime_seconds: Math.floor(process.uptime()),
    },
    relay_nodes: relayStatus.nodes.map(({ id, region, role, url, mode }) => ({ id, region, role, url, mode })),
    notes: [
      'Solana anchoring is optional until the production signer is provisioned.',
      'External privacy and security audit is still required before strong anonymity claims.',
    ],
  };
}

function bundleContext(submissionId, sanitizedHash) {
  return { protocol: 'IGNIS', submission_id: submissionId, sanitized_hash: sanitizedHash };
}

function openSubmissionBundle(submission) {
  if (submission.encrypted_bundle) {
    return vault.decrypt(submission.encrypted_bundle, bundleContext(submission.id, submission.sanitized_hash));
  }
  if (submission.sanitized_diff) {
    return {
      sanitized_diff: submission.sanitized_diff,
      metadata_report: submission.metadata_report || submission.metadata_report_summary || {},
    };
  }
  throw new ApiError(410, 'bundle_expired', 'The sealed review bundle has reached its retention limit.');
}

function summarizeMetadataReport(report = {}) {
  return {
    status: report.status,
    risk: report.risk,
    removed_fields: report.removed_fields,
    original_bytes: report.original_bytes,
    sanitized_bytes: report.sanitized_bytes,
    original_lines: report.original_lines,
    sanitized_lines: report.sanitized_lines,
    finding_count: Array.isArray(report.findings) ? report.findings.length : 0,
  };
}

let sensitiveStateMigrated = false;
async function migrateSensitiveState() {
  if (sensitiveStateMigrated) return;
  let changed = false;
  for (const submission of storage.state.submissions) {
    if (!submission.encrypted_bundle && submission.sanitized_diff) {
      const report = submission.metadata_report || {};
      submission.encrypted_bundle = vault.encrypt({
        sanitized_diff: submission.sanitized_diff,
        metadata_report: report,
      }, bundleContext(submission.id, submission.sanitized_hash));
      submission.bundle_key_id = submission.encrypted_bundle.key_id;
      submission.metadata_report_summary = summarizeMetadataReport(report);
      delete submission.sanitized_diff;
      delete submission.metadata_report;
      changed = true;
    }
  }
  if (storage.state.audit_events.length && !verifyAuditChain()) {
    rebuildAuditChain();
    changed = true;
  }
  sensitiveStateMigrated = true;
  if (changed) await storage.persist();
}

function pruneRetention() {
  const now = Date.now();
  let changed = false;
  for (const submission of storage.state.submissions) {
    if (submission.encrypted_bundle && submission.retention_expires_at
      && new Date(submission.retention_expires_at).getTime() <= now) {
      delete submission.encrypted_bundle;
      submission.bundle_purged_at = new Date().toISOString();
      submission.bundle_key_id = null;
      audit('sealed_bundle_purged', { submission_id: submission.id });
      changed = true;
    }
  }
  if (pruneTransient()) changed = true;
  return changed;
}

function findSession(id) {
  return storage.state.sessions.find(item => item.id === id);
}
function findSubmission(id) {
  return storage.state.submissions.find(item => item.id === id);
}
function findReview(id) {
  return storage.state.reviews.find(item => item.id === id);
}
function findProof(id) {
  return storage.state.proofs.find(item => item.id === id);
}
function bearerToken(req) {
  const value = String(req.get('Authorization') || '');
  return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
}
function requiredText(value, field, max) {
  const text = String(value || '').trim();
  if (!text) throw new ApiError(400, 'validation_error', `${field} is required.`);
  if (text.length > max) throw new ApiError(400, 'validation_error', `${field} must be ${max} characters or less.`);
  return text;
}
function optionalText(value, max) {
  return value === undefined || value === null ? '' : String(value).trim().slice(0, max);
}
function requiredEnum(value, field, allowed) {
  const text = requiredText(value, field, 32).toLowerCase();
  if (!allowed.includes(text)) throw new ApiError(400, 'validation_error', `${field} must be one of: ${allowed.join(', ')}.`);
  return text;
}
function requiredInt(value, field, min, max) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new ApiError(400, 'validation_error', `${field} must be an integer from ${min} to ${max}.`);
  }
  return parsed;
}
function clampInt(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}
function oddQuorum(value) {
  const quorum = clampInt(value, 3, 9, 3);
  return quorum % 2 === 0 ? quorum + 1 : quorum;
}
function trim(list, max) {
  if (list.length > max) list.length = max;
}
function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}
function parseReviewerKeys(value, previousValue = '') {
  const reviewers = new Map();
  const parse = (raw, status) => String(raw).split(',').map(item => item.trim()).filter(Boolean).forEach((entry, index) => {
    const separator = entry.indexOf(':');
    const label = separator > 0 ? entry.slice(0, separator).trim() : `reviewer-${index + 1}`;
    const key = separator > 0 ? entry.slice(separator + 1).trim() : entry;
    if (key.length >= 16) {
      const keyId = sha256(key).slice(7, 19);
      reviewers.set(sha256(key), {
        id: sha256(`reviewer:${label}`),
        label,
        key_id: keyId,
        status,
      });
    }
  });
  parse(value, 'active');
  parse(previousValue, 'grace');
  return reviewers;
}
function signalConfidence(accepted, settled) {
  if (!settled) return 'unproven';
  if (accepted >= 5) return 'high';
  if (accepted >= 2) return 'medium';
  return 'early';
}
function isExpired(iso) {
  return new Date(iso).getTime() <= Date.now();
}
function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}
function ok(res, req, data) {
  return res.json({ ok: true, request_id: req.requestId, ...data });
}
function error(res, req, err) {
  const status = err.status || 500;
  return res.status(status).json({
    ok: false,
    request_id: req.requestId,
    error: { code: err.code || 'internal_error', message: status >= 500 ? 'Internal server error.' : err.message },
  });
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
