const assert = require('assert');

const baseUrl = process.env.IGNIS_API_URL || 'https://api.ignis-protocol.com';
const siteUrl = process.env.IGNIS_SITE_URL || 'https://ignis-protocol.com';
const shouldSubmit = process.env.IGNIS_SMOKE_SUBMIT === '1';
const requireSolana = process.env.IGNIS_SMOKE_REQUIRE_SOLANA === '1';
const reviewerKey = process.env.IGNIS_REVIEWER_KEY || '';

async function main() {
  const pages = await checkPublicPages();

  const health = await get('/health');
  assert.equal(health.ok, true, 'health endpoint failed');
  assert.equal(health.storage.writable, true, 'storage must be writable');
  assert.equal(health.relay_production_ready, true, 'relay transport must be production ready');
  assert.equal(health.audit_chain_valid, true, 'audit chain must be valid');

  const security = await get('/api/security');
  assert.equal(security.relay.production_ready, true, 'relay production readiness missing');
  assert.equal(security.sealed_bundles.encryption, 'aes-256-gcm', 'sealed bundle encryption mismatch');
  assert.equal(security.relay.nodes.length, 3, 'expected three relays');

  const readiness = await get('/api/readiness');
  assert.equal(readiness.ready, true, 'required readiness checks must pass');

  const signal = await get('/api/signal');
  assert.equal(signal.incentive_layer, 'IGNIS token live on Solana', 'unexpected incentive layer');
  assert.equal(signal.token_contract, '7ZQP69CJWaxwFSMPjL89tC5FQdLzyLXwqGynedRiGory', 'unexpected token contract');

  const solana = await get('/api/solana');
  assert.equal(solana.proof_receipts, 'live', 'proof receipts should be live');
  assert.equal(solana.token_mint, '7ZQP69CJWaxwFSMPjL89tC5FQdLzyLXwqGynedRiGory', 'unexpected token mint');
  if (requireSolana) assert.equal(solana.configured, true, 'Solana signer must be configured in strict mode');

  const relays = await get('/api/relays');
  assert.equal(relays.production_ready, true, 'relay endpoint not production ready');

  const metrics = await get('/api/public-metrics');
  assert.equal(metrics.privacy, 'aggregate only; no IP, wallet, session, or user-level analytics', 'public metrics must be aggregate only');
  assert.equal(metrics.product_state.audited_alpha, true, 'public metrics should expose audited alpha state');
  assert.equal(metrics.product_state.trusted_peer_audit, 'clear', 'trusted peer audit should be clear');
  assert.equal(metrics.product_state.critical_high_blockers, 0, 'audit should report no critical/high blockers');

  const requiredChecks = readiness.checks.filter(check => check.required);
  const failedRequired = requiredChecks.filter(check => check.status !== 'pass');
  assert.equal(failedRequired.length, 0, `required readiness checks failed: ${failedRequired.map(check => check.id).join(', ')}`);

  const result = {
    site: siteUrl,
    api: baseUrl,
    pages,
    version: health.version,
    ready: readiness.ready,
    readiness_status: readiness.status,
    degraded: readiness.status === 'degraded',
    warnings: readiness.checks.filter(check => check.status === 'warn').map(check => check.id),
    required_checks: Object.fromEntries(requiredChecks.map(check => [check.id, check.status])),
    relays: security.relay.nodes.map(node => `${node.id}:${node.region}:${node.mode}`),
    storage: health.storage.driver,
    public_metrics: metrics.totals,
    audit_chain_valid: health.audit_chain_valid,
    solana_configured: solana.configured,
    strict_solana: requireSolana,
    submitted: false,
  };

  if (reviewerKey) {
    const reviewer = await post('/api/reviewer/session', { key: reviewerKey });
    assert.ok(reviewer.token, 'reviewer session token missing');
    result.reviewer_session = reviewer.reviewer.label;
  }

  if (shouldSubmit) {
    const session = await post('/api/sessions', { label: 'production smoke identity' });
    const diff = [
      'diff --git a/README.md b/README.md',
      '--- a/README.md',
      '+++ b/README.md',
      '@@ -1 +1,2 @@',
      '# IGNIS',
      '+Production smoke test.',
    ].join('\n');
    const sanitized = await post('/api/sanitize', { diff });
    assert.equal(sanitized.sanitized.report.status, 'clean', 'smoke diff should be clean');
    const submission = await post('/api/submissions', {
      session: session.session.id,
      repo: 'ignis-protocol/ignis',
      summary: 'Production smoke test.',
      diff,
    });
    assert.equal(submission.submission.bundle_encrypted, true, 'submission bundle must be encrypted');
    assert.equal(submission.submission.relay.receipts.length, 3, 'submission must cross three relays');
    result.submitted = true;
    result.submission_id = submission.submission.id;
    result.review_id = submission.review.id;
  }

  console.log(JSON.stringify(result, null, 2));
}

async function get(path) {
  return request(path, { method: 'GET' });
}

async function post(path, body) {
  return request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function request(path, options) {
  const response = await fetch(baseUrl + path, options);
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`${path} returned non-JSON response: ${text.slice(0, 120)}`);
  }
  if (!response.ok || !body.ok) {
    throw new Error(`${path} failed: ${body.error?.message || response.status}`);
  }
  return body;
}

async function checkPublicPages() {
  const pages = [
    ['home', '/'],
    ['protocol', '/protocol'],
    ['features', '/features'],
    ['manifesto', '/manifesto'],
    ['terminal', '/terminal'],
    ['reviewer', '/reviewer'],
    ['proof', '/proof'],
    ['ops', '/ops'],
  ];
  const results = {};
  for (const [name, path] of pages) {
    const html = await requestText(siteUrl + path);
    assert.match(html, /IGNIS/i, `${path} should render IGNIS content`);
    assert.doesNotMatch(html, /<title>\s*(404|not found)|404\s*:\s*not found|page not found/i, `${path} should not render a 404 page`);
    results[name] = 'pass';
  }
  return results;
}

async function requestText(url) {
  const response = await fetch(url, { redirect: 'follow' });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${url} failed: HTTP ${response.status}`);
  }
  return text;
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
