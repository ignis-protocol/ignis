const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
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

const app = require('../server');

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
      metadata: { author: 'hidden', email: 'hidden' },
    }),
  });
  assert.equal(submissionResult.response.status, 201);
  const { id: reviewId } = submissionResult.body.review;
  const submissionId = submissionResult.body.submission.id;

  const publicSubmission = await request(`/api/submissions/${submissionId}`);
  assert.equal(publicSubmission.body.submission.session, undefined);
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
});
