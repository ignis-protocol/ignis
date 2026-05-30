// routes/network.js — live Base mainnet data via ethers
const express = require('express');
const router  = express.Router();

// simple in-memory cache (30s TTL)
let cache = {};
const TTL = 30_000;

function cached(key, fn) {
  const now = Date.now();
  if (cache[key] && now - cache[key].ts < TTL) return Promise.resolve(cache[key].data);
  return fn().then(data => { cache[key] = { data, ts: now }; return data; });
}

// GET /api/network
router.get('/', async (req, res) => {
  const provider = req.app.locals.provider;
  try {
    const data = await cached('network', async () => {
      const [block, gasPrice, network] = await Promise.all([
        provider.getBlock('latest'),
        provider.getGasPrice(),
        provider.getNetwork(),
      ]);
      return {
        chain_id:       network.chainId,
        chain_name:     'Base Mainnet',
        block_number:   block.number,
        block_timestamp:block.timestamp,
        gas_price_gwei: parseFloat(parseFloat(gasPrice.toString()) / 1e9).toFixed(6),
        gas_price_wei:  gasPrice.toString(),
        rpc:            process.env.BASE_RPC_URL || 'https://mainnet.base.org',
        explorer:       'https://basescan.org',
      };
    });
    return res.json({ ok: true, network: data });
  } catch (e) {
    console.error('[GET /network]', e.message);
    return res.status(503).json({ error: 'RPC unavailable', detail: e.message });
  }
});

// GET /api/network/gas
router.get('/gas', async (req, res) => {
  const provider = req.app.locals.provider;
  try {
    const data = await cached('gas', async () => {
      const gasPrice = await provider.getGasPrice();
      const gwei     = parseFloat(gasPrice.toString()) / 1e9;
      return {
        slow:   (gwei * 0.8).toFixed(6),
        normal: gwei.toFixed(6),
        fast:   (gwei * 1.5).toFixed(6),
        unit:   'gwei',
        // rough USD estimate based on ERC-20 deploy gas (~800k gas)
        deploy_cost_eth:  (gwei * 800000 / 1e9).toFixed(6),
        deploy_cost_usd:  ((gwei * 800000 / 1e9) * 3400).toFixed(3),
        updated_at: new Date().toISOString(),
      };
    });
    return res.json({ ok: true, gas: data });
  } catch (e) {
    console.error('[GET /network/gas]', e.message);
    return res.status(503).json({ error: 'RPC unavailable' });
  }
});

// GET /api/network/block/:number
router.get('/block/:number', async (req, res) => {
  const provider = req.app.locals.provider;
  const num = req.params.number === 'latest' ? 'latest' : parseInt(req.params.number);
  if (isNaN(num) && num !== 'latest') return res.status(400).json({ error: 'invalid block number' });
  try {
    const block = await provider.getBlock(num);
    if (!block) return res.status(404).json({ error: 'block not found' });
    return res.json({ ok: true, block: {
      number:     block.number,
      hash:       block.hash,
      timestamp:  block.timestamp,
      tx_count:   block.transactions.length,
      gas_used:   block.gasUsed?.toString(),
      gas_limit:  block.gasLimit?.toString(),
      base_fee:   block.baseFeePerGas?.toString(),
    }});
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// GET /api/network/tx/:hash
router.get('/tx/:hash', async (req, res) => {
  const provider = req.app.locals.provider;
  try {
    const [tx, receipt] = await Promise.all([
      provider.getTransaction(req.params.hash),
      provider.getTransactionReceipt(req.params.hash),
    ]);
    if (!tx) return res.status(404).json({ error: 'transaction not found' });
    return res.json({ ok: true, tx: {
      hash:           tx.hash,
      from:           tx.from,
      to:             tx.to,
      value:          tx.value?.toString(),
      gas_limit:      tx.gasLimit?.toString(),
      gas_price:      tx.gasPrice?.toString(),
      block_number:   tx.blockNumber,
      status:         receipt?.status === 1 ? 'success' : receipt ? 'failed' : 'pending',
      contract:       receipt?.contractAddress || null,
      gas_used:       receipt?.gasUsed?.toString(),
    }});
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
