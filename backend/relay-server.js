require('dotenv').config();

const express = require('express');
const rateLimit = require('express-rate-limit');
const { RelayTransport } = require('./lib/relay-transport');

const app = express();
const port = Number(process.env.PORT || 8080);
const nodeId = String(process.env.RELAY_NODE_ID || '').trim();
const transport = new RelayTransport({ authSecret: process.env.AUTH_SECRET });
const node = transport.nodes.find(item => item.id === nodeId);
const replayStore = [];

if (!nodeId || !node) {
  throw new Error('RELAY_NODE_ID must match one node in RELAY_NODES.');
}

app.disable('x-powered-by');
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1));
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(rateLimit({
  windowMs: 60_000,
  max: Number(process.env.RELAY_RATE_LIMIT_PER_MINUTE || 300),
  standardHeaders: true,
  legacyHeaders: false,
}));
app.use(express.json({
  limit: process.env.REQUEST_BODY_LIMIT || '384kb',
  verify(req, _res, buffer) {
    if (req.path === '/relay/v1/forward') req.rawBody = buffer.toString('utf8');
  },
}));

app.get('/health', (_req, res) => res.json({
  ok: true,
  node: { id: node.id, region: node.region, role: node.role },
  replay_window_seconds: 120,
}));

app.post('/relay/v1/forward', (req, res) => {
  try {
    const authenticatedNode = transport.verifyInbound(req.headers, req.rawBody, replayStore);
    if (authenticatedNode.id !== node.id || req.body.node_id !== node.id) {
      return res.status(403).json({ ok: false, error: 'relay_node_mismatch' });
    }
    const receipt = transport.accept(node, req.body);
    pruneReplays();
    return res.json(receipt);
  } catch (error) {
    return res.status(401).json({ ok: false, error: 'relay_auth_invalid' });
  }
});

app.listen(port, () => {
  console.log(`IGNIS relay ${node.id} / ${node.region} / ${node.role}\nhttp://localhost:${port}`);
});

function pruneReplays() {
  const now = Date.now();
  for (let index = replayStore.length - 1; index >= 0; index -= 1) {
    if (new Date(replayStore[index].expires_at).getTime() <= now) replayStore.splice(index, 1);
  }
  if (replayStore.length > 2000) replayStore.length = 2000;
}
