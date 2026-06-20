const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

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

  const submissionResult = await request('/api/submissions', {
    method: 'POST',
    body: JSON.stringify({
      session: sessionResult.body.session.id,
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

  const settled = await request(`/api/reviews/${reviewId}`);
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
  assert.equal(submission.body.submission.solana_proof, 'ready_for_anchor');

  const signal = await request('/api/signal');
  assert.equal(signal.body.portable_score, 7.7);
  assert.equal(signal.body.totals.accepted, 1);
  assert.equal(signal.body.totals.reviewer_votes, 3);
  assert.equal(signal.body.confidence, 'early');
});
