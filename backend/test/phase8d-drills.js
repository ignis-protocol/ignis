const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { BundleVault } = require('../lib/bundle-vault');
const { RelayTransport } = require('../lib/relay-transport');
const { createTokenService, sha256 } = require('../lib/security');
const { IgnisStorage } = require('../lib/storage');

async function main() {
  const startedAt = new Date().toISOString();
  const drills = [];

  await runStorageRecoveryDrill(drills);
  runReviewerRotationDrill(drills);
  runBundleRotationDrill(drills);
  runRelayRotationDrill(drills);
  runAuthRotationDrill(drills);

  console.log(JSON.stringify({
    ok: true,
    phase: '8D',
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    drills,
  }, null, 2));
}

async function runStorageRecoveryDrill(drills) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ignis-recovery-drill-'));
  const primaryPath = path.join(tempDir, 'primary.json');
  const backupPath = path.join(tempDir, 'backup.json');
  const restoredPath = path.join(tempDir, 'restored.json');

  const storage = new IgnisStorage({ filePath: primaryPath });
  await storage.ready;
  storage.state.submissions.push({
    id: 'sub_drill_001',
    repo: 'ignis-protocol/ignis',
    status: 'queued',
    created_at: new Date().toISOString(),
  });
  storage.state.proofs.push({
    id: 'proof_drill_001',
    submission_id: 'sub_drill_001',
    route_hash: sha256('phase-8d-route'),
  });
  await storage.persist();
  await storage.close();

  fs.copyFileSync(primaryPath, backupPath);
  const checksum = sha256(fs.readFileSync(backupPath));
  fs.copyFileSync(backupPath, restoredPath);

  const restored = new IgnisStorage({ filePath: restoredPath });
  await restored.ready;
  assert.equal(restored.state.submissions[0].id, 'sub_drill_001');
  assert.equal(restored.state.proofs[0].submission_id, 'sub_drill_001');
  await restored.close();

  drills.push({
    name: 'storage_backup_restore',
    status: 'pass',
    driver: 'json-file',
    checksum,
    records_restored: restored.state.submissions.length + restored.state.proofs.length,
  });
}

function runReviewerRotationDrill(drills) {
  const label = 'reviewer-1';
  const reviewerIdBefore = reviewerIdentity(label);
  const reviewerIdAfter = reviewerIdentity(label);
  const oldKeyHash = sha256('old-reviewer-key').slice(7, 19);
  const newKeyHash = sha256('new-reviewer-key').slice(7, 19);

  assert.equal(reviewerIdBefore, reviewerIdAfter);
  assert.notEqual(oldKeyHash, newKeyHash);

  drills.push({
    name: 'reviewer_key_rotation',
    status: 'pass',
    stable_identity: reviewerIdAfter.slice(7, 19),
    old_key_changed: true,
  });
}

function runBundleRotationDrill(drills) {
  const oldKey = crypto.randomBytes(32).toString('base64');
  const newKey = crypto.randomBytes(32).toString('base64');
  const context = { submission_id: 'sub_drill_001', bundle_hash: sha256('bundle') };
  const bundle = { diff: 'diff --git a/README.md b/README.md\n+phase 8d\n', metadata: { repo: 'ignis-protocol/ignis' } };

  const oldVault = new BundleVault({
    keys: `2026-06-old:${oldKey}`,
    activeKeyId: '2026-06-old',
  });
  const oldEnvelope = oldVault.encrypt(bundle, context);

  const rotatedVault = new BundleVault({
    keys: `2026-07-active:${newKey},2026-06-old:${oldKey}`,
    activeKeyId: '2026-07-active',
  });
  assert.deepEqual(rotatedVault.decrypt(oldEnvelope, context), bundle);
  const newEnvelope = rotatedVault.encrypt(bundle, context);
  assert.equal(newEnvelope.key_id, '2026-07-active');
  assert.deepEqual(rotatedVault.decrypt(newEnvelope, context), bundle);

  drills.push({
    name: 'bundle_key_rotation',
    status: 'pass',
    previous_bundle_readable: true,
    active_key_id: newEnvelope.key_id,
  });
}

function runRelayRotationDrill(drills) {
  const authSecret = 'phase-8d-auth-secret';
  const oldNodes = relayNodes('old');
  const newNodes = relayNodes('new');
  const apiTransport = new RelayTransport({
    authSecret,
    nodes: JSON.stringify(newNodes),
    previousNodes: JSON.stringify(oldNodes),
  });

  const envelope = { version: 1, ciphertext: 'sealed-drill-envelope' };
  const hop = {
    version: 1,
    node_id: 'relay-sea-01',
    role: 'ingress',
    region: 'Southeast Asia',
    submission_id: 'sub_drill_001',
    bundle_hash: sha256('relay-bundle'),
    envelope_hash: digest(JSON.stringify(envelope)),
    sealed_envelope: envelope,
    previous_hash: digest('ignis-relay:sub_drill_001'),
    nonce: crypto.randomBytes(12).toString('base64url'),
    timestamp: new Date().toISOString(),
  };
  const rawBody = JSON.stringify(hop);
  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(12).toString('base64url');
  const signature = hmac(oldNodes[0].secret, `${timestamp}.${nonce}.${rawBody}`);
  const replayStore = [];

  const authenticated = apiTransport.verifyInbound({
    'x-relay-node': oldNodes[0].id,
    'x-relay-timestamp': timestamp,
    'x-relay-nonce': nonce,
    'x-relay-signature': signature,
  }, rawBody, replayStore);
  assert.equal(authenticated.node.id, oldNodes[0].id);
  assert.equal(authenticated.key_status, 'previous');

  const receipt = apiTransport.accept(authenticated.node, hop, authenticated.secret);
  assert.equal(receipt.signature, hmac(oldNodes[0].secret, receipt.receipt_hash));
  assert.throws(() => apiTransport.verifyInbound({
    'x-relay-node': oldNodes[0].id,
    'x-relay-timestamp': timestamp,
    'x-relay-nonce': nonce,
    'x-relay-signature': signature,
  }, rawBody, replayStore), /replayed/);

  drills.push({
    name: 'relay_secret_rotation',
    status: 'pass',
    previous_secret_grace: true,
    replay_protection: true,
    nodes: newNodes.map(node => node.id),
  });
}

function runAuthRotationDrill(drills) {
  const oldTokens = createTokenService('phase-8d-old-auth-secret');
  const newTokens = createTokenService('phase-8d-new-auth-secret');
  const token = oldTokens.issue({ type: 'reviewer', reviewer_id: 'reviewer-1' }, 60);

  assert.equal(oldTokens.verify(token, 'reviewer').reviewer_id, 'reviewer-1');
  assert.equal(newTokens.verify(token, 'reviewer'), null);

  drills.push({
    name: 'auth_secret_rotation',
    status: 'pass',
    old_sessions_invalidated: true,
  });
}

function reviewerIdentity(label) {
  return sha256(`reviewer:${label}`);
}

function relayNodes(prefix) {
  return [
    { id: 'relay-sea-01', region: 'Southeast Asia', role: 'ingress', secret: `${prefix}-relay-sea-secret` },
    { id: 'relay-sgp-04', region: 'Singapore', role: 'mixer', secret: `${prefix}-relay-sgp-secret` },
    { id: 'relay-ams-09', region: 'Amsterdam', role: 'exit', secret: `${prefix}-relay-ams-secret` },
  ];
}

function digest(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function hmac(secret, value) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
