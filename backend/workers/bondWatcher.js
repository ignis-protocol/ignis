// workers/bondWatcher.js
// Subscribes to gitlawb GraphQL CommitPushed events
// Resets repo bond timers automatically when a push is detected
// Falls back to polling the node /api/v1/events endpoint if WebSocket unavailable

const dbModule = require('../db');
function getDb() { return dbModule.getDB(); }

const GL_NODE  = process.env.GITLAWB_NODE || 'https://node.gitlawb.com';
const GL_WS    = GL_NODE.replace('https://', 'wss://').replace('http://', 'ws://');
const POLL_MS  = process.env.BOND_POLL_MS ? parseInt(process.env.BOND_POLL_MS) : 60_000; // 1 min default

let wsClient    = null;
let pollTimer   = null;
let lastEventId = null;
let started     = false;

// ── GraphQL subscription payload ──────────────────────────────────────────────
const SUBSCRIPTION_QUERY = `
  subscription {
    repositoryEvents(filter: { types: [COMMIT_PUSHED] }) {
      __typename
      ... on CommitPushed {
        commitHash
        branch
        repo { name owner }
        author { did trustScore }
      }
    }
  }
`;

// ── handle a commit pushed event ─────────────────────────────────────────────
function handleCommitPushed(event) {
  try {
    const repoOwner = event?.repo?.owner || event?.author?.did?.split(':').pop()?.slice(0,8);
    const repoName  = event?.repo?.name;
    if (!repoName) return;

    const repoKey = repoOwner ? `${repoOwner}/${repoName}` : repoName;
    const bond    = getDb().getBondByRepo(repoKey);

    if (bond) {
      getDb().updateBondCommit(repoKey);
      console.log(`[BondWatcher] ✓ bond timer reset for ${repoKey} — commit ${event.commitHash?.slice(0,8)}`);
    }
  } catch(e) {
    console.error('[BondWatcher] handleCommitPushed error:', e.message);
  }
}

// ── WebSocket GraphQL subscription ───────────────────────────────────────────
function startWebSocket() {
  try {
    const { WebSocket } = require('ws');
    wsClient = new WebSocket(`${GL_WS}/graphql`, ['graphql-ws']);

    wsClient.on('open', () => {
      console.log('[BondWatcher] WebSocket connected to gitlawb GraphQL');
      // Send connection_init
      wsClient.send(JSON.stringify({ type: 'connection_init', payload: {} }));
    });

    wsClient.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'connection_ack') {
          // Subscribe
          wsClient.send(JSON.stringify({
            id: '1',
            type: 'subscribe',
            payload: { query: SUBSCRIPTION_QUERY },
          }));
          console.log('[BondWatcher] Subscribed to CommitPushed events');
        } else if (msg.type === 'next' && msg.payload?.data?.repositoryEvents) {
          handleCommitPushed(msg.payload.data.repositoryEvents);
        } else if (msg.type === 'error') {
          console.warn('[BondWatcher] GraphQL error:', JSON.stringify(msg.payload));
        }
      } catch(e) {
        console.warn('[BondWatcher] parse error:', e.message);
      }
    });

    wsClient.on('error', (e) => {
      console.warn('[BondWatcher] WebSocket error:', e.message, '— falling back to polling');
      startPolling();
    });

    wsClient.on('close', (code, reason) => {
      console.warn(`[BondWatcher] WebSocket closed (${code}) — reconnecting in 30s`);
      wsClient = null;
      setTimeout(startWebSocket, 30_000);
    });
  } catch(e) {
    console.warn('[BondWatcher] WebSocket unavailable:', e.message, '— using polling');
    startPolling();
  }
}

// ── HTTP polling fallback ─────────────────────────────────────────────────────
// Polls /api/v1/events and checks for commits that match active bonds
async function pollEvents() {
  try {
    const bonds = getDb().listActiveBonds();
    if (!bonds.length) return;

    for (const bond of bonds) {
      try {
        const url  = `${GL_NODE}/api/v1/repos/${encodeURIComponent(bond.repo)}/commits`;
        const resp = await fetch(url, {
          headers: { 'Accept': 'application/json' },
          signal:  AbortSignal.timeout(6000),
        });

        if (!resp.ok) continue;
        const data = await resp.json();
        const commits = data.commits || data.items || [];

        if (commits.length > 0) {
          // Check if latest commit is newer than last_commit_at
          const latestTs  = commits[0]?.timestamp || commits[0]?.date;
          const lastReset = new Date(bond.last_commit_at).getTime();
          const commitTs  = latestTs ? new Date(latestTs).getTime() : 0;

          if (commitTs > lastReset) {
            getDb().updateBondCommit(bond.repo);
            console.log(`[BondWatcher] ✓ poll: bond timer reset for ${bond.repo}`);
          }
        }
      } catch(repoErr) {
        // silently skip unreachable repos
      }
    }
  } catch(e) {
    console.warn('[BondWatcher] poll error:', e.message);
  }
}

function startPolling() {
  if (pollTimer) return; // already polling
  console.log(`[BondWatcher] Starting HTTP poll every ${POLL_MS / 1000}s`);
  pollTimer = setInterval(pollEvents, POLL_MS);
  pollEvents(); // immediate first run
}

// ── slash check — run periodically ───────────────────────────────────────────
function runSlashCheck() {
  try {
    const stale = getDb().getStaleBonds();
    for (const bond of stale) {
      getDb().slashBond(bond.id);
      console.log(`[BondWatcher] ⚡ SLASHED repo=${bond.repo} bonder=${bond.bonder} amount=${bond.amount_ignis} $IGNIS`);
      // TODO: trigger on-chain slash tx when $IGNIS contract is live
    }
    if (stale.length) console.log(`[BondWatcher] Slashed ${stale.length} inactive bond(s)`);
  } catch(e) {
    console.error('[BondWatcher] slash check error:', e.message);
  }
}

// ── PUBLIC API ────────────────────────────────────────────────────────────────
function start() {
  if (started) return;
  started = true;
  console.log('[BondWatcher] Starting — connecting to gitlawb GraphQL subscription');

  // Try WebSocket first (real-time)
  startWebSocket();

  // Also run polling as belt-and-suspenders fallback
  setTimeout(startPolling, 5000);

  // Slash check every 6 hours
  setInterval(runSlashCheck, 6 * 60 * 60 * 1000);
  runSlashCheck(); // immediate check on boot
}

function stop() {
  if (wsClient) { wsClient.close(); wsClient = null; }
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  started = false;
}

module.exports = { start, stop, runSlashCheck };
